import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit3,
  Building2,
  Mail,
  Phone,
  X,
  Loader2,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';

interface ClienteDB {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  activo: boolean;
  rol: string;
  created_at: string;
  updated_at: string;
}

const emptyForm = { nombre: '', email: '', password: '', telefono: '', empresa: '' };

export const Clientes = () => {
  const { canEdit } = useAuth();
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<ClienteDB | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('usuarios')
        .select('*')
        .in('rol', ['USUARIO', 'usuario'])
        .order('created_at', { ascending: false });
      if (err) throw err;
      setClientes(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const activos = clientes.filter((c) => c.activo).length;
  const inactivos = clientes.length - activos;

  const filtrados = clientes.filter((c) => {
    if (filtroEstado === 'activo' && !c.activo) return false;
    if (filtroEstado === 'inactivo' && c.activo) return false;
    const q = busqueda.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.empresa || '').toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditando(null);
    setForm(emptyForm);
    setShowPassword(true);
    setShowModal(true);
  };

  const openEdit = (c: ClienteDB) => {
    setEditando(c);
    setForm({ nombre: c.nombre, email: c.email, password: '', telefono: c.telefono || '', empresa: c.empresa || '' });
    setShowPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditando(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editando) {
        const updates: Record<string, unknown> = {
          nombre: form.nombre,
          telefono: form.telefono || null,
          empresa: form.empresa || null,
          updated_at: new Date().toISOString(),
        };
        const { error: err } = await supabase.from('usuarios').update(updates).eq('id', editando.id);
        if (err) throw err;
      } else {
        if (!form.password || form.password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setSaving(false);
          return;
        }
        const { error: authErr } = await supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          options: { data: { nombre: form.nombre.trim(), rol: 'USUARIO' } },
        });
        if (authErr && !authErr.message.includes('already registered')) {
          setError('Error creando cuenta: ' + authErr.message);
          setSaving(false);
          return;
        }
        const existingUser = await supabase.from('usuarios').select('id').eq('email', form.email.trim().toLowerCase()).maybeSingle();
        if (existingUser.data) {
          setError('Ya existe un usuario con este correo');
          setSaving(false);
          return;
        }
        const { error: dbErr } = await supabase.from('usuarios').insert({
          nombre: form.nombre.trim(),
          email: form.email.trim().toLowerCase(),
          password_hash: 'auth_managed',
          rol: 'USUARIO',
          activo: true,
          telefono: form.telefono || null,
          empresa: form.empresa || null,
        });
        if (dbErr) throw dbErr;
        try { await supabase.auth.signOut(); } catch {}
      }
      closeModal();
      fetchClientes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (c: ClienteDB) => {
    const nuevoEstado = !c.activo;
    const accionText = nuevoEstado ? 'reactivar' : 'desactivar';
    if (!confirm(`¿Deseas ${accionText} a este cliente?`)) return;
    setError('');
    try {
      const { error: err } = await supabase.from('usuarios').update({ activo: nuevoEstado, updated_at: new Date().toISOString() }).eq('id', c.id);
      if (err) throw err;
      fetchClientes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
            <p className="mt-1 text-sm text-slate-500">Gestion y seguimiento de la cartera de clientes</p>
          </div>
          {canEdit && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700">
              <Plus size={16} />
              Nuevo Cliente
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-500 text-sm">
            <X size={14} className="shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Total Clientes</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Users size={18} /></span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{clientes.length}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Activos</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Users size={18} /></span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{activos}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Inactivos</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Users size={18} /></span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{inactivos}</p>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input placeholder="Buscar por nombre, empresa o email..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
              <option value="todos">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Nombre</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Telefono</th>
                  <th className="px-5 py-3">Empresa</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Creado</th>
                  {canEdit && <th className="px-5 py-3 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="px-5 py-12 text-center text-slate-400">
                      <Loader2 className="mx-auto mb-2 animate-spin" size={24} />
                      Cargando clientes...
                    </td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="px-5 py-12 text-center text-slate-400">
                      No se encontraron clientes
                    </td>
                  </tr>
                ) : (
                  filtrados.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className="font-medium text-slate-900">{c.nombre}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Mail size={14} className="text-slate-400" />
                          {c.email}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Phone size={14} className="text-slate-400" />
                          {c.telefono || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Building2 size={14} className="text-slate-400" />
                          {c.empresa || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      {canEdit && (
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600" title="Editar cliente">
                              <Edit3 size={16} />
                            </button>
                            <button onClick={() => handleToggleActive(c)} className={`rounded-lg p-1.5 transition ${c.activo ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-600' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`} title={c.activo ? 'Desactivar' : 'Reactivar'}>
                              <span className="text-xs font-semibold">{c.activo ? 'Desactivar' : 'Activar'}</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900">{editando ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              </div>
              <button onClick={closeModal} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nombre completo</label>
                  <input required value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej: Ana Torres" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Empresa</label>
                  <input value={form.empresa} onChange={(e) => set('empresa', e.target.value)} placeholder="Ej: Empresa ABC S.A." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Correo electronico</label>
                <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="correo@empresa.com" disabled={!!editando} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400" />
              </div>
              {!editando && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Contrasena</label>
                  <div className="relative">
                    <input required type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Minimo 6 caracteres" minLength={6} className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">El cliente usara este correo y contrasena para iniciar sesion</p>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Telefono</label>
                <input value={form.telefono} onChange={(e) => set('telefono', e.target.value.replace(/[^0-9]/g, '').slice(0, 9))} placeholder="999888777" maxLength={9} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editando ? 'Guardar Cambios' : 'Registrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;
