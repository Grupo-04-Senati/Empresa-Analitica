import { useState, useEffect } from 'react';
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LineChart as LineIcon, Database, Ruler, Sigma, Percent, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface TiempoRow { fecha: string; tiempo_minutos: number; }
interface PuntoInterpolado { x: number; observado: number | null; interpolado: number; }

function linearInterpolate(data: { x: number; y: number }[], predictCount: number): PuntoInterpolado[] {
  if (data.length === 0) return [];
  const sorted = [...data].sort((a, b) => a.x - b.x);
  const minX = sorted[0].x;
  const maxX = sorted[sorted.length - 1].x;
  const step = (maxX - minX) / Math.max(sorted.length - 1, 1);

  const result: PuntoInterpolado[] = [];
  const origMap = new Map(sorted.map((d) => [d.x, d.y]));

  for (let i = 0; i < sorted.length + predictCount; i++) {
    const x = minX + i * step;
    const observed = origMap.get(Math.round(x * 100) / 100) ?? null;

    let interpolated = 0;
    if (x <= maxX) {
      for (let j = 0; j < sorted.length - 1; j++) {
        if (x >= sorted[j].x && x <= sorted[j + 1].x) {
          const t = (x - sorted[j].x) / (sorted[j + 1].x - sorted[j].x || 1);
          interpolated = sorted[j].y + t * (sorted[j + 1].y - sorted[j].y);
          break;
        }
      }
    } else {
      const lastTwo = sorted.slice(-2);
      const slope = (lastTwo[1].y - lastTwo[0].y) / (lastTwo[1].x - lastTwo[0].x || 1);
      interpolated = lastTwo[1].y + slope * (x - lastTwo[1].x);
    }
    result.push({ x: Math.round(x * 100) / 100, observado: observed, interpolado: Math.round(interpolated * 100) / 100 });
  }
  return result;
}

function calcR2(points: PuntoInterpolado[]) {
  const withObs = points.filter((p) => p.observado !== null);
  if (withObs.length < 2) return 0;
  const mean = withObs.reduce((s, p) => s + p.observado!, 0) / withObs.length;
  const ssRes = withObs.reduce((s, p) => s + (p.observado! - p.interpolado) ** 2, 0);
  const ssTot = withObs.reduce((s, p) => s + (p.observado! - mean) ** 2, 0);
  return ssTot === 0 ? 1 : 1 - ssRes / ssTot;
}

export const Interpolacion = () => {
  const [datos, setDatos] = useState<PuntoInterpolado[]>([]);
  const [r2, setR2] = useState(0);
  const [errorMedio, setErrorMedio] = useState(0);
  const [errorRelativo, setErrorRelativo] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('tiempos_atencion').select('fecha, tiempo_minutos').order('fecha');
        if (error) throw error;
        const rows = (data || []) as TiempoRow[];
        const grouped: Record<string, number[]> = {};
        rows.forEach((r) => {
          const key = r.fecha?.split('T')[0] || 'unknown';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(Number(r.tiempo_minutos));
        });
        const series = Object.entries(grouped).map(([fecha, vals]) => ({
          x: new Date(fecha).getTime(),
          y: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
        }));
        if (series.length >= 2) {
          const interpolated = linearInterpolate(series, Math.min(6, series.length));
          setDatos(interpolated);
          setR2(calcR2(interpolated));
          const withObs = interpolated.filter((p) => p.observado !== null);
          const mae = withObs.length > 0 ? withObs.reduce((s, p) => s + Math.abs(p.observado! - p.interpolado), 0) / withObs.length : 0;
          setErrorMedio(Math.round(mae * 100) / 100);
          const meanObs = withObs.length > 0 ? withObs.reduce((s, p) => s + p.observado!, 0) / withObs.length : 1;
          setErrorRelativo(meanObs !== 0 ? Math.round((mae / meanObs) * 10000) / 100 : 0);
        }
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const chartData = datos.map((p) => ({
    x: new Date(p.x).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
    observado: p.observado,
    interpolado: p.interpolado,
  }));

  const precisionPct = Math.round(r2 * 100);
  const coberturaPct = datos.length > 0 ? Math.round((datos.filter((p) => p.observado !== null).length / datos.length) * 100) : 0;
  const consistenciaPct = errorRelativo > 0 ? Math.min(100, Math.round(100 - errorRelativo)) : 0;

  const kpis = [
    { label: 'Puntos de datos', valor: datos.length.toString(), icono: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Coeficiente R²', valor: r2.toFixed(4), icono: Ruler, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Error medio (MAE)', valor: errorMedio.toFixed(2), icono: Sigma, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Error relativo', valor: `${errorRelativo}%`, icono: Percent, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Interpolación de Datos</h2>
          <p className="text-slate-500 text-sm mt-1">Modelado y ajuste de series con interpolación lineal</p>
        </div>
        <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">Método: Lineal</span>
      </div>

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
                <LineIcon size={18} className="text-blue-600" />
                <h3 className="font-semibold text-slate-700">Series: Observado vs Interpolado</h3>
              </div>
              {datos.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">Sin datos de tiempos de atención</div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReLineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="x" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Legend verticalAlign="top" iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="observado" name="Observado" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="interpolado" name="Interpolado" stroke="#059669" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} />
                    </ReLineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Ruler size={18} className="text-emerald-600" />
                <h3 className="font-semibold text-slate-700">Calidad del Ajuste</h3>
              </div>
              <div className="flex flex-col items-center py-4">
                <span className="text-4xl font-bold text-slate-800">{r2.toFixed(4)}</span>
                <span className="text-xs text-slate-500 mt-1">Coeficiente de determinación R²</span>
              </div>
              <div className="flex flex-col gap-4 mt-4">
                {[
                  { nombre: 'Precisión del modelo', valor: precisionPct, color: '#2563eb' },
                  { nombre: 'Cobertura de datos', valor: coberturaPct, color: '#059669' },
                  { nombre: 'Consistencia', valor: consistenciaPct, color: '#d97706' },
                ].map((f) => (
                  <div key={f.nombre}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700">{f.nombre}</span>
                      <span className="text-xs font-medium text-slate-500">{f.valor}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${f.valor}%`, background: f.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100">
              <Database size={18} className="text-blue-600" />
              <h3 className="font-semibold text-slate-700">Tabla de Interpolación</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Punto (x)</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Observado</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Interpolado</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Error relativo</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.map((p, i) => {
                    const errorRel = p.observado !== null && p.observado !== 0
                      ? Math.abs(((p.interpolado - p.observado) / p.observado) * 100).toFixed(2)
                      : '—';
                    return (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-800">{new Date(p.x).toLocaleDateString('es-ES')}</td>
                        <td className="py-3 px-4 text-slate-600">{p.observado ?? '—'}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{p.interpolado}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            errorRel === '—' ? 'bg-slate-100 text-slate-500' : parseFloat(errorRel) < 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {errorRel === '—' ? '—' : `${errorRel}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {datos.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-sm">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Interpolacion;
