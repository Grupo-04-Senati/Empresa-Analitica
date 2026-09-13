import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Intersect, Database, TrendingUp, AlertTriangle, RefreshCw, Loader2, BrainCircuit } from 'lucide-react';
import { apiGet, apiPost } from '@/services/api';

interface PuntoInterpolado {
  x: number;
  observado: number | null;
  interpolado: number;
}

interface RespuestaInterpolacion {
  tiene_datos: boolean;
  puntos: PuntoInterpolado[];
  r2?: number;
  errorMedio?: number;
  errorRelativo?: number;
  mensaje?: string;
  metodo?: string;
}

const Interpolacion = () => {
  const [datos, setDatos] = useState<RespuestaInterpolacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prediccionMeses, setPrediccionMeses] = useState<number[]>([13, 14, 15]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<RespuestaInterpolacion>('/api/scipy/interpolacion-auto');
      setDatos(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const tieneDatos = datos?.tiene_datos && datos.puntos && datos.puntos.length >= 2;

  const handlePredecir = async () => {
    if (!datos?.puntos || datos.puntos.length < 2) return;
    setLoading(true);
    try {
      const x = datos.puntos.filter(p => p.observado !== null).map(p => p.x);
      const y = datos.puntos.filter(p => p.observado !== null).map(p => p.observado!);
      const maxPred = Math.max(...prediccionMeses, ...x);
      const x_new = Array.from({ length: maxPred }, (_, i) => i + 1);
      const result = await apiPost<RespuestaInterpolacion>('/api/scipy/interpolacion', { x, y, x_new });
      setDatos(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const stats = tieneDatos ? (() => {
    const obs = datos!.puntos.filter(p => p.observado !== null).map(p => p.observado!);
    const promedio = obs.reduce((a, b) => a + b, 0) / obs.length;
    const max = Math.max(...obs);
    const min = Math.min(...obs);
    const ultObs = obs[obs.length - 1];
    const predicciones = datos!.puntos.filter(p => p.observado === null).map(p => p.interpolado);
    const tendencia = predicciones.length > 0 ? predicciones[predicciones.length - 1] - ultObs : 0;
    return { promedio, max, min, tendencia, predicciones };
  })() : null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Interpolación de Tiempos</h2>
          <p className="text-slate-500 text-sm mt-1">Modelado de datos usando Splines Cúbicos (SciPy)</p>
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
      ) : !datos?.tiene_datos ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Database size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Recopilando datos insuficientes para el modelado</h3>
          <p className="text-slate-400 text-sm">La interpolación requiere al menos 2 registros de tiempos de atención.</p>
          <p className="text-slate-400 text-xs mt-2">Registra interacciones en "Tiempos de Atención" para comenzar el modelado.</p>
        </div>
      ) : tieneDatos ? (
        <>
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Media</p>
                <p className="text-xl font-bold text-blue-600">{stats.promedio.toFixed(1)} min</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Mínimo / Máximo</p>
                <p className="text-xl font-bold text-emerald-600">{stats.min} – {stats.max} min</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide">R²</p>
                <p className="text-xl font-bold text-purple-600">{datos!.r2 != null ? datos!.r2?.toFixed(4) : '—'}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Error Medio</p>
                <p className="text-xl font-bold text-amber-600">{datos!.errorMedio != null ? `${datos!.errorMedio} min` : '—'}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Intersect size={18} className="text-blue-600" />
              <h3 className="font-semibold text-slate-700">Modelo de Interpolación</h3>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datos!.puntos}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="x" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Índice', position: 'insideBottom', offset: -5 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Minutos', angle: -90, position: 'insideLeft', offset: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                  <Line type="monotone" dataKey="observado" name="Observado" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb' }} connectNulls={false} />
                  <Line type="monotone" dataKey="interpolado" name="Interpolado" stroke="#d97706" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: '#d97706', strokeDasharray: '' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BrainCircuit size={18} className="text-blue-600" />
              <h3 className="font-semibold text-slate-700">Predecir Tiempos Futuros</h3>
            </div>
            <div className="flex items-center gap-4 mb-4">
              {prediccionMeses.map((mes) => (
                <div key={mes} className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Mes {mes}:</span>
                  <input type="number" value={mes} disabled className="w-16 px-2 py-1 border border-slate-200 rounded text-sm bg-slate-50" />
                </div>
              ))}
            </div>
            <button onClick={handlePredecir} className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 rounded-lg transition">Predecir</button>
          </div>

          {stats && stats.tendencia > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">Tendencia ascendente</p>
                <p className="text-sm text-amber-700">Los tiempos de atención muestran una tendencia de +{stats.tendencia.toFixed(1)} min. Puede ser necesario optimizar procesos.</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Database size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Recopilando datos insuficientes para el modelado</h3>
          <p className="text-slate-400 text-sm">Se encontraron algunos registros, pero se necesitan al menos 2.</p>
        </div>
      )}
    </div>
  );
};

export default Interpolacion;
