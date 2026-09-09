import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '@/services/supabase';
import { logAudit } from '../services/audit';
import { Bell, Send, Trash2, CheckCircle, AlertTriangle, Users, Activity, X, AtSign, Shield, Search } from 'lucide-react';

interface Notif {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  leida: boolean;
  usuario_email: string | null;
  destinatario: string | null;
  created_at: string;
}

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
}

const TIPOS = [
  { value: 'sistema', label: 'Sistema', icon: Activity, color: 'bg-blue-100 text-blue-600' },
  { value: 'usuario', label: 'Usuario', icon: Users, color: 'bg-emerald-100 text-emerald-600' },
  { value: 'alerta', label: 'Alerta', icon: AlertTriangle, color: 'bg-amber-100 text-amber-600' },
];

const ENLACES = [
  { value: '/usuarios', label: 'Usuarios' },
  { value: '/clientes', label: 'Clientes' },
  { value: '/comentarios', label: 'Comentarios' },
  { value: '/estadisticas', label: 'Estadisticas' },
  { value: '/auditoria', label: 'Auditoria' },
  { value: '/', label: 'Dashboard' },
];

const DESTINATARIOS = [
  { value: '__all__', label: 'Todos los usuarios', icon: Users },
  { value: '__admins__', label: 'Solo administradores', icon: Shield },
];

export const Notificaciones = () => {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState('sistema');
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enlace, setEnlace] = useState('/');
  const [destinatario, setDestinatario] = useState('__all__');
  const [busquedaDest, setBusquedaDest] = useState('Todos');
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState('');
  const [busquedaHistorial, setBusquedaHistorial] = useState('');

  useEffect(() => {
    fetchNotifs();
    fetchUsuarios();
    const channel = supabase
      .channel('notifs-admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, () => {
        fetchNotifs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchUsuarios = async () => {
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nombre, email, rol')
        .order('nombre');
      if (data) setUsuarios(data);
    } catch {}
  };

  const fetchNotifs = async () => {
    try {
      const { data } = await supabase
        .from('notificaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setNotifs(data);
    } catch {} finally { setLoading(false); }
  };

  const getDestinatarioLabel = (d: string | null) => {
    if (!d || d === '__all__') return 'Todos';
    if (d === '__admins__') return 'Administradores';
    const u = usuarios.find((u) => u.email === d);
    return u ? `${u.nombre} (@${u.email})` : d;
  };

  const getDestinatarioColor = (d: string | null) => {
    if (!d || d === '__all__') return 'bg-blue-100 text-blue-700';
    if (d === '__admins__') return 'bg-purple-100 text-purple-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !mensaje.trim()) { setMsg('Completa titulo y mensaje'); setTimeout(() => setMsg(''), 3000); return; }
    setEnviando(true);
    try {
      let emailsToSend: string[] = [];

      if (destinatario === '__all__') {
        emailsToSend = usuarios.map((u) => u.email);
      } else if (destinatario === '__admins__') {
        emailsToSend = usuarios.filter((u) => ['admin', 'ADMIN'].includes(u.rol)).map((u) => u.email);
      } else if (destinatario === '__users__') {
        emailsToSend = usuarios.filter((u) => !['admin', 'ADMIN'].includes(u.rol)).map((u) => u.email);
      } else {
        emailsToSend = [destinatario];
      }

      const inserts = emailsToSend.map((email) => ({
        tipo,
        titulo: titulo.trim(),
        mensaje: `${titulo.trim()}: ${mensaje.trim()}`,
        enlace,
        leida: false,
        usuario_email: email,
        destinatario: email,
      }));

      const { error } = await supabase.from('notificaciones').insert(inserts);
      if (error) throw error;

      logAudit({ accion: 'NOTIFICATION', tabla: 'notificaciones', modulo: 'Notificaciones', detalles: `Notificacion "${titulo.trim()}" enviada a ${emailsToSend.length} usuario(s)`, datos_nuevos: { titulo: titulo.trim(), destinatario, tipo, enlace } });

      setTitulo('');
      setMensaje('');
      setMsg(`Notificacion enviada a ${emailsToSend.length === usuarios.length ? 'todos' : emailsToSend.length + ' usuario(s)'}`);
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) {
      setMsg('Error: ' + e.message);
      setTimeout(() => setMsg(''), 3000);
    } finally { setEnviando(false); }
  };

  const handleDelete = async (id: number) => {
    await supabase.from('notificaciones').delete().eq('id', id);
    setNotifs((p) => p.filter((n) => n.id !== id));
  };

  const handleMarkRead = async (id: number) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
    setNotifs((p) => p.map((n) => n.id === id ? { ...n, leida: true } : n));
  };

  const handleDeleteAll = async () => {
    await supabase.from('notificaciones').delete().neq('id', 0);
    setNotifs([]);
  };

  const admins = usuarios.filter((u) => ['admin', 'ADMIN'].includes(u.rol));

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Notificaciones</h2>
          <p className="text-slate-500 text-sm mt-1">Enviar notificaciones en tiempo real a usuarios especificos</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Send size={16} /> Enviar notificacion</h3>
          <form onSubmit={handleSend} className="flex flex-col gap-4">
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><AtSign size={12} /> Destinatario</label>
              <input
                type="text"
                value={busquedaDest}
                onChange={(e) => { setBusquedaDest(e.target.value); setShowDestDropdown(true); setDestinatario(''); }}
                onFocus={() => setShowDestDropdown(true)}
                onBlur={() => setTimeout(() => setShowDestDropdown(false), 200)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Escribe un nombre o email..."
              />
              {showDestDropdown && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">General</div>
                  <button type="button" onClick={() => { setDestinatario('__all__'); setBusquedaDest('Todos (admin + usuarios)'); setShowDestDropdown(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2 transition-colors">
                    <Users size={14} className="text-blue-500" /> Todos (admin + usuarios)
                  </button>
                  <button type="button" onClick={() => { setDestinatario('__admins__'); setBusquedaDest('Solo administradores'); setShowDestDropdown(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 flex items-center gap-2 transition-colors">
                    <Shield size={14} className="text-purple-500" /> Solo administradores
                  </button>
                  <button type="button" onClick={() => { setDestinatario('__users__'); setBusquedaDest('Solo usuarios normales'); setShowDestDropdown(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 flex items-center gap-2 transition-colors">
                    <Activity size={14} className="text-emerald-500" /> Solo usuarios normales
                  </button>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-t border-slate-100">Buscar usuario</div>
                  {usuarios
                    .filter((u) => {
                      const texto = `${u.nombre} ${u.email} ${u.rol}`.toLowerCase();
                      return texto.includes(busquedaDest.toLowerCase());
                    })
                    .map((u) => (
                      <button key={u.email} type="button" onClick={() => { setDestinatario(u.email); setBusquedaDest(`${u.nombre} (@${u.email})`); setShowDestDropdown(false); }} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 transition-colors">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${['admin', 'ADMIN'].includes(u.rol) ? 'bg-purple-500' : 'bg-blue-500'}`}>
                          {u.nombre?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                        <div>
                          <p className="text-slate-700 font-medium">{u.nombre}</p>
                          <p className="text-[10px] text-slate-400">@{u.email} · {u.rol}</p>
                        </div>
                      </button>
                    ))}
                  {usuarios.filter((u) => `${u.nombre} ${u.email} ${u.rol}`.toLowerCase().includes(busquedaDest.toLowerCase())).length === 0 && busquedaDest && (
                    <div className="px-3 py-4 text-center text-xs text-slate-400">No se encontraron usuarios</div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                  {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Redirigir a</label>
                <select value={enlace} onChange={(e) => setEnlace(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                  {ENLACES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Titulo</label>
              <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder="Titulo de la notificacion" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Mensaje</label>
              <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none" placeholder="Escribe el mensaje..." required />
            </div>
            {msg && <p className={`text-xs font-medium ${msg.includes('Error') ? 'text-red-500' : 'text-emerald-600'}`}>{msg}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={enviando} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50">
                <Send size={14} /> {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Bell size={16} /> Historial ({notifs.length})</h3>
            {notifs.length > 0 && (
              <button onClick={handleDeleteAll} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium">
                <Trash2 size={12} /> Borrar todo
              </button>
            )}
          </div>
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por titulo, mensaje o destinatario..."
              value={busquedaHistorial}
              onChange={(e) => setBusquedaHistorial(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex flex-col gap-2">
            {notifs.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No hay notificaciones</p>}
            {notifs.filter((n) => {
              if (!busquedaHistorial) return true;
              const texto = `${n.titulo} ${n.mensaje} ${getDestinatarioLabel(n.destinatario)} ${n.tipo}`.toLowerCase();
              return texto.includes(busquedaHistorial.toLowerCase());
            }).length === 0 && busquedaHistorial && (
              <p className="text-sm text-slate-400 text-center py-8">No se encontraron resultados para "{busquedaHistorial}"</p>
            )}
            {notifs
              .filter((n) => {
                if (!busquedaHistorial) return true;
                const texto = `${n.titulo} ${n.mensaje} ${getDestinatarioLabel(n.destinatario)} ${n.tipo}`.toLowerCase();
                return texto.includes(busquedaHistorial.toLowerCase());
              })
              .map((n) => {
              const tipoInfo = TIPOS.find((t) => t.value === n.tipo) || TIPOS[0];
              const Icon = tipoInfo.icon;
              const isEliminada = (n as any).eliminada;
              return (
                <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${isEliminada ? 'border-red-100 bg-red-50/30 opacity-60' : n.leida ? 'border-slate-100 bg-white' : 'border-blue-100 bg-blue-50/50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tipoInfo.color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${n.leida ? 'text-slate-500' : 'text-slate-700 font-semibold'}`}>{n.titulo}</p>
                      {isEliminada && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Eliminada por usuario</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{n.mensaje}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getDestinatarioColor(n.destinatario)}`}>
                        @ {getDestinatarioLabel(n.destinatario)}
                      </span>
                      <span className="text-[10px] text-slate-400">{new Date(n.created_at).toLocaleString('es-ES')}</span>
                      {n.enlace && <span className="text-[10px] text-slate-400">· {n.enlace}</span>}
                      {n.leida && !isEliminada && <span className="text-[10px] text-emerald-500 font-medium">Leida</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.leida && (
                      <button onClick={() => handleMarkRead(n.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="Marcar leida">
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(n.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notificaciones;
