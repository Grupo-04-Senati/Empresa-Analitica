import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Clock, CheckCircle2, Download, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { apiGet } from '@/services/api';

interface ReporteAtencion {
  total: number;
  promedio: number;
  minimo: number;
  maximo: number;
  dentro_sla: number;
  fuera_sla: number;
  sla_pct: number;
  historial: { fecha: string; promedio: number; cantidad: number; sla: number }[];
  tiene_datos: boolean;
}

const SLA = 30;

export const ReportesAtencion = () => {
  const [data, setData] = useState<ReporteAtencion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await apiGet<ReporteAtencion>('/api/reportes/atencion');
        setData(result);
      } catch (e: any) {
        setError(e.message || 'Error al cargar reportes');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const chartData = (data?.historial || []).slice(-12).map(h => ({
    fecha: h.fecha?.split('T')[0]?.slice(5) || 's/f',
    minutos: h.promedio,
    sla: h.sla,
  }));

  const kpis = [
    { label: 'Promedio respuesta', valor: data?.promedio ? `${data.promedio} min` : '—', icono: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Dentro de SLA', valor: data?.total ? `${data.sla_pct}%` : '—', icono: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Incumplimientos', valor: data?.fuera_sla?.toString() || '0', icono: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Total registros', valor: data?.total?.toString() || '0', icono: Download, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes de Atención</h2>
          <p className="text-slate-500 text-sm mt-1">Análisis de métricas de atención al cliente y cumplimiento SLA</p>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>}

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : !data?.tiene_datos ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Clock size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No hay datos suficientes</h3>
          <p className="text-slate-400 text-sm">Los reportes de atención se generarán automáticamente cuando se registren tiempos de atención.</p>
          <p className="text-slate-400 text-xs mt-2">Ve a "Tiempos de Atención" para registrar interacciones.</p>
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
                <Clock size={18} className="text-blue-600" />
                <h3 className="font-semibold text-slate-700">Tiempos de Respuesta vs SLA</h3>
              </div>
              {chartData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">Sin datos de tiempos</div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="rapGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Area type="monotone" dataKey="minutos" name="Minutos" stroke="#2563eb" strokeWidth={2.5} fill="url(#rapGrad)" />
                      <Area type="monotone" dataKey="sla" name="SLA" stroke="#d97706" strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-amber-600" />
                <h3 className="font-semibold text-slate-700">Resumen de Cumplimiento</h3>
              </div>
              {!data?.total ? (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">Sin datos</div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700">Dentro de SLA</span>
                      <span className="text-sm font-medium text-emerald-600">{data.sla_pct}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${data.sla_pct}%` }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700">Incumplidos</span>
                      <span className="text-sm font-medium text-red-600">{100 - data.sla_pct}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${100 - data.sla_pct}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-xs text-slate-500">Total</p><p className="text-lg font-bold text-slate-800">{data.total}</p></div>
                    <div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="text-xs text-emerald-600">OK</p><p className="text-lg font-bold text-emerald-700">{data.dentro_sla}</p></div>
                    <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-xs text-red-600">Fallidos</p><p className="text-lg font-bold text-red-700">{data.fuera_sla}</p></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              {data.sla_pct >= 80 ? <TrendingUp size={18} className="text-emerald-600" /> : <TrendingDown size={18} className="text-red-600" />}
              <h3 className="font-semibold text-slate-700">Resumen Ejecutivo</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Promedio General</p>
                <p className="text-2xl font-bold text-blue-600">{data.promedio} min</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Mínimo</p>
                <p className="text-2xl font-bold text-emerald-600">{data.minimo} min</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Máximo</p>
                <p className="text-2xl font-bold text-red-600">{data.maximo} min</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Cumplimiento SLA</p>
                <p className={`text-2xl font-bold ${data.sla_pct >= 80 ? 'text-emerald-600' : data.sla_pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{data.sla_pct}%</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportesAtencion;
