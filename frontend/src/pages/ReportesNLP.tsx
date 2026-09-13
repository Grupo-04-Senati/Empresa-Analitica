import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FileBarChart, BrainCircuit, Download, TrendingUp, Hash, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

const SENT_COLORS = ['#059669', '#d97706', '#dc2626'];

interface AnalisisRow {
  id: number;
  comentario_id: number | null;
  categoria_detectada: string | null;
  confianza: number | null;
  comentarios?: { contenido: string; clientes?: { nombre: string } | null } | null;
}

export const ReportesNLP = () => {
  const [analisis, setAnalisis] = useState<AnalisisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('analisis_nlp')
        .select('id, comentario_id, categoria_detectada, confianza, comentarios(contenido, clientes(nombre))')
        .order('fecha_analisis', { ascending: false });
      if (err) { setError(err.message); setLoading(false); return; }
      setAnalisis((data || []) as unknown as AnalisisRow[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const categoriasMap = new Map<string, number>();
  let confianzaSuma = 0;
  let confianzaCount = 0;

  analisis.forEach((a) => {
    const cat = a.categoria_detectada || 'Sin categoría';
    categoriasMap.set(cat, (categoriasMap.get(cat) || 0) + 1);
    if (a.confianza != null) { confianzaSuma += a.confianza; confianzaCount++; }
  });

  const confianzaProm = confianzaCount > 0 ? Math.round(confianzaSuma / confianzaCount) : 0;
  const catData = Array.from(categoriasMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const kpis = [
    { label: 'Analizados', valor: analisis.length.toString(), icono: BrainCircuit, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Confianza prom.', valor: confianzaProm > 0 ? `${confianzaProm}%` : '—', icono: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Categorías', valor: categoriasMap.size.toString(), icono: Hash, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Registros', valor: analisis.length.toString(), icono: FileBarChart, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes NLP</h2>
          <p className="text-slate-500 text-sm mt-1">Análisis de categorías y frecuencia de términos</p>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700">Distribución por Categoría</h3>
          </div>
          {loading ? (
            <div className="h-[250px] flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : catData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">Sin datos de categorías</div>
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                    {catData.map((_, i) => <Cell key={i} fill={SENT_COLORS[i % SENT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hash size={18} className="text-amber-600" />
            <h3 className="font-semibold text-slate-700">Categorías Detectadas</h3>
          </div>
          {loading ? (
            <div className="h-[250px] flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : catData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">Sin datos</div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto">
              {catData.slice(0, 8).map((c) => {
                const pct = Math.round((c.value / analisis.length) * 100);
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700">{c.name}</span>
                      <span className="text-xs font-medium text-blue-600">{c.value} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 p-5 border-b border-slate-100">
          <FileBarChart size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700">Detalle de Análisis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 font-medium text-slate-500">ID</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Cliente</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Comentario</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Categoría</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Confianza</th>
              </tr>
            </thead>
            <tbody>
              {analisis.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-800">#{a.id}</td>
                  <td className="py-3 px-4 text-slate-700">{a.comentarios?.clientes?.nombre || '—'}</td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{a.comentarios?.contenido?.slice(0, 60) || '—'}</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{a.categoria_detectada || '—'}</span></td>
                  <td className="py-3 px-4 font-medium text-slate-800">{a.confianza != null ? `${a.confianza}%` : '—'}</td>
                </tr>
              ))}
              {analisis.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm">No hay análisis disponibles</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportesNLP;
