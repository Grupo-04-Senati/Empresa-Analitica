import { useState, useEffect } from 'react';
import { Users, Shield, Mail, Search, Edit3, ChevronDown, Loader2, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPut } from '../services/api';

interface UsuarioRow {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  created_at: string;
}

const roles = ['ADMIN', 'ANALISTA', 'SUPERVISOR', 'USUARIO'];
const roleColors: Record<string, string> = {
  ADMIN: 'bg-emerald-50 text-emerald-700',
  ANALISTA: 'bg-blue-50 text-blue-700',
  SUPERVISOR: 'bg-purple-50 text-purple-700',
  USUARIO: 'bg-slate-100 text-slate-600',
};

export const AdminUsuarios = () => {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newRole, setNewRole] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const data = await apiGet<UsuarioRow[]>('/api/admin/usuarios');
      setUsuarios(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
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

  const handleRoleChange = async (usuarioId: number) => {
    if (!newRole) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiPut(`/api/admin/usuarios/${usuarioId}/rol`, { nuevo_rol: newRole });
      setSuccess('Rol actualizado correctamente');
      setEditingId(null);
      setNewRole('');
      fetchUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar rol');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-slate-500 text-sm">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Administración de Usuarios</h2>
          <p className="text-slate-500 text-sm mt-1">Gestión de cuentas, roles y permisos de acceso</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm p-3 mb-4 flex items-center gap-2">
          <X size={16} />
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm p-3 mb-4 flex items-center gap-2">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

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

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 mb-4 p-5 border-b border-slate-100">
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
                <th className="text-left py-3 px-4 font-medium text-slate-500">Rol Actual</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Nuevo Rol</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => {
                const initials = u.nombre ? u.nombre.charAt(0).toUpperCase() : u.email.slice(0, 2).toUpperCase();
                const isEditing = editingId === u.id;
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
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[u.rol.toUpperCase()] || roleColors.USUARIO}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="px-3 py-1.5 rounded-lg border border-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        >
                          <option value="">Seleccionar...</option>
                          {roles.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRoleChange(u.id)}
                            disabled={saving || !newRole}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : 'Guardar'}
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setNewRole(''); }}
                            className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingId(u.id); setNewRole(u.rol); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="Cambiar rol"
                        >
                          <Edit3 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
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

export default AdminUsuarios;
