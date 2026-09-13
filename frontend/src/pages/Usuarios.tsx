import { useState, useEffect } from 'react';
import { Users, Shield, Mail, Search, Edit3, Trash2, Loader2, X, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { logAudit } from '@/services/audit';

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

interface ClienteRow {
  id: number;
  usuario_id: number | null;
  nombre: string;
  empresa: string | null;
  email: string | null;
}

async function borrarCuenta(email: string): Promise<{ ok: boolean; mensaje?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, mensaje: 'Tu sesion expiro.' };
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { method: 'DELETE', body: { email } });
  if (error) return { ok: false, mensaje: `No se pudo borrar: ${error.message}` };
  return { ok: !!(data as any)?.ok };
}

export const Usuarios = () => {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editModal, setEditModal] = useState<UsuarioRow | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', email: '', empresa: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [usrRes, cliRes] = await Promise.all([
        supabase.from('usuarios').select('id, nombre, email, rol, activo, created_at').order('created_at', { ascending: false }),
        supabase.from('clientes').select('id, usuario_id, nombre, empresa, email'),
      ]);
      if (usrRes.data) setUsuarios(usrRes.data);
      if (cliRes.data) setClientes(cliRes.data);
    } catch { /* empty */ } finally { setLoading(false); }
  };

  const getCliente = (userId: number) => clientes.find(c => c.usuario_id === userId);

  const filtrados = usuarios.filter(u => `${u.nombre} ${u.email}`.toLowerCase().includes(busqueda.toLowerCase()));
  const total = usuarios.length;
  const admins = usuarios.filter(u => u.rol.toUpperCase() === 'ADMIN').length;

  const openEdit = (u: UsuarioRow) => {
    const cli = getCliente(u.id);
    setEditForm({ nombre: u.nombre, email: u.email, empresa: cli?.empresa || '', password: '' });
    setEditModal(u);
    setShowPass(false);
  };

  const handleEditSave = async () => {
    if (!editModal) return;
    setSavingEdit(true);
    setError('');
    try {
      const updates: any = { nombre: editForm.nombre, email: editForm.email };
      const { error: usrErr } = await supabase.from('usuarios').update(updates).eq('id', editModal.id);
      if (usrErr) throw usrErr;

      const cli = getCliente(editModal.id);
      if (cli) {
        await supabase.from('clientes').update({ nombre: editForm.nombre, empresa: editForm.empresa || null, email: editForm.email }).eq('id', cli.id);
      } else if (editForm.empresa) {
        await supabase.from('clientes').insert({ usuario_id: editModal.id, nombre: editForm.nombre, empresa: editForm.empresa, email: editForm.email, activo: true });
      }

      if (editForm.password.trim()) {
        try {
          await supabase.functions.invoke('admin-usuarios', { method: 'POST', body: { action: 'update_password', email: editModal.email, password: editForm.password } });
        } catch { /* edge function may not exist */ }
      }

      logAudit({ accion: 'UPDATE', tabla: 'usuarios', registro_id: editModal.id, modulo: 'Usuarios', detalles: `Usuario "${editModal.email}" actualizado: nombre="${editForm.nombre}", empresa="${editForm.empresa}"`, datos_nuevos: { nombre: editForm.nombre, email: editForm.email, empresa: editForm.empresa } });

      setUsuarios(prev => prev.map(u => u.id === editModal.id ? { ...u, nombre: editForm.nombre, email: editForm.email } : u));
      setClientes(prev => prev.map(c => c.usuario_id === editModal.id ? { ...c, nombre: editForm.nombre, empresa: editForm.empresa || null, email: editForm.email } : c));
      setSuccess('Usuario actualizado correctamente');
      setEditModal(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al actualizar'); }
    setSavingEdit(false);
  };

  const handleDeleteUser = async (usuarioId: number) => {
    setDeleteLoading(true);
    setError('');
    try {
      const usuario = usuarios.find(u => u.id === usuarioId);
      if (!usuario) return;
      const resultado = await borrarCuenta(usuario.email);
      if (!resultado.ok) { setError(resultado.mensaje || 'No se pudo borrar.'); return; }
      logAudit({ accion: 'DELETE', tabla: 'usuarios', registro_id: usuarioId, modulo: 'Admin', detalles: `Cuenta eliminada: ${usuario.email}` });
      setUsuarios(prev => prev.filter(u => u.id !== usuarioId));
      setSuccess('Usuario eliminado');
      setDeleteId(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    setDeleteLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Usuarios</h2>
          <p className="text-slate-500 text-sm mt-1">Administracion de cuentas, roles y permisos de acceso</p>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-sm p-3 mb-4 flex items-center gap-2"><X size={16} />{error}</div>}
      {success && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm p-3 mb-4 flex items-center gap-2"><CheckCircle size={16} />{success}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4"><span className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600"><Users size={20} /></span><div><p className="text-xs text-slate-500 uppercase">Total usuarios</p><p className="text-xl font-bold text-slate-800">{total}</p></div></div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4"><span className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600"><Shield size={20} /></span><div><p className="text-xs text-slate-500 uppercase">Administradores</p><p className="text-xl font-bold text-slate-800">{admins}</p></div></div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4"><span className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 text-amber-600"><Mail size={20} /></span><div><p className="text-xs text-slate-500 uppercase">Registrados</p><p className="text-xl font-bold text-slate-800">{total}</p></div></div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 mb-4 p-5 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Buscar por nombre o email..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200"><th className="text-left py-3 px-4 font-medium text-slate-500">Usuario</th><th className="text-left py-3 px-4 font-medium text-slate-500">Rol</th><th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th><th className="text-left py-3 px-4 font-medium text-slate-500">Registro</th><th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th></tr></thead>
            <tbody>
              {filtrados.map(u => {
                const cli = getCliente(u.id);
                const initials = u.nombre ? u.nombre.charAt(0).toUpperCase() : u.email.slice(0, 2).toUpperCase();
                return (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">{initials}</span>
                        <div>
                          <p className="font-medium text-slate-800">{u.nombre}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                          {cli?.empresa && <p className="text-[10px] text-slate-400">{cli.empresa}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[u.rol.toUpperCase()] || roleColors.USUARIO}`}>{u.rol}</span></td>
                    <td className="py-3 px-4"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="py-3 px-4 text-slate-500">{new Date(u.created_at).toLocaleDateString('es-ES')}</td>
                    <td className="py-3 px-4 text-right">
                      {deleteId === u.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-red-600 font-medium">Eliminar?</span>
                          <button onClick={() => handleDeleteUser(u.id)} disabled={deleteLoading} className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">{deleteLoading ? <Loader2 size={12} className="animate-spin" /> : 'Si'}</button>
                          <button onClick={() => setDeleteId(null)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200">No</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Editar usuario"><Edit3 size={16} /></button>
                          <button onClick={() => setDeleteId(u.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Eliminar"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm">No se encontraron usuarios</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">Editar Usuario</h3>
              <button onClick={() => setEditModal(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input type="text" value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Empresa</label>
                <input type="text" value={editForm.empresa} onChange={e => setEditForm(f => ({ ...f, empresa: e.target.value }))} placeholder="Nombre de la empresa" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nueva Contrasena (opcional)</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} placeholder="Dejar vacio para no cambiar" className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{showPass ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                <p>Rol: <span className="font-semibold text-slate-700">{editModal.rol}</span> (cambiar desde la tabla)</p>
                <p>Cliente ID: <span className="font-semibold text-slate-700">{getCliente(editModal.id)?.id || 'Sin vincular'}</span></p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditModal(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button onClick={handleEditSave} disabled={savingEdit || !editForm.nombre.trim() || !editForm.email.trim()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {savingEdit && <Loader2 size={14} className="animate-spin" />} Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;
