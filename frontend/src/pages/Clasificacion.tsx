import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Network, Filter, TrendingUp, CheckCircle2, Loader2, Edit3 } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';

interface ClasRow {
  id: number;
  contenido: string;
  canal: string;
  estado: string;
  fecha: string;
  categoria: string | null;
  analisis_nlp?: { categoria_detectada: string; confianza: number; idioma: string } | null;
}

interface CatDB { id: number; nombre: string; activo: boolean; }

const defaultColors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#94a3b8', '#ec4899'];

export const Clasificacion = () => {
  const { canEdit } = useAuth();
  const [comentarios, setComentarios] = useState<ClasRow[]>([]);
  const [categoriasDB, setCategoriasDB] = useState<CatDB[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [comRes, catRes] = await Promise.all([
      supabase.from('comentarios').select('id, contenido, canal, estado, fecha, categoria, analisis_nlp(categoria_detectada, confianza, idioma)').order('fecha', { ascending: false }),
      supabase.from('categorias').select('id, nombre, activo').eq('activo', true),
    ]);
    if (comRes.data) setComentarios(comRes.data as unknown as ClasRow[]);
    if (catRes.data) setCategoriasDB(catRes.data as CatDB[]);
    setLoading(false);
  };

  const getCategoria = (c: ClasRow) => c.analisis_nlp?.categoria_detectada || c.categoria || 'Sin categoría';

  const reclassify = async (comentarioId: number, nuevaCategoria: string) => {
    await supabase.from('comentarios').update({ categoria: nuevaCategoria }).eq('id', comentarioId);
    setEditId(null);
    fetchData();
  };

  const categorias: Record<string, { total: number }> = {};
  comentarios.forEach((c) => {
    const cat = getCategoria(c);
    if (!categorias[cat]) categorias[cat] = { total: 0 };
    categorias[cat].total++;
  });

  const listaCategorias = Object.entries(categorias).sort((a, b) => b[1].total - a[1].total);
  const total = comentarios.length;
  const max = listaCategorias.length > 0 ? Math.max(...listaCategorias.map(([, v]) => v.total)) : 1;

  const donutData = listaCategorias.map(([nombre, v], i) => ({
    name: nombre, value: v.total, color: defaultColors[i % defaultColors.length],
  }));

  const filtrados = filtroCategoria === 'Todos' ? comentarios : comentarios.filter((c) => getCategoria(c) === filtroCategoria);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Clasificación</h2>
          <p className="text-slate-500 text-sm mt-1">Clasificación de comentarios por categoría</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase">Total</span>
            <Network size={18} className="text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase">Categorías</span>
            <TrendingUp size={18} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{listaCategorias.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase">Procesados</span>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-emerald-600">{comentarios.filter((c) => c.estado !== 'pendiente').length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700">Distribución</h3>
          </div>
          {loading ? (
            <div className="h-60 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : donutData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-sm text-slate-400">Sin datos</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Network size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700">Categorías</h3>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {listaCategorias.map(([nombre, stats], i) => {
              const color = defaultColors[i % defaultColors.length];
              const barW = (stats.total / max) * 100;
              return (
                <button key={nombre} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${filtroCategoria === nombre ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`} onClick={() => setFiltroCategoria(filtroCategoria === nombre ? 'Todos' : nombre)}>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-sm text-slate-700 flex-1 truncate">{nombre}</span>
                  <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0"><div className="h-full rounded-full" style={{ width: `${barW}%`, background: color }} /></div>
                  <span className="text-sm font-medium text-slate-600 w-8 text-right">{stats.total}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-700">Detalle</h3>
          <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">{filtroCategoria}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Fecha</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Canal</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Comentario</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Categoría</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Confianza</th>
                {canEdit && <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const cat = getCategoria(c);
                return (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{new Date(c.fecha).toLocaleDateString('es-ES')}</td>
                    <td className="py-3 px-4"><span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full capitalize">{c.canal}</span></td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{c.contenido}</td>
                    <td className="py-3 px-4">
                      {editId === c.id && canEdit ? (
                        <select autoFocus defaultValue={cat} onChange={e => reclassify(c.id, e.target.value)}
                          className="px-2 py-1 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                          {categoriasDB.map(cat => <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>)}
                        </select>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full font-medium bg-blue-50 text-blue-700">{cat}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{c.analisis_nlp?.confianza != null ? `${(c.analisis_nlp.confianza * 100).toFixed(0)}%` : '—'}</td>
                    {canEdit && (
                      <td className="py-3 px-4 text-right">
                        <button onClick={() => setEditId(editId === c.id ? null : c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                          <Edit3 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtrados.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">No hay comentarios</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Clasificacion;
