import { useState, useEffect } from 'react';
import { Users, Shield, Mail, Search } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface UsuarioRow {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  created_at: string;
}

export const Usuarios = () => {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('usuarios')
        .select('id, nombre, email, rol, activo, created_at')
        .order('created_at', { ascending: false });
      if (!dbError && data && data.length > 0) {
        setUsuarios(data);
      }
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  const filtrados = usuarios.filter((u) => {
    const texto = `${u.nombre} ${u.email}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  const total = usuarios.length;
  const admins = usuarios.filter((u) => u.rol.toUpperCase() === 'ADMIN').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Usuarios</h2>
          <p className="text-slate-500 text-sm mt-1">Administración de cuentas, roles y permisos de acceso</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5">
            <Shield size={28} className="text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Error</h3>
          <p className="text-slate-400 text-sm max-w-md leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Usuarios</h2>
          <p className="text-slate-500 text-sm mt-1">Administración de cuentas, roles y permisos de acceso</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600">
            <Users size={20} />
          </span>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Total usuarios</p>
            <p className="text-xl font-bold text-slate-800">{total}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600">
            <Shield size={20} />
          </span>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Administradores</p>
            <p className="text-xl font-bold text-slate-800">{admins}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 text-amber-600">
            <Mail size={20} />
          </span>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Registrados</p>
            <p className="text-xl font-bold text-slate-800">{total}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium text-slate-500">Usuario</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Rol</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha de Registro</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => {
                const initials = u.nombre ? u.nombre.charAt(0).toUpperCase() : u.email.slice(0, 2).toUpperCase();
                return (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {initials}
                        </span>
                        <div>
                          <p className="font-medium text-slate-800">{u.nombre}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        u.rol.toUpperCase() === 'ADMIN'
                          ? 'bg-emerald-50 text-emerald-700'
                          : u.rol.toUpperCase() === 'ANALISTA'
                            ? 'bg-blue-50 text-blue-700'
                            : u.rol.toUpperCase() === 'SUPERVISOR'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-slate-100 text-slate-600'
                      }`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        u.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString('es-ES')}
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 text-sm">
                    No se encontraron usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Usuarios;
