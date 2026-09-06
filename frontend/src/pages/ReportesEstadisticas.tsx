import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { BarChart3, TrendingUp, Activity, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2'];

interface TiempoRow { tiempo_minutos: number; }
interface ComentarioRow { estado: string | null; categoria: string | null; }

function calcStats(values: number[]) {
  if (values.length === 0) return { count: 0, mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / count;
  const mid = Math.floor(count / 2);
  const median = count % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const stdDev = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / count);
  return { count, mean: Math.round(mean * 100) / 100, median: Math.round(median * 100) / 100, stdDev: Math.round(stdDev * 100) / 100, min: sorted[0], max: sorted[count - 1] };
}

export const ReportesEstadisticas = () => {
  const [stats, setStats] = useState<ReturnType<typeof calcStats> | null>(null);
  const [catData, setCatData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [tiemposRes, compsRes] = await Promise.all([
        supabase.from('tiempos_atencion').select('tiempo_minutos'),
        supabase.from('comentarios').select('estado, categoria'),
      ]);

      const tiempos = (tiemposRes.data || []).map((t: TiempoRow) => Number(t.tiempo_minutos)).filter((v) => !isNaN(v) && v > 0);
      if (tiempos.length > 0) setStats(calcStats(tiempos));

      const comps = (compsRes.data || []) as ComentarioRow[];
      const catMap = new Map<string, number>();
      comps.forEach((c) => { const cat = c.categoria || 'Sin categoría'; catMap.set(cat, (catMap.get(cat) || 0) + 1); });
      setCatData(Array.from(catMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

      if (tiemposRes.error) setError(tiemposRes.error.message);
      else if (compsRes.error) setError(compsRes.error.message);
      setLoading(false);
    };
    fetchData();
  }, []);

  const barData = stats ? [
    { name: 'Media', value: stats.mean },
    { name: 'Mediana', value: stats.median },
    { name: 'Mín', value: stats.min },
    { name: 'Máx', value: stats.max },
    { name: 'Desv Std', value: stats.stdDev },
  ] : [];

  const kpis = [
    { label: 'Registros tiempo', valor: stats?.count?.toString() || '—', icono: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Media (min)', valor: stats ? stats.mean.toString() : '—', icono: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Categorías', valor: catData.length.toString(), icono: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Desv. Estándar', valor: stats ? stats.stdDev.toString() : '—', icono: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes de Estadísticas</h2>
          <p className="text-slate-500 text-sm mt-1">Análisis cuantitativo de tiempos y distribución de categorías</p>
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

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-blue-600" />
                <h3 className="font-semibold text-slate-700">Tiempos de Atención</h3>
              </div>
              {barData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">Sin datos de tiempos</div>
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
                <h3 className="font-semibold text-slate-700">Distribución por Categoría</h3>
              </div>
              {catData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">Sin categorías</div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={catData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3} strokeWidth={0}>
                        {catData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                      <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-amber-600" />
              <h3 className="font-semibold text-slate-700">Detalle Estadístico</h3>
            </div>
            {stats ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Métrica</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Valor</th>
                  </tr></thead>
                  <tbody>
                    <tr className="border-b border-slate-100"><td className="py-3 px-4 text-slate-700">Total de datos</td><td className="py-3 px-4 font-medium text-slate-800">{stats.count}</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-3 px-4 text-slate-700">Media</td><td className="py-3 px-4 font-medium text-slate-800">{stats.mean} min</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-3 px-4 text-slate-700">Mediana</td><td className="py-3 px-4 font-medium text-slate-800">{stats.median} min</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-3 px-4 text-slate-700">Desviación Estándar</td><td className="py-3 px-4 font-medium text-slate-800">{stats.stdDev}</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-3 px-4 text-slate-700">Mínimo</td><td className="py-3 px-4 font-medium text-slate-800">{stats.min} min</td></tr>
                    <tr><td className="py-3 px-4 text-slate-700">Máximo</td><td className="py-3 px-4 font-medium text-slate-800">{stats.max} min</td></tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">Sin datos estadísticos disponibles</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ReportesEstadisticas;
