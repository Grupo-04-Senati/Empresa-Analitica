import { useState, useEffect } from 'react';
import { Rocket, Zap, TrendingUp, Plus, Edit3, Trash2, Loader2, X, Search } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';

interface OptimRow {
  id: number;
  nombre: string;
  descripcion: string | null;
  parametros_entrada: unknown;
  resultado: unknown;
  costo_inicial: number | null;
  costo_optimizado: number | null;
  estado: string;
  created_at: string;
}

const emptyForm = { nombre: '', descripcion: '', costo_inicial: '', costo_optimizado: '', estado: 'pendiente', parametros_entrada: '{}' };

export const Optimizacion = () => {
  const { canEdit } = useAuth();
  const [datos, setDatos] = useState<OptimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<OptimRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('optimizaciones')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setDatos((data || []) as OptimRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditando(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (d: OptimRow) => {
    setEditando(d);
    setForm({
      nombre: d.nombre,
      descripcion: d.descripcion || '',
      costo_inicial: d.costo_inicial?.toString() || '',
      costo_optimizado: d.costo_optimizado?.toString() || '',
      estado: d.estado,
      parametros_entrada: JSON.stringify(d.parametros_entrada || {}, null, 2),
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditando(null); setForm(emptyForm); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        costo_inicial: form.costo_inicial ? parseFloat(form.costo_inicial) : null,
        costo_optimizado: form.costo_optimizado ? parseFloat(form.costo_optimizado) : null,
        estado: form.estado,
        parametros_entrada: JSON.parse(form.parametros_entrada || '{}'),
      };
      if (editando) {
        const { error: err } = await supabase.from('optimizaciones').update(payload).eq('id', editando.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('optimizaciones').insert(payload);
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
    if (!confirm('¿Eliminar esta optimización?')) return;
    const { error: err } = await supabase.from('optimizaciones').delete().eq('id', id);
    if (!err) fetchData();
  };

  const handleStatusChange = async (id: number, nuevoEstado: string) => {
    const { error } = await supabase.from('optimizaciones').update({ estado: nuevoEstado }).eq('id', id);
    if (!error) fetchData();
  };

  const filtrados = datos.filter(d => `${d.nombre} ${d.descripcion || ''}`.toLowerCase().includes(busqueda.toLowerCase()));
  const totalOptimizaciones = datos.length;
  const completadas = datos.filter((d) => d.estado === 'completado').length;
  const ahorroTotal = datos.reduce((s, d) => s + ((d.costo_inicial || 0) - (d.costo_optimizado || 0)), 0);

  const kpis = [
    { label: 'Total', valor: totalOptimizaciones.toString(), icono: Rocket, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Completadas', valor: completadas.toString(), icono: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Ahorro Total', valor: ahorroTotal > 0 ? `$${ahorroTotal.toFixed(2)}` : '—', icono: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const estadoColors: Record<string, string> = {
    completado: 'bg-emerald-100 text-emerald-700',
    pendiente: 'bg-amber-100 text-amber-700',
    en_proceso: 'bg-blue-100 text-blue-700',
    error: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Optimización</h2>
          <p className="text-slate-500 text-sm mt-1">Gestión de optimizaciones y mejoras de rendimiento</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
            <Plus size={16} /> Nueva Optimización
          </button>
        )}
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpis.map((k) => {
          const Icon = k.icono;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
              <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}><Icon size={20} /></span>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p>
                <p className="text-xl font-bold text-slate-800">{k.valor}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="flex items-center gap-3 p-5 border-b border-slate-100">
          <Rocket size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700">Historial</h3>
          <div className="relative flex-1 max-w-sm ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
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
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Nombre</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Descripción</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Costo Inicial</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Costo Optimizado</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Ahorro</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha</th>
                  {canEdit && <th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-slate-400">No hay optimizaciones</td></tr>
                ) : filtrados.map((d) => {
                  const ahorro = (d.costo_inicial || 0) - (d.costo_optimizado || 0);
                  return (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-800">{d.nombre}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{d.descripcion || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">{d.costo_inicial != null ? `$${d.costo_inicial.toFixed(2)}` : '—'}</td>
                      <td className="py-3 px-4 text-slate-600">{d.costo_optimizado != null ? `$${d.costo_optimizado.toFixed(2)}` : '—'}</td>
                      <td className="py-3 px-4 font-medium text-emerald-600">{ahorro > 0 ? `$${ahorro.toFixed(2)}` : '—'}</td>
                      <td className="py-3 px-4">
                        {canEdit ? (
                          <select value={d.estado} onChange={e => handleStatusChange(d.id, e.target.value)}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs focus:outline-none">
                            <option value="pendiente">Pendiente</option>
                            <option value="en_proceso">En Proceso</option>
                            <option value="completado">Completado</option>
                            <option value="error">Error</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColors[d.estado] || 'bg-slate-100 text-slate-600'}`}>{d.estado}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">{new Date(d.created_at).toLocaleDateString('es-ES')}</td>
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">{editando ? 'Editar Optimización' : 'Nueva Optimización'}</h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Optimización de rutas" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2}
                  placeholder="Descripción de la optimización" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Costo Inicial ($)</label>
                  <input type="number" step="0.01" value={form.costo_inicial} onChange={e => setForm(f => ({ ...f, costo_inicial: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Costo Optimizado ($)</label>
                  <input type="number" step="0.01" value={form.costo_optimizado} onChange={e => setForm(f => ({ ...f, costo_optimizado: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En Proceso</option>
                  <option value="completado">Completado</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parámetros (JSON)</label>
                <textarea value={form.parametros_entrada} onChange={e => setForm(f => ({ ...f, parametros_entrada: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editando ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Optimizacion;
