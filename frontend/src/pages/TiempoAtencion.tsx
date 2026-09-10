import { useState, useEffect, useMemo } from 'react';
import { Clock, Plus, Edit3, Trash2, Loader2, X, Search, Filter, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';

interface TiempoRow {
  id: number;
  cliente_id: number | null;
  comentario_id: number | null;
  tiempo_minutos: number;
  fecha: string;
  operador: string | null;
  created_at: string;
  clientes?: { nombre: string; empresa: string } | null;
}

interface ClienteOption { id: number; nombre: string; }

const SLA_MINUTOS = 30;
const COLORS = ['#059669', '#dc2626'];
const emptyForm = { cliente_id: '', tiempo_minutos: '', fecha: new Date().toISOString().split('T')[0], operador: '' };

export const TiempoAtencion = () => {
  const { canEdit } = useAuth();
  const [datos, setDatos] = useState<TiempoRow[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<TiempoRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCumple, setFiltroCumple] = useState<'todos' | 'cumple' | 'excede'>('todos');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [tiemposRes, clientesRes] = await Promise.all([
      supabase.from('tiempos_atencion').select('*, clientes(nombre, empresa)').order('fecha', { ascending: false }),
      supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    ]);
    if (tiemposRes.data) setDatos(tiemposRes.data as unknown as TiempoRow[]);
    if (clientesRes.data) setClientes(clientesRes.data);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const total = datos.length;
    const promedio = total > 0 ? Math.round(datos.reduce((s, d) => s + Number(d.tiempo_minutos), 0) / total) : 0;
    const cumple = datos.filter(d => Number(d.tiempo_minutos) <= SLA_MINUTOS).length;
    const pctCumple = total > 0 ? Math.round((cumple / total) * 100) : 0;
    const menor = total > 0 ? Math.min(...datos.map(d => Number(d.tiempo_minutos))) : 0;
    const mayor = total > 0 ? Math.max(...datos.map(d => Number(d.tiempo_minutos))) : 0;
    return { total, promedio, cumple, pctCumple, menor, mayor };
  }, [datos]);

  const chartData = useMemo(() => {
    const porOperador: Record<string, { total: number; suma: number }> = {};
    datos.forEach(d => {
      const op = d.operador || 'Sin operador';
      if (!porOperador[op]) porOperador[op] = { total: 0, suma: 0 };
      porOperador[op].total++;
      porOperador[op].suma += Number(d.tiempo_minutos);
    });
    return Object.entries(porOperador).map(([name, v]) => ({
      name, registros: v.total, promedio: Math.round(v.suma / v.total),
    })).sort((a, b) => b.registros - a.registros).slice(0, 8);
  }, [datos]);

  const slaPieData = [
    { name: 'Cumple SLA', value: stats.cumple, color: '#059669' },
    { name: 'Excede SLA', value: stats.total - stats.cumple, color: '#dc2626' },
  ];

  const filtrados = datos.filter(d => {
    const matchBusq = `${d.clientes?.nombre || ''} ${d.operador || ''}`.toLowerCase().includes(busqueda.toLowerCase());
    const tiempo = Number(d.tiempo_minutos);
    const matchFiltro = filtroCumple === 'todos' || (filtroCumple === 'cumple' && tiempo <= SLA_MINUTOS) || (filtroCumple === 'excede' && tiempo > SLA_MINUTOS);
    return matchBusq && matchFiltro;
  });

  const openCreate = () => { setEditando(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (d: TiempoRow) => {
    setEditando(d);
    setForm({ cliente_id: d.cliente_id?.toString() || '', tiempo_minutos: d.tiempo_minutos.toString(), fecha: d.fecha?.split('T')[0] || '', operador: d.operador || '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditando(null); setForm(emptyForm); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        tiempo_minutos: parseFloat(form.tiempo_minutos),
        fecha: form.fecha,
        operador: form.operador || null,
      };
      if (editando) {
        const { error: err } = await supabase.from('tiempos_atencion').update(payload).eq('id', editando.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('tiempos_atencion').insert(payload);
        if (err) throw err;
      }
      closeModal();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este registro?')) return;
    const { error } = await supabase.from('tiempos_atencion').delete().eq('id', id);
    if (!error) fetchData();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tiempos de Atencion</h2>
          <p className="text-slate-500 text-sm mt-1">Control de tiempos de respuesta (SLA: {SLA_MINUTOS} min)</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
            <Plus size={16} /> Nuevo Registro
          </button>
        )}
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 mb-4 flex items-center gap-2"><X size={14} />{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total', valor: stats.total, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Promedio', valor: `${stats.promedio}m`, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Cumple SLA', valor: `${stats.pctCumple}%`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Minimo', valor: `${stats.menor}m`, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Maximo', valor: `${stats.mayor}m`, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}><Clock size={20} /></span>
            <div><p className="text-xs text-slate-500 uppercase">{k.label}</p><p className="text-xl font-bold text-slate-800">{k.valor}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="mb-4 font-semibold text-slate-700 flex items-center gap-2"><BarChart3 size={16} className="text-blue-600" /> Tiempo por Operador</h3>
          {chartData.length === 0 ? <div className="h-48 flex items-center justify-center text-sm text-slate-400">Sin datos</div> : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="promedio" name="Promedio (min)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="mb-4 font-semibold text-slate-700 flex items-center gap-2"><BarChart3 size={16} className="text-emerald-600" /> Cumplimiento SLA</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slaPieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                  {slaPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 p-5 border-b border-slate-100">
          <Clock size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700">Registros</h3>
          <div className="relative flex-1 max-w-sm ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Buscar por cliente u operador..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-slate-400" />
            {(['todos', 'cumple', 'excede'] as const).map(f => (
              <button key={f} onClick={() => setFiltroCumple(f)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${filtroCumple === f ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {f === 'todos' ? 'Todos' : f === 'cumple' ? 'Cumple' : 'Excede'}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Tiempo</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">SLA</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Operador</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha</th>
                  {canEdit && <th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">No hay registros</td></tr>
                ) : filtrados.map(d => {
                  const tiempo = Number(d.tiempo_minutos);
                  const cumple = tiempo <= SLA_MINUTOS;
                  return (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{d.clientes?.nombre || 'Sin cliente'}</p>
                        {d.clientes?.empresa && <p className="text-xs text-slate-400">{d.clientes.empresa}</p>}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{tiempo} min</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${cumple ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {cumple ? 'Cumple' : 'Excede'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{d.operador || '—'}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">{d.fecha ? new Date(d.fecha).toLocaleDateString('es-ES') : '—'}</td>
                      {canEdit && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Edit3 size={14} /></button>
                            <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">{editando ? 'Editar Registro' : 'Nuevo Registro'}</h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">Sin cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo (minutos) *</label>
                <input type="number" step="0.01" required value={form.tiempo_minutos} onChange={e => setForm(f => ({ ...f, tiempo_minutos: e.target.value }))}
                  placeholder="Ej: 25" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha *</label>
                <input type="date" required value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Operador</label>
                <input value={form.operador} onChange={e => setForm(f => ({ ...f, operador: e.target.value }))}
                  placeholder="Nombre del operador" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
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

export default TiempoAtencion;
