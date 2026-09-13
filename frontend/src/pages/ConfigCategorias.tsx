import { useState, useEffect } from 'react';
import { Users, ShieldCheck, User, Search, Loader2, RefreshCw, Crown, Mail } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { logAudit } from '@/services/audit';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  created_at: string;
}

export const ConfigCategorias = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => { fetchUsuarios(); }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('usuarios')
        .select('id, nombre, email, rol, created_at')
        .order('nombre');
      if (err) throw err;
      setUsuarios((data || []) as Usuario[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios');
    }
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const cambiarRol = async (id: number, nuevoRol: string, nombre: string) => {
    setSavingId(id);
    setError('');
    try {
      const { error: err } = await supabase
        .from('usuarios')
        .update({ rol: nuevoRol })
        .eq('id', id);
      if (err) throw err;
      logAudit({
        accion: 'UPDATE',
        tabla: 'usuarios',
        registro_id: id,
        modulo: 'Configuracion',
        detalles: `Rol de "${nombre}" cambiado a ${nuevoRol}`,
      });
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, rol: nuevoRol } : u));
      showToast(`Rol de ${nombre} cambiado a ${nuevoRol}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar rol');
    }
    setSavingId(null);
  };

  const filtrados = usuarios.filter(u => {
    const texto = `${u.nombre} ${u.email} ${u.rol}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  const stats = {
    total: usuarios.length,
    admins: usuarios.filter(u => u.rol === 'admin' || u.rol === 'ADMIN').length,
    usuarios: usuarios.filter(u => u.rol !== 'admin' && u.rol !== 'ADMIN').length,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestion de Usuarios</h2>
          <p className="text-slate-500 text-sm mt-1">Cambia el rol de administrador y usuario de todos los clientes</p>
        </div>
        <button onClick={fetchUsuarios} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {toast && (
        <div className="flex items-center gap-2 px-4 py-3 mb-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <ShieldCheck size={16} /> {toast}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Usuarios', valor: stats.total, color: 'text-blue-600', bg: 'bg-blue-50', icon: Users },
          { label: 'Administradores', valor: stats.admins, color: 'text-purple-600', bg: 'bg-purple-50', icon: Crown },
          { label: 'Usuarios Normales', valor: stats.usuarios, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: User },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}><k.icon size={20} /></span>
            <div><p className="text-xs text-slate-500 uppercase">{k.label}</p><p className="text-xl font-bold text-slate-800">{k.valor}</p></div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 p-5 border-b border-slate-100">
          <Users size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700">Lista de Usuarios</h3>
          <div className="relative flex-1 max-w-sm ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Buscar por nombre, email o rol..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
        </div>
        {loading ? (
          <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Usuario</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Rol Actual</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Registro</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-500">Cambiar Rol</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-400">No se encontraron usuarios</td></tr>
                ) : filtrados.map(u => {
                  const isAdmin = u.rol === 'admin' || u.rol === 'ADMIN';
                  return (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${isAdmin ? 'bg-purple-500' : 'bg-blue-500'}`}>
                            {u.nombre?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span className="font-medium text-slate-800">{u.nombre}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Mail size={12} className="text-slate-400" />
                          {u.email}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {isAdmin ? <Crown size={12} /> : <User size={12} />}
                          {isAdmin ? 'ADMIN' : 'USUARIO'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString('es-ES')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {savingId === u.id ? (
                          <Loader2 size={16} className="animate-spin text-blue-500 ml-auto" />
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => cambiarRol(u.id, isAdmin ? 'usuario' : 'admin', u.nombre)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${isAdmin
                                ? 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-700'
                              }`}
                              title={isAdmin ? 'Cambiar a Usuario' : 'Cambiar a Admin'}
                            >
                              {isAdmin ? <User size={12} /> : <Crown size={12} />}
                              {isAdmin ? 'Hacer Usuario' : 'Hacer Admin'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigCategorias;
