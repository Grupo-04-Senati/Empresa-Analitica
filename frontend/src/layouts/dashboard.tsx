import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Headphones,
  Brain,
  Database,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  ShieldCheck,
  Tags,
  Layers,
  ClipboardList,
  MessageSquare,
  Clock,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '@/services/supabase';

interface SubMenuItem {
  label: string;
  path: string;
  adminOnly?: boolean;
}

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  items: SubMenuItem[];
}

const menuData: MenuItem[] = [
  {
    title: 'DASHBOARD',
    icon: <LayoutDashboard size={18} />,
    items: [{ label: 'Inicio', path: '/' }],
  },
  {
    title: 'CLIENTES',
    icon: <Users size={18} />,
    items: [
      { label: 'Lista de clientes', path: '/clientes' },
      { label: 'Nuevo cliente', path: '/clientes/nuevo', adminOnly: true },

    ],
  },
  {
    title: 'ATENCION',
    icon: <Headphones size={18} />,
    items: [
      { label: 'Solicitudes', path: '/solicitudes' },
      { label: 'Comentarios', path: '/comentarios' },
      { label: 'Tiempos de atencion', path: '/tiempo-atencion' },
    ],
  },
  {
    title: 'INTELIGENCIA NLP',
    icon: <Brain size={18} />,
    items: [
      { label: 'Analizar comentario', path: '/analizar-comentario' },
      { label: 'Palabras frecuentes', path: '/palabras-frecuentes' },
      { label: 'Categorias', path: '/categorias' },
      { label: 'Clasificacion', path: '/clasificacion' },
    ],
  },
  {
    title: 'SCIENTIFIC DATA',
    icon: <Database size={18} />,
    items: [
      { label: 'Estadisticas', path: '/estadisticas' },
      { label: 'Interpolacion', path: '/interpolacion' },
      { label: 'Optimizacion', path: '/optimizacion' },
    ],
  },
  {
    title: 'REPORTES',
    icon: <FileText size={18} />,
    items: [
      { label: 'Atencion', path: '/reportes/atencion' },
      { label: 'NLP', path: '/reportes/nlp' },
      { label: 'Estadisticas', path: '/reportes/estadisticas' },
    ],
  },
  {
    title: 'CONFIGURACION',
    icon: <Settings size={18} />,
    items: [
      { label: 'Usuarios', path: '/usuarios', adminOnly: true },
      { label: 'Categorias', path: '/configuracion', adminOnly: true },
      { label: 'Auditoria', path: '/auditoria', adminOnly: true },
      { label: 'Notificaciones', path: '/notificaciones', adminOnly: true },
    ],
  },
];

export const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    DASHBOARD: true,
    CLIENTES: false,
    ATENCION: false,
    'INTELIGENCIA NLP': false,
    'SCIENTIFIC DATA': false,
    REPORTES: false,
    CONFIGURACION: false,
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<{ id: number; titulo: string; mensaje: string; tipo: string; enlace: string | null; leida: boolean; created_at: string }[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user) return;
      try {
        const { data } = await supabase.from('usuarios').select('avatar_url').eq('email', user.email).maybeSingle();
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      } catch {}
    };
    fetchAvatar();
  }, [user]);

  useEffect(() => {
    fetchNotificaciones();
    const channel = supabase
      .channel('notificaciones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, () => {
        fetchNotificaciones();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchNotificaciones = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('notificaciones')
        .select('id, titulo, mensaje, tipo, enlace, leida, created_at, destinatario, eliminada')
        .eq('destinatario', user.email)
        .eq('eliminada', false)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setNotificaciones(data);
    } catch {}
  };

  const markAsRead = async (id: number) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
    setNotificaciones((prev) => prev.map((n) => n.id === id ? { ...n, leida: true } : n));
  };

  const deleteNotif = async (id: number) => {
    await supabase.from('notificaciones').update({ leida: true, eliminada: true }).eq('id', id);
    setNotificaciones((prev) => prev.filter((n) => n.id === id));
  };

  const unreadCount = notificaciones.filter((n) => !n.leida).length;

  useEffect(() => {
    menuData.forEach((section) => {
      if (section.items.some((item) => item.path === location.pathname)) {
        setOpenSections((prev) => ({ ...prev, [section.title]: true }));
      }
    });
  }, [location.pathname]);

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = () => {
    if (user?.nombre) return user.nombre.charAt(0).toUpperCase();
    return user?.email ? user.email.slice(0, 2).toUpperCase() : 'U';
  };

  const visibleMenu = menuData.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((section) => section.items.length > 0);

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/30">N</div>
          <div>
            <h2 className="m-0 text-[15px] font-bold text-white tracking-tight">NEXUS Corp</h2>
            <span className="text-[10px] tracking-wider text-slate-500 uppercase">Plataforma de Analisis</span>
          </div>
        </div>

        <nav className="p-3">
          {visibleMenu.map((section) => {
            const isOpen = openSections[section.title];
            return (
              <div key={section.title} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-slate-400 transition-all hover:bg-white/5 hover:text-slate-200"
                >
                  <div className="flex items-center gap-2.5">
                    {section.icon}
                    <span className="text-xs font-semibold tracking-wider">{section.title}</span>
                  </div>
                  {isOpen ? <ChevronDown size={14} className="opacity-50" /> : <ChevronRight size={14} className="opacity-50" />}
                </button>
                {isOpen && (
                  <div className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l border-white/5 pl-3">
                    {section.items.map((subItem) => {
                      const isActive = location.pathname === subItem.path;
                      return (
                        <Link
                          key={subItem.path}
                          to={subItem.path}
                          onClick={() => setSidebarOpen(false)}
                          className={`block rounded-lg px-3 py-2 text-[13px] no-underline transition-all ${
                            isActive
                              ? 'bg-blue-600/10 font-semibold text-blue-400'
                              : 'font-normal text-slate-500 hover:bg-white/5 hover:text-slate-300'
                          }`}
                        >
                          {subItem.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/10 px-3 py-4">
        <div className="px-3 mb-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
            isAdmin ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
          }`}>
            {isAdmin && <ShieldCheck size={10} />}
            {user?.rol || 'usuario'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-3 py-2 text-slate-500 transition-all hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut size={16} />
          <span className="text-[13px] font-semibold">Cerrar Sesion</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className="fixed top-0 left-0 z-50 hidden h-screen w-64 flex-col overflow-y-auto border-r border-white/5 bg-[#0b1220] lg:flex">
        {sidebarContent}
      </aside>

      <aside className={`fixed top-0 left-0 z-50 flex h-screen w-64 flex-col overflow-y-auto border-r border-white/5 bg-[#0b1220] transition-transform duration-300 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button type="button" onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 z-10 cursor-pointer rounded-lg border-none bg-white/10 p-1.5 text-slate-400 hover:text-white">
          <X size={18} />
        </button>
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-xl px-4 lg:px-6">
          <button type="button" onClick={() => setSidebarOpen(true)} className="cursor-pointer rounded-lg border-none bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 lg:hidden">
            <Menu size={20} />
          </button>

          <div className="hidden items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-2 sm:flex sm:w-80">
            <Search size={16} className="text-slate-400" />
            <input type="text" placeholder="Buscar en el sistema..." className="w-full border-none bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400" />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button type="button" onClick={() => setShowNotif(!showNotif)} className="cursor-pointer rounded-xl border-none bg-slate-100/80 p-2 text-slate-500 hover:bg-slate-200 relative transition-all">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/50 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Notificaciones</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{unreadCount} sin leer</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notificaciones.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-slate-400">Sin notificaciones</div>
                    ) : (
                      notificaciones.map((n) => (
                        <div key={n.id} onClick={() => { if (n.enlace) { navigate(n.enlace); setShowNotif(false); } if (!n.leida) markAsRead(n.id); }} className={`px-4 py-3 border-b border-slate-50 transition-colors flex items-start gap-3 ${n.leida ? 'bg-white hover:bg-slate-50/50' : 'bg-blue-50/50 hover:bg-blue-50'} cursor-pointer`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.tipo === 'usuario' ? 'bg-emerald-100 text-emerald-600' : n.tipo === 'sistema' ? 'bg-blue-100 text-blue-600' : n.tipo === 'alerta' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                            {n.tipo === 'usuario' ? <Users size={14} /> : n.tipo === 'sistema' ? <Activity size={14} /> : <AlertTriangle size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs leading-relaxed ${n.leida ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>{n.titulo}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{n.mensaje}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString('es-ES')}</p>
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }} className="text-slate-300 hover:text-red-500 transition-colors p-1 shrink-0">
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button type="button" onClick={() => navigate('/perfil')} className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-none bg-gradient-to-br from-blue-600 to-blue-700 text-[13px] font-bold text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all" title="Ver Perfil">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : getInitials()}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
