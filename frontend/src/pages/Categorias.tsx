import { useState, useEffect } from 'react';
import { Tags, Plus, Edit3, Trash2, Loader2, X } from 'lucide-react';
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

const colores = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500',
  'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500',
];

const emptyForm = { nombre: '', descripcion: '', activo: true };

export const Categorias = () => {
  const [categorias, setCategorias] = useState<CategoriaConDist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      const { data: cats } = await supabase.from('categorias').select('*').order('nombre');
      const { data: analisis } = await supabase.from('analisis_nlp').select('categoria_detectada');

      const conteo: Record<string, number> = {};
      if (analisis) {
        analisis.forEach((a: any) => {
          const cat = a.categoria_detectada;
          if (cat) conteo[cat] = (conteo[cat] || 0) + 1;
        });
      }

      if (cats) {
        const enriched = cats.map((c: any) => ({
          ...c,
          total: conteo[c.nombre] || 0,
        }));
        setCategorias(enriched);
      }
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategorias(); }, []);

  const totalAnalisis = categorias.reduce((acc, c) => acc + c.total, 0);
  const max = Math.max(...categorias.map((c) => c.total), 1);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (cat: Categoria) => {
    setEditingId(cat.id);
    setForm({ nombre: cat.nombre, descripcion: cat.descripcion, activo: cat.activo });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const { error: err } = await supabase.from('categorias').update(form).eq('id', editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('categorias').insert(form);
        if (err) throw err;
      }
      closeModal();
      fetchCategorias();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    setError('');
    try {
      const { error: err } = await supabase.from('categorias').delete().eq('id', id);
      if (err) throw err;
      fetchCategorias();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Categorías NLP</h2>
          <p className="text-slate-500 text-sm mt-1">Gestión de categorías de análisis de sentimiento</p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          onClick={openCreate}
        >
          <Plus size={16} /> Nueva Categoría
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Total Categorías</span>
            <Tags size={18} className="text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{categorias.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Activas</span>
            <Tags size={18} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{categorias.filter((c) => c.activo).length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Total Análisis</span>
            <Tags size={18} className="text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{totalAnalisis}</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : categorias.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Tags size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No hay categorías registradas</p>
          <p className="text-sm text-slate-400 mt-1">Crea una nueva categoría para comenzar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorias.map((cat, i) => {
            const pct = totalAnalisis > 0 ? Math.round((cat.total / totalAnalisis) * 100) : 0;
            const barW = (cat.total / max) * 100;
            const colorClass = colores[i % colores.length];
            return (
              <div key={cat.id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${colorClass}`} />
                    <h4 className="font-semibold text-slate-700">{cat.nombre}</h4>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                      onClick={() => openEdit(cat)}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      onClick={() => handleDelete(cat.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {cat.descripcion && (
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2">{cat.descripcion}</p>
                )}
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>Distribución</span>
                  <span className="font-medium text-slate-700">{cat.total} ({pct}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${colorClass}`}
                    style={{ width: `${barW}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${cat.activo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="text-xs text-slate-500">{cat.activo ? 'Activa' : 'Inactiva'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
                <input
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Soporte técnico"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Descripción breve de la categoría..."
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="activo" className="text-sm text-slate-600">Activa</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                onClick={closeModal}
              >
                Cancelar
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                onClick={handleSubmit}
                disabled={saving || !form.nombre.trim()}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editingId ? 'Guardar cambios' : 'Crear categoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categorias;
