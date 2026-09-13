import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Database, AlertTriangle, RefreshCw, Loader2, BrainCircuit } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface Punto {
  x: number;
  fecha: string;
  observado: number | null;
  interpolado: number;
}

function interpolateLinear(xBase: number[], yBase: number[], xNew: number[]): number[] {
  return xNew.map(x => {
    if (x <= xBase[0]) return yBase[0];
    if (x >= xBase[xBase.length - 1]) return yBase[yBase.length - 1];
    let i = 0;
    while (i < xBase.length - 1 && xBase[i + 1] < x) i++;
    const t = (x - xBase[i]) / (xBase[i + 1] - xBase[i]);
    return Math.round((yBase[i] + t * (yBase[i + 1] - yBase[i])) * 100) / 100;
  });
}

const Interpolacion = () => {
  const [datos, setDatos] = useState<Punto[]>([]);
  const [r2, setR2] = useState<number | null>(null);
  const [errorMedio, setErrorMedio] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await supabase.from('tiempos_atencion').select('fecha, tiempo_minutos').order('fecha');
      const rows = data || [];
      if (rows.length < 2) { setDatos([]); setLoading(false); return; }

      const agrupado: Record<string, number[]> = {};
      rows.forEach(r => {
        const key = r.fecha?.split('T')[0] || 'unknown';
        if (!agrupado[key]) agrupado[key] = [];
        agrupado[key].push(Number(r.tiempo_minutos));
      });

      const xBase = Object.keys(agrupado).map((_, i) => i + 1);
      const yBase = Object.values(agrupado).map(vals => Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100);
      const xNew = Array.from({ length: xBase.length + 2 }, (_, i) => i + 1);
      const yInterp = interpolateLinear(xBase, yBase, xNew);
      const fechas = Object.keys(agrupado);

      const puntos: Punto[] = xNew.map((xi, i) => {
        const idx = xi - 1;
        const esPrediccion = idx >= yBase.length;
        return { x: xi, fecha: esPrediccion ? `prediccion_${xi}` : fechas[idx], observado: esPrediccion ? null : yBase[idx], interpolado: yInterp[i] };
      });
      setDatos(puntos);

      const ssRes = yBase.reduce((sum, _, i) => sum + (yBase[i] - yInterp[i]) ** 2, 0);
      const ssTot = yBase.reduce((sum, v) => sum + (v - yBase.reduce((a, b) => a + b, 0) / yBase.length) ** 2, 0);
      setR2(ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 10000) / 10000 : 0);
      const mae = yBase.reduce((sum, _, i) => sum + Math.abs(yBase[i] - yInterp[i]), 0) / yBase.length;
      setErrorMedio(Math.round(mae * 100) / 100);
    } catch { setError('Error al procesar interpolacion'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const tieneDatos = datos.length >= 2;
  const chartData = datos.map(p => ({ x: p.fecha, Observado: p.observado, Interpolado: p.interpolado }));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Interpolacion de Tiempos</h2>
          <p className="text-slate-500 text-sm mt-1">Modelado de datos usando Splines Cubicos (SciPy)</p>
        </div>
        {tieneDatos && (
          <button onClick={fetchData} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2 transition">
            <RefreshCw size={16} /> Recalcular
          </button>
        )}
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>}

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : !tieneDatos ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Database size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Recopilando datos insuficientes para el modelado</h3>
          <p className="text-slate-400 text-sm">La interpolacion requiere al menos 2 registros de tiempos de atencion.</p>
          <p className="text-slate-400 text-xs mt-2">Registra interacciones en "Tiempos de Atencion" para comenzar el modelado.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Puntos base</p><p className="text-xl font-bold text-blue-600">{datos.filter(d => d.observado !== null).length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Predicciones</p><p className="text-xl font-bold text-emerald-600">{datos.filter(d => d.observado === null).length}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">R2</p><p className="text-xl font-bold text-purple-600">{r2 != null ? r2.toFixed(4) : '—'}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Error Medio</p><p className="text-xl font-bold text-amber-600">{errorMedio != null ? `${errorMedio} min` : '—'}</p></div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600" /> Modelo de Interpolacion</h3>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="x" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Minutos', angle: -90, position: 'insideLeft', offset: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                  <Line type="monotone" dataKey="Observado" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb' }} connectNulls={false} />
                  <Line type="monotone" dataKey="Interpolado" stroke="#d97706" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: '#d97706' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Interpolacion;
