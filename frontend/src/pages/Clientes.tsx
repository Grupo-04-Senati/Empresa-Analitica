import { useState, useEffect, useMemo } from 'react';
import { Users, Search, Plus, Edit3, Building2, Mail, Phone, X, Loader2, BarChart3, Trash2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';

interface ClienteDB {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626'];
const emptyForm = { nombre: '', email: '', telefono: '', empresa: '' };

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

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setClientes(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClientes(); }, []);

  const activos = clientes.filter(c => c.activo).length;
  const inactivos = clientes.length - activos;
  const empresas = [...new Set(clientes.map(c => c.empresa).filter(Boolean))].length;

  const filtrados = clientes.filter(c => {
    if (filtroEstado === 'activo' && !c.activo) return false;
    if (filtroEstado === 'inactivo' && c.activo) return false;
    const q = busqueda.toLowerCase();
    return c.nombre.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || (c.empresa || '').toLowerCase().includes(q);
  });

  const chartData = useMemo(() => {
    const porEmpresa: Record<string, number> = {};
    clientes.forEach(c => { const e = c.empresa || 'Sin empresa'; porEmpresa[e] = (porEmpresa[e] || 0) + 1; });
    return Object.entries(porEmpresa).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [clientes]);

  const estadoData = [
    { name: 'Activos', value: activos, color: '#059669' },
    { name: 'Inactivos', value: inactivos, color: '#94a3b8' },
  ];

  const openCreate = () => { setEditando(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c: ClienteDB) => {
    setEditando(c);
    setForm({ nombre: c.nombre, email: c.email || '', telefono: c.telefono || '', empresa: c.empresa || '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditando(null); setForm(emptyForm); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editando) {
        const { error: err } = await supabase.from('clientes').update({
          nombre: form.nombre, email: form.email || null, telefono: form.telefono || null,
          empresa: form.empresa || null, updated_at: new Date().toISOString(),
        }).eq('id', editando.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('clientes').insert({
          nombre: form.nombre, email: form.email || null, telefono: form.telefono || null,
          empresa: form.empresa || null, activo: true,
        });
        if (err) throw err;
      }
      closeModal();
      fetchClientes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (c: ClienteDB) => {
    if (!confirm(c.activo ? '¿Desactivar este cliente?' : '¿Reactivar este cliente?')) return;
    const { error } = await supabase.from('clientes').update({ activo: !c.activo, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (!error) fetchClientes();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este cliente permanentemente?')) return;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (!error) fetchClientes();
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
            <p className="mt-1 text-sm text-slate-500">Gestion de la cartera de clientes del call center</p>
          </div>
          {canEdit && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700">
              <Plus size={16} /> Nuevo Cliente
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-500 text-sm">
            <X size={14} className="shrink-0" /> {error}
            <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
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
            <p className="mt-2 text-2xl font-bold text-emerald-600">{activos}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Inactivos</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Users size={18} /></span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-500">{inactivos}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Empresas</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600"><Building2 size={18} /></span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{empresas}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-slate-700 flex items-center gap-2"><BarChart3 size={16} className="text-blue-600" /> Clientes por Empresa</h3>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-slate-400">Sin datos</div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-slate-700 flex items-center gap-2"><BarChart3 size={16} className="text-emerald-600" /> Estado de Clientes</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={estadoData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                    {estadoData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input placeholder="Buscar por nombre, empresa o email..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none">
              <option value="todos">Todos</option>
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
                  <tr><td colSpan={canEdit ? 7 : 6} className="px-5 py-12 text-center text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin" size={24} /> Cargando...</td></tr>
                ) : filtrados.length === 0 ? (
                  <tr><td colSpan={canEdit ? 7 : 6} className="px-5 py-12 text-center text-slate-400">No se encontraron clientes</td></tr>
                ) : filtrados.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{c.nombre}</td>
                    <td className="px-5 py-3 text-slate-600"><span className="inline-flex items-center gap-1.5"><Mail size={14} className="text-slate-400" />{c.email || '—'}</span></td>
                    <td className="px-5 py-3 text-slate-600"><span className="inline-flex items-center gap-1.5"><Phone size={14} className="text-slate-400" />{c.telefono || '—'}</span></td>
                    <td className="px-5 py-3 text-slate-600"><span className="inline-flex items-center gap-1.5"><Building2 size={14} className="text-slate-400" />{c.empresa || '—'}</span></td>
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
                          <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600" title="Editar"><Edit3 size={15} /></button>
                          <button onClick={() => handleToggleActive(c)} className={`rounded-lg p-1.5 transition text-xs font-semibold ${c.activo ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-600' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}>
                            {c.activo ? 'Desact.' : 'Activar'}
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600" title="Eliminar"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{editando ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button onClick={closeModal} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nombre *</label>
                  <input required value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Juan Perez"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Empresa</label>
                  <input value={form.empresa} onChange={e => set('empresa', e.target.value)} placeholder="Ej: Empresa ABC"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@empresa.com"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Telefono</label>
                <input value={form.telefono} onChange={e => set('telefono', e.target.value.replace(/[^0-9]/g, '').slice(0, 9))} placeholder="999888777" maxLength={9}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving && <Loader2 size={14} className="animate-spin" />} {editando ? 'Guardar' : 'Crear'}
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
