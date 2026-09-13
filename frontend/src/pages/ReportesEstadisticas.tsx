import { useState, useEffect } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Database, BarChart3, Loader2, FileText } from 'lucide-react';
import { apiGet } from '@/services/api';

const CAT_COLORS: Record<string, string> = {
  FELICITACION: '#059669',
  RECLAMO: '#dc2626',
  SOPORTE: '#2563eb',
  VENTAS: '#d97706',
  CONSULTA: '#7c3aed',
};

interface ReporteEstadisticas {
  stats_tiempos: {
    cantidad: number;
    media: number;
    mediana: number;
    desviacion_estandar: number;
    minimo: number;
    maximo: number;
    percentil_25: number;
    percentil_75: number;
  } | null;
  categorias: { nombre: string; total: number }[];
  total_comentarios: number;
  procesados: number;
  total_analisis: number;
  interpolacion: any;
  tiene_datos: boolean;
}

export const ReportesEstadisticas = () => {
  const [data, setData] = useState<ReporteEstadisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await apiGet<ReporteEstadisticas>('/api/reportes/estadisticas');
        setData(result);
      } catch (e: any) {
        setError(e.message || 'Error al cargar reportes');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const catData = (data?.categorias || []).map(c => ({ name: c.nombre, total: c.total }));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes Estadísticos</h2>
          <p className="text-slate-500 text-sm mt-1">Análisis de datos históricos y métricas computadas</p>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>}

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : !data?.tiene_datos ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Database size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No hay datos suficientes</h3>
          <p className="text-slate-400 text-sm">Los reportes estadísticos se generarán cuando haya datos suficientes en el sistema.</p>
          <p className="text-slate-400 text-xs mt-2">Se necesitan al menos 2 registros para calcular estadísticas.</p>
        </div>
      ) : (
        <>
          {data.stats_tiempos && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Promedio</p>
                <p className="text-2xl font-bold text-blue-600">{data.stats_tiempos.media} min</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Mediana</p>
                <p className="text-2xl font-bold text-emerald-600">{data.stats_tiempos.mediana} min</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Desv. Estándar</p>
                <p className="text-2xl font-bold text-amber-600">{data.stats_tiempos.desviacion_estandar} min</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Rango (min-max)</p>
                <p className="text-2xl font-bold text-purple-600">{data.stats_tiempos.minimo} – {data.stats_tiempos.maximo}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-blue-600" />
                <h3 className="font-semibold text-slate-700">Distribución por Categoría</h3>
              </div>
              {catData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">Sin datos de categorías</div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={catData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Bar dataKey="total" name="Comentarios" radius={[6, 6, 0, 0]}>
                        {catData.map((c) => (
                          <Cell key={c.name} fill={CAT_COLORS[c.name] || '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={18} className="text-amber-600" />
                <h3 className="font-semibold text-slate-700">Estadísticas de Tiempos</h3>
              </div>
              {data.stats_tiempos ? (
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Media', value: `${data.stats_tiempos.media} min` },
                    { label: 'Mediana', value: `${data.stats_tiempos.mediana} min` },
                    { label: 'Desviación estándar', value: `${data.stats_tiempos.desviacion_estandar} min` },
                    { label: 'Percentil 25', value: `${data.stats_tiempos.percentil_25} min` },
                    { label: 'Percentil 75', value: `${data.stats_tiempos.percentil_75} min` },
                    { label: 'Mínimo', value: `${data.stats_tiempos.minimo} min` },
                    { label: 'Máximo', value: `${data.stats_tiempos.maximo} min` },
                  ].map((s) => (
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
