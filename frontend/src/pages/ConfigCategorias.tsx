import { useState, useEffect } from 'react';
import { Settings, Plus, Edit3, Trash2, CheckCircle2, X } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export const ConfigCategorias = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nombre');

    if (!error && data) {
      setCategorias(data as Categoria[]);
    }
    setLoading(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ nombre: '', descripcion: '' });
    setShowModal(true);
  };

  const openEdit = (cat: Categoria) => {
    setEditingId(cat.id);
    setForm({ nombre: cat.nombre, descripcion: cat.descripcion });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setError('');

    try {
      if (editingId) {
        const { error: err } = await supabase
          .from('categorias')
          .update({ nombre: form.nombre, descripcion: form.descripcion })
          .eq('id', editingId);
        if (err) throw err;
        showToast('Categoría actualizada correctamente');
      } else {
        const { error: err } = await supabase
          .from('categorias')
          .insert({ nombre: form.nombre, descripcion: form.descripcion, activo: true });
        if (err) throw err;
        showToast('Categoría creada correctamente');
      }
      fetchCategorias();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setShowModal(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError('');
    try {
      const { error: err } = await supabase.from('categorias').delete().eq('id', id);
      if (err) throw err;
      showToast('Categoría eliminada');
      fetchCategorias();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const toggleActivo = async (id: number, current: boolean) => {
    const { error } = await supabase
      .from('categorias')
      .update({ activo: !current })
      .eq('id', id);
    if (!error) fetchCategorias();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Categorías del Sistema</h2>
          <p className="text-slate-500 text-sm mt-1">Gestión de categorías para clasificación de comentarios</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25"
        >
          <Plus size={16} />
          Nueva Categoría
        </button>
      </div>

      {toast && (
        <div className="flex items-center gap-2 px-4 py-3 mb-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm animate-[fadeIn_0.3s_ease]">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700">Categorías Existentes</h3>
          </div>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
            {categorias.length} categorías
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Nombre</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Descripción</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((cat) => (
                  <tr key={cat.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-800">{cat.nombre}</td>
                    <td className="py-3 px-4 text-slate-500">{cat.descripcion}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleActivo(cat.id, cat.activo)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          cat.activo
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {cat.activo ? 'Activa' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(cat)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {categorias.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 text-sm">
                      No hay categorías creadas. Haz clic en "Nueva Categoría" para comenzar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Soporte"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción de la categoría"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-500 hover:to-indigo-500 transition-all"
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigCategorias;
