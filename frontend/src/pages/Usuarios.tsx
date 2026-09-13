import { useState, useEffect } from 'react';
import { Users, Shield, Mail, Search, Edit3, Trash2, Loader2, X, CheckCircle } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { logAudit } from '@/services/audit';

/*
 * Ya no se usa VITE_SUPABASE_SERVICE_KEY: cualquier variable VITE_ se incrusta
 * en el JavaScript publicado, asi que la clave de administrador total de
 * Supabase acababa en el navegador de todos los visitantes.
 *
 * Las tablas se tocan con el cliente normal (RLS deshabilitado) y el borrado
 * del usuario de Auth, que si exige service_role, se delega en la Edge
 * Function admin-usuarios, donde la clave vive en el servidor.
 */

const ROLES = ['ADMIN', 'USUARIO'];
const roleColors: Record<string, string> = {
  ADMIN: 'bg-emerald-50 text-emerald-700',
  USUARIO: 'bg-slate-100 text-slate-600',
};

interface UsuarioRow {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  created_at: string;
}

/**
 * Borra una cuenta completa (perfil, datos asociados y usuario de Auth) a
 * traves de la Edge Function, que comprueba el rol del solicitante.
 */
async function borrarCuenta(email: string): Promise<{ ok: boolean; mensaje?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, mensaje: 'Tu sesion expiro. Vuelve a iniciar sesion con correo y contrasena.' };
  }

  const { data, error } = await supabase.functions.invoke('admin-usuarios', {
    method: 'DELETE',
    body: { email },
  });

  if (error) {
    return {
      ok: false,
      mensaje: `No se pudo borrar la cuenta: ${error.message}. ` +
        'Revisa que la Edge Function admin-usuarios este desplegada.',
    };
  }
  return { ok: !!(data as { ok?: boolean })?.ok };
}

export const Usuarios = () => {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newRole, setNewRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error: dbError } = await supabase
          .from('usuarios')
          .select('id, nombre, email, rol, activo, created_at')
          .order('created_at', { ascending: false });
        if (!dbError && data && active) setUsuarios(data);
      } catch { /* empty */ } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loading) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('usuarios')
          .select('id, nombre, email, rol, activo, created_at')
          .order('created_at', { ascending: false });
        if (data) {
          setUsuarios((prev) => {
            const changed = data.length !== prev.length || data.some((d, i) => !prev[i] || d.id !== prev[i].id || d.rol !== prev[i].rol || d.activo !== prev[i].activo || d.nombre !== prev[i].nombre);
            return changed ? data : prev;
          });
        }
      } catch { /* empty */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  const fetchUsuarios = async () => {
    try {
      const { data, error: dbError } = await supabase
        .from('usuarios')
        .select('id, nombre, email, rol, activo, created_at')
        .order('created_at', { ascending: false });
      if (!dbError && data) setUsuarios(data);
    } catch { /* empty */ }
  };

  const handleRoleChange = async (usuarioId: number) => {
    if (!newRole) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const usuario = usuarios.find((u) => u.id === usuarioId);
      const rolAnterior = usuario?.rol || 'desconocido';
      // Cliente normal: `usuarios` tiene RLS deshabilitado y el acceso de
      // admin ya lo controla AdminGuard en la ruta.
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ rol: newRole })
        .eq('id', usuarioId);
      if (updateError) throw new Error(updateError.message);
      logAudit({ accion: 'UPDATE', tabla: 'usuarios', registro_id: usuarioId, usuario_email: usuario?.email, modulo: 'Admin', detalles: `Rol cambiado de "${rolAnterior}" a "${newRole}" para ${usuario?.email || usuarioId}`, datos_anteriores: { rol: rolAnterior }, datos_nuevos: { rol: newRole } });
      setSuccess('Rol actualizado correctamente');
      setEditingId(null);
      setNewRole('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar rol');
    } finally { setSaving(false); }
  };

  const handleDeleteUser = async (usuarioId: number) => {
    setDeleteLoading(true);
    setError('');
    setSuccess('');
    try {
      const usuario = usuarios.find((u) => u.id === usuarioId);
      if (!usuario) return;

      // Un solo paso en el servidor: borra las tablas hijas, el perfil y el
      // usuario de Auth, con la service_role en el servidor.
      const resultado = await borrarCuenta(usuario.email);
      if (!resultado.ok) {
        setError(resultado.mensaje || 'No se pudo borrar la cuenta.');
        return;
      }
      logAudit({ accion: 'DELETE', tabla: 'usuarios', registro_id: usuarioId, usuario_email: usuario?.email, modulo: 'Admin', detalles: `Cuenta eliminada: ${usuario?.email || usuarioId}` });
      setUsuarios((prev) => prev.filter((u) => u.id !== usuarioId));
      setSuccess('Usuario eliminado correctamente');
      setDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar usuario');
    } finally { setDeleteLoading(false); }
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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Usuarios</h2>
          <p className="text-slate-500 text-sm mt-1">Administracion de cuentas, roles y permisos de acceso</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm p-3 mb-4 flex items-center gap-2">
          <X size={16} />{error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm p-3 mb-4 flex items-center gap-2">
          <CheckCircle size={16} />{success}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600"><Users size={20} /></span>
          <div><p className="text-xs text-slate-500 uppercase tracking-wide">Total usuarios</p><p className="text-xl font-bold text-slate-800">{total}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600"><Shield size={20} /></span>
          <div><p className="text-xs text-slate-500 uppercase tracking-wide">Administradores</p><p className="text-xl font-bold text-slate-800">{admins}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 text-amber-600"><Mail size={20} /></span>
          <div><p className="text-xs text-slate-500 uppercase tracking-wide">Registrados</p><p className="text-xl font-bold text-slate-800">{total}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 mb-4 p-5 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por nombre o email..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium text-slate-500">Usuario</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Rol</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Registro</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => {
                const initials = u.nombre ? u.nombre.charAt(0).toUpperCase() : u.email.slice(0, 2).toUpperCase();
                const isEditing = editingId === u.id;
                const isDeleting = deleteId === u.id;
                return (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">{initials}</span>
                        <div>
                          <p className="font-medium text-slate-800">{u.nombre}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="px-3 py-1.5 rounded-lg border border-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                          <option value="">Seleccionar...</option>
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[u.rol.toUpperCase()] || roleColors.USUARIO}`}>{u.rol}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{new Date(u.created_at).toLocaleDateString('es-ES')}</td>
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleRoleChange(u.id)} disabled={saving || !newRole} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {saving ? <Loader2 size={12} className="animate-spin" /> : 'Guardar'}
                          </button>
                          <button onClick={() => { setEditingId(null); setNewRole(''); }} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors">Cancelar</button>
                        </div>
                      ) : isDeleting ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-red-600 font-medium">Eliminar?</span>
                          <button onClick={() => handleDeleteUser(u.id)} disabled={deleteLoading} className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                            {deleteLoading ? <Loader2 size={12} className="animate-spin" /> : 'Si'}
                          </button>
                          <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors">No</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setEditingId(u.id); setNewRole(u.rol); setDeleteId(null); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Cambiar rol">
                            <Edit3 size={16} />
                          </button>
                          <button onClick={() => { setDeleteId(u.id); setEditingId(null); setNewRole(''); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Eliminar usuario">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm">No se encontraron usuarios</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Usuarios;
