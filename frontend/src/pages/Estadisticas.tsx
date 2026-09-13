import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { BarChart3, TrendingUp, Activity, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2'];

interface Stats { count: number; mean: number; median: number; stdDev: number; min: number; max: number; }

function calcStats(values: number[]): Stats {
  if (values.length === 0) return { count: 0, mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / count;
  const mid = Math.floor(count / 2);
  const median = count % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);
  return { count, mean: Math.round(mean * 100) / 100, median: Math.round(median * 100) / 100, stdDev: Math.round(stdDev * 100) / 100, min: sorted[0], max: sorted[count - 1] };
}

export const Estadisticas = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rawData, setRawData] = useState<number[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data, error: err } = await supabase.from('tiempos_atencion').select('tiempo_minutos');
        if (err) throw err;
        const values = (data || []).map((r: any) => Number(r.tiempo_minutos)).filter((v) => !isNaN(v) && v > 0);
        setRawData(values);
        if (values.length > 0) setStats(calcStats(values));
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const kpis = stats ? [
    { label: 'Total datos', valor: stats.count.toString(), icono: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Media', valor: `${stats.mean} min`, icono: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Mediana', valor: `${stats.median} min`, icono: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Desv. Estándar', valor: stats.stdDev.toString(), icono: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
  ] : [];

  const barData = stats ? [
    { name: 'Media', value: stats.mean },
    { name: 'Mediana', value: stats.median },
    { name: 'Mín', value: stats.min },
    { name: 'Máx', value: stats.max },
    { name: 'Desv Std', value: stats.stdDev },
  ] : [];

  const pieData = stats ? [
    { name: 'Media', value: Math.abs(stats.mean) },
    { name: 'Mediana', value: Math.abs(stats.median) },
    { name: 'Rango', value: Math.abs(stats.max - stats.min) },
  ] : [];

  const histogramData = (() => {
    if (rawData.length === 0) return [];
    const min = Math.floor(Math.min(...rawData));
    const max = Math.ceil(Math.max(...rawData));
    const bucketSize = Math.max(1, Math.round((max - min) / 6));
    const buckets: { rango: string; cantidad: number }[] = [];
    for (let i = min; i < max; i += bucketSize) {
      const count = rawData.filter((v) => v >= i && v < i + bucketSize).length;
      buckets.push({ rango: `${i}-${i + bucketSize}`, cantidad: count });
    }
    return buckets;
  })();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Estadísticas Corporativas</h2>
          <p className="text-slate-500 text-sm mt-1">Análisis cuantitativo de tiempos de atención</p>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>}

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
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
                <BarChart3 size={18} className="text-blue-600" />
                <h3 className="font-semibold text-slate-700">Comparativa de Métricas</h3>
              </div>
              {barData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">Sin datos disponibles</div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} barGap={4} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {barData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={18} className="text-emerald-600" />
                <h3 className="font-semibold text-slate-700">Distribución</h3>
              </div>
              {histogramData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">Sin datos</div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histogramData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="rango" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="cantidad" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-amber-600" />
              <h3 className="font-semibold text-slate-700">Detalle de Resultados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Métrica</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Valor</th>
                </tr></thead>
                <tbody>
                  {stats ? (
                    <>
                      <tr className="border-b border-slate-100"><td className="py-3 px-4 text-slate-700">Total de datos</td><td className="py-3 px-4 font-medium text-slate-800">{stats.count}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-3 px-4 text-slate-700">Media</td><td className="py-3 px-4 font-medium text-slate-800">{stats.mean} min</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-3 px-4 text-slate-700">Mediana</td><td className="py-3 px-4 font-medium text-slate-800">{stats.median} min</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-3 px-4 text-slate-700">Desviación Estándar</td><td className="py-3 px-4 font-medium text-slate-800">{stats.stdDev}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-3 px-4 text-slate-700">Mínimo</td><td className="py-3 px-4 font-medium text-slate-800">{stats.min} min</td></tr>
                      <tr><td className="py-3 px-4 text-slate-700">Máximo</td><td className="py-3 px-4 font-medium text-slate-800">{stats.max} min</td></tr>
                    </>
                  ) : <tr><td colSpan={2} className="py-8 text-center text-slate-400">Sin datos disponibles</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Estadisticas;
