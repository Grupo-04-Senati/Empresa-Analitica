import { useState, useEffect } from 'react';
import { Tags, Loader2, Plus, Edit3, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

interface CategoriaConDist extends Categoria {
  total: number;
}

const ML_COLORS: Record<string, string> = {
  FELICITACION: 'bg-emerald-500',
  RECLAMO: 'bg-red-500',
  SOPORTE: 'bg-blue-500',
  VENTAS: 'bg-amber-500',
  CONSULTA: 'bg-slate-400',
};

const ML_LABELS: Record<string, string> = {
  FELICITACION: 'Felicitacion',
  RECLAMO: 'Reclamo',
  SOPORTE: 'Soporte Tecnico',
  VENTAS: 'Ventas / Facturacion',
  CONSULTA: 'Consulta General',
};

const colores = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-slate-400', 'bg-purple-500', 'bg-pink-500'];

const emptyForm = { nombre: '', descripcion: '' };

export const Categorias = () => {
  const [categorias, setCategorias] = useState<CategoriaConDist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      const { data: cats } = await supabase.from('categorias').select('*').order('nombre');
      const { data: analisis } = await supabase.from('analisis_nlp').select('categoria_detectada');
      const conteo: Record<string, number> = {};
      if (analisis) analisis.forEach((a: any) => { if (a.categoria_detectada) conteo[a.categoria_detectada] = (conteo[a.categoria_detectada] || 0) + 1; });
      if (cats) setCategorias(cats.map((c: any) => ({ ...c, total: conteo[c.nombre] || 0 })));
    } catch { /* empty */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchCategorias(); }, []);
  useEffect(() => {
    const channel = supabase.channel('categorias-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'categorias' }, fetchCategorias).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalAnalisis = categorias.reduce((acc, c) => acc + c.total, 0);
  const max = Math.max(...categorias.map((c) => c.total), 1);

  const openCreate = () => { setEditando(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (cat: Categoria) => { setEditando(cat); setForm({ nombre: cat.nombre, descripcion: cat.descripcion }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditando(null); setForm(emptyForm); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editando) {
        const { error: err } = await supabase.from('categorias').update({ nombre: form.nombre.toUpperCase(), descripcion: form.descripcion }).eq('id', editando.id);
        if (err) throw err;
        setToast('Categoria actualizada');
      } else {
        const { error: err } = await supabase.from('categorias').insert({ nombre: form.nombre.toUpperCase(), descripcion: form.descripcion, activo: true });
        if (err) throw err;
        setToast('Categoria creada');
      }
      fetchCategorias();
      setTimeout(() => setToast(''), 3000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
    closeModal();
    setSaving(false);
  };

  const toggleActivo = async (id: number, current: boolean) => {
    const { error } = await supabase.from('categorias').update({ activo: !current }).eq('id', id);
    if (!error) fetchCategorias();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Categorias ML</h2>
          <p className="text-slate-500 text-sm mt-1">Categorias determinadas automaticamente por Machine Learning</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25">
          <Plus size={16} /> Nueva Categoria
        </button>
      </div>

      {toast && <div className="flex items-center gap-2 px-4 py-3 mb-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm"><CheckCircle2 size={16} /> {toast}</div>}
      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-500 uppercase">Total Categorias</span><Tags size={18} className="text-blue-500" /></div><p className="text-3xl font-bold text-slate-800">{categorias.length}</p></div>
        <div className="bg-white rounded-xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-500 uppercase">Activas</span><Tags size={18} className="text-emerald-500" /></div><p className="text-3xl font-bold text-slate-800">{categorias.filter(c => c.activo).length}</p></div>
        <div className="bg-white rounded-xl shadow-sm p-5"><div className="flex items-center justify-between mb-2"><span className="text-xs text-slate-500 uppercase">Total Analisis</span><Tags size={18} className="text-amber-500" /></div><p className="text-3xl font-bold text-slate-800">{totalAnalisis}</p></div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : categorias.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center"><Tags size={40} className="text-slate-300 mx-auto mb-3" /><p className="text-slate-500 font-medium">No hay categorias</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorias.map((cat, i) => {
            const pct = totalAnalisis > 0 ? Math.round((cat.total / totalAnalisis) * 100) : 0;
            const barW = (cat.total / max) * 100;
            const colorClass = ML_COLORS[cat.nombre] || colores[i % colores.length];
            const label = ML_LABELS[cat.nombre] || cat.nombre;
            return (
              <div key={cat.id} className="bg-white rounded-xl shadow-sm p-5 relative group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${colorClass}`} />
                    <h4 className="font-semibold text-slate-700">{label}</h4>
                  </div>
                  <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100" title="Editar">
                    <Edit3 size={14} />
                  </button>
                </div>
                {cat.descripcion && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{cat.descripcion}</p>}
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5"><span>Distribucion</span><span className="font-medium text-slate-700">{cat.total} ({pct}%)</span></div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${barW}%` }} /></div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => toggleActivo(cat.id, cat.activo)} className={`w-1.5 h-1.5 rounded-full transition-colors ${cat.activo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className="text-xs text-slate-500">{cat.activo ? 'Activa' : 'Inactiva'}</span>
                  </div>
                  <button onClick={() => toggleActivo(cat.id, cat.activo)} className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition ${cat.activo ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {cat.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">{editando ? 'Editar Categoria' : 'Nueva Categoria'}</h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: SOPORTE" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripcion</label>
                <input type="text" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripcion de la categoria" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving || !form.nombre.trim()} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
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

export default Categorias;
