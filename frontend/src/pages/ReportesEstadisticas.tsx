import { useState, useEffect } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Database, BarChart3, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/services/supabase';

const CAT_COLORS: Record<string, string> = {
  FELICITACION: '#059669', RECLAMO: '#dc2626', SOPORTE: '#2563eb', VENTAS: '#d97706', CONSULTA: '#7c3aed',
};

export const ReportesEstadisticas = () => {
  const [totalComentarios, setTotalComentarios] = useState(0);
  const [procesados, setProcesados] = useState(0);
  const [totalAnalisis, setTotalAnalisis] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [categorias, setCategorias] = useState<{ nombre: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [comRes, nlpRes, tiemposRes, catsRes] = await Promise.all([
          supabase.from('comentarios').select('id, procesado', { count: 'exact' }),
          supabase.from('analisis_nlp').select('categoria_detectada'),
          supabase.from('tiempos_atencion').select('tiempo_minutos'),
          supabase.from('comentarios').select('categoria'),
        ]);

        setTotalComentarios(comRes.count || 0);
        const comData = comRes.data || [];
        setProcesados(comData.filter(c => c.procesado).length);
        setTotalAnalisis((nlpRes.data || []).length);

        const tiempos = (tiemposRes.data || []).map(r => Number(r.tiempo_minutos)).filter(t => !isNaN(t));
        if (tiempos.length >= 2) {
          const sorted = [...tiempos].sort((a, b) => a - b);
          const avg = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
          const mediana = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
          const varianza = tiempos.reduce((sum, t) => sum + (t - avg) ** 2, 0) / tiempos.length;
          setStats({
            cantidad: tiempos.length,
            media: Math.round(avg * 100) / 100,
            mediana: Math.round(mediana * 100) / 100,
            desviacion_estandar: Math.round(Math.sqrt(varianza) * 100) / 100,
            minimo: sorted[0],
            maximo: sorted[sorted.length - 1],
            percentil_25: sorted[Math.floor(sorted.length * 0.25)],
            percentil_75: sorted[Math.floor(sorted.length * 0.75)],
          });
        }

        const catMap: Record<string, number> = {};
        (catsRes.data || []).forEach(r => { if (r.categoria) catMap[r.categoria] = (catMap[r.categoria] || 0) + 1; });
        setCategorias(Object.entries(catMap).map(([nombre, total]) => ({ nombre, total })));
      } catch { /* empty */ } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const catData = categorias.map(c => ({ name: c.nombre, total: c.total }));
  const tieneDatos = totalComentarios > 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Reportes Estadisticos</h2>
        <p className="text-slate-500 text-sm mt-1">Analisis de datos historicos y metricas computadas</p>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : !tieneDatos ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Database size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No hay datos suficientes</h3>
          <p className="text-slate-400 text-sm">Los reportes estadisticos se generaran cuando haya datos suficientes en el sistema.</p>
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Promedio</p><p className="text-2xl font-bold text-blue-600">{stats.media} min</p></div>
              <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Mediana</p><p className="text-2xl font-bold text-emerald-600">{stats.mediana} min</p></div>
              <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Desv. Estandar</p><p className="text-2xl font-bold text-amber-600">{stats.desviacion_estandar} min</p></div>
              <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Rango (min-max)</p><p className="text-2xl font-bold text-purple-600">{stats.minimo} – {stats.maximo}</p></div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-blue-600" /> Distribucion por Categoria</h3>
              {catData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">Sin datos de categorias</div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={catData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Bar dataKey="total" name="Comentarios" radius={[6, 6, 0, 0]}>
                        {catData.map(c => <Cell key={c.name} fill={CAT_COLORS[c.name] || '#6366f1'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><FileText size={18} className="text-amber-600" /> Estadisticas de Tiempos</h3>
              {stats ? (
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Media', value: `${stats.media} min` },
                    { label: 'Mediana', value: `${stats.mediana} min` },
                    { label: 'Desviacion estandar', value: `${stats.desviacion_estandar} min` },
                    { label: 'Percentil 25', value: `${stats.percentil_25} min` },
                    { label: 'Percentil 75', value: `${stats.percentil_75} min` },
                    { label: 'Minimo', value: `${stats.minimo} min` },
                    { label: 'Maximo', value: `${stats.maximo} min` },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-500">{s.label}</span>
                      <span className="text-sm font-semibold text-slate-800">{s.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">Sin datos de tiempos</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportesEstadisticas;
