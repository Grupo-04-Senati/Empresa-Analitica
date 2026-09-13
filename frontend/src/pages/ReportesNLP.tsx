import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FileBarChart, BrainCircuit, TrendingUp, Hash, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

const SENT_COLORS = ['#059669', '#d97706', '#dc2626', '#2563eb', '#7c3aed', '#0891b2'];

export const ReportesNLP = () => {
  const [totalAnalisis, setTotalAnalisis] = useState(0);
  const [totalComentarios, setTotalComentarios] = useState(0);
  const [confianzaProm, setConfianzaProm] = useState(0);
  const [categorias, setCategorias] = useState<{ nombre: string; total: number }[]>([]);
  const [detalle, setDetalle] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [comRes, nlpRes] = await Promise.all([
          supabase.from('comentarios').select('id', { count: 'exact', head: true }),
          supabase.from('analisis_nlp').select('id, comentario_id, categoria_detectada, confianza, comentarios(contenido, clientes(nombre))'),
        ]);
        setTotalComentarios(comRes.count || 0);
        const nlpData = nlpRes.data || [];
        setTotalAnalisis(nlpData.length);

        const confValues = nlpData.filter((r: any) => r.confianza != null).map((r: any) => Number(r.confianza));
        setConfianzaProm(confValues.length > 0 ? Math.round(confValues.reduce((a: number, b: number) => a + b, 0) / confValues.length * 100) : 0);

        const catMap: Record<string, number> = {};
        nlpData.forEach((r: any) => {
          if (r.categoria_detectada) catMap[r.categoria_detectada] = (catMap[r.categoria_detectada] || 0) + 1;
        });
        setCategorias(Object.entries(catMap).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total));

        setDetalle(nlpData.slice(0, 50).map((r: any) => ({
          id: r.id,
          categoria_detectada: r.categoria_detectada,
          confianza: r.confianza != null ? Number(r.confianza) * 100 : null,
          contenido: r.comentarios?.contenido || '—',
          cliente_nombre: (r.comentarios as any)?.clientes?.nombre || '—',
        })));
      } catch { /* empty */ } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const catData = categorias.map(c => ({ name: c.nombre, value: c.total }));
  const tieneDatos = totalAnalisis > 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Reportes NLP</h2>
        <p className="text-slate-500 text-sm mt-1">Analisis de categorias y frecuencia de terminos</p>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : !tieneDatos ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BrainCircuit size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No hay datos suficientes</h3>
          <p className="text-slate-400 text-sm">Los reportes NLP se generaran cuando se analicen comentarios.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Analizados', valor: totalAnalisis, icono: BrainCircuit, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Confianza prom.', valor: confianzaProm > 0 ? `${confianzaProm}%` : '—', icono: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Categorias', valor: catData.length, icono: Hash, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Total comentarios', valor: totalComentarios, icono: FileBarChart, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}><k.icono size={20} /></span>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p>
                  <p className="text-xl font-bold text-slate-800">{k.valor}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><BrainCircuit size={18} className="text-blue-600" /> Distribucion por Categoria</h3>
              {catData.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">Sin datos de categorias</div>
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
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Hash size={18} className="text-amber-600" /> Categorias Detectadas</h3>
              <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto">
                {catData.length === 0 ? <div className="text-slate-400 text-sm">Sin datos</div> : catData.slice(0, 8).map(c => {
                  const pct = totalAnalisis ? Math.round((c.value / totalAnalisis) * 100) : 0;
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
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100">
              <FileBarChart size={18} className="text-blue-600" />
              <h3 className="font-semibold text-slate-700">Detalle de Analisis</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-4 font-medium text-slate-500">ID</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Cliente</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Comentario</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Categoria</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Confianza</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.map(a => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-800">#{a.id}</td>
                      <td className="py-3 px-4 text-slate-700">{a.cliente_nombre}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{a.contenido?.slice(0, 60)}</td>
                      <td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{a.categoria_detectada || '—'}</span></td>
                      <td className="py-3 px-4 font-medium text-slate-800">{a.confianza != null ? `${a.confianza.toFixed(0)}%` : '—'}</td>
                    </tr>
                  ))}
                  {detalle.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm">No hay analisis</td></tr>}
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
