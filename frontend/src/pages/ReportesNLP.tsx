import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FileBarChart, BrainCircuit, Download, TrendingUp, Hash, Loader2, AlertCircle } from 'lucide-react';
import { apiGet } from '@/services/api';

const SENT_COLORS = ['#059669', '#d97706', '#dc2626', '#2563eb', '#7c3aed', '#0891b2'];

interface ReporteNLP {
  total_analisis: number;
  total_comentarios: number;
  confianza_promedio: number;
  categorias: { nombre: string; total: number }[];
  detalle: {
    id: number;
    comentario_id: number | null;
    categoria_detectada: string | null;
    confianza: number | null;
    contenido: string;
    cliente_nombre: string;
  }[];
  tiene_datos: boolean;
}

export const ReportesNLP = () => {
  const [data, setData] = useState<ReporteNLP | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await apiGet<ReporteNLP>('/api/reportes/nlp');
        setData(result);
      } catch (e: any) {
        setError(e.message || 'Error al cargar reportes');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const catData = (data?.categorias || []).map(c => ({ name: c.nombre, value: c.total })).sort((a, b) => b.value - a.value);

  const kpis = [
    { label: 'Analizados', valor: data?.total_analisis?.toString() || '0', icono: BrainCircuit, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Confianza prom.', valor: data?.confianza_promedio ? `${data.confianza_promedio}%` : '—', icono: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Categorías', valor: catData.length.toString(), icono: Hash, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Registros', valor: data?.total_analisis?.toString() || '0', icono: FileBarChart, color: 'text-purple-600', bg: 'bg-purple-50' },
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

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : !data?.tiene_datos ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BrainCircuit size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No hay datos suficientes</h3>
          <p className="text-slate-400 text-sm">Los reportes NLP se generarán automáticamente cuando se analicen comentarios en el sistema.</p>
          <p className="text-slate-400 text-xs mt-2">Ve a "Análisis de Comentarios" para procesar textos con NLTK.</p>
        </div>
      ) : (
        <>
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
              {catData.length === 0 ? (
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
              {catData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">Sin datos</div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto">
                  {catData.slice(0, 8).map((c) => {
                    const pct = data?.total_analisis ? Math.round((c.value / data.total_analisis) * 100) : 0;
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
                  {(data?.detalle || []).map((a) => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-800">#{a.id}</td>
                      <td className="py-3 px-4 text-slate-700">{a.cliente_nombre}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{a.contenido?.slice(0, 60) || '—'}</td>
                      <td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{a.categoria_detectada || '—'}</span></td>
                      <td className="py-3 px-4 font-medium text-slate-800">{a.confianza != null ? `${a.confianza.toFixed(0)}%` : '—'}</td>
                    </tr>
                  ))}
                  {(!data?.detalle || data.detalle.length === 0) && <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm">No hay análisis disponibles</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportesNLP;
