import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

const SLA = 30;

export const ReportesAtencion = () => {
  const [total, setTotal] = useState(0);
  const [promedio, setPromedio] = useState(0);
  const [dentroSla, setDentroSla] = useState(0);
  const [fueraSla, setFueraSla] = useState(0);
  const [slaPct, setSlaPct] = useState(0);
  const [minimo, setMinimo] = useState(0);
  const [maximo, setMaximo] = useState(0);
  const [historial, setHistorial] = useState<{ fecha: string; promedio: number; cantidad: number; sla: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('tiempos_atencion').select('tiempo_minutos, fecha').order('fecha', { ascending: true });
        const rows = data || [];
        setTotal(rows.length);
        if (rows.length > 0) {
          const tiempos = rows.map(r => Number(r.tiempo_minutos));
          const avg = Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length * 10) / 10;
          const ok = tiempos.filter(t => t <= SLA).length;
          setPromedio(avg);
          setDentroSla(ok);
          setFueraSla(tiempos.length - ok);
          setSlaPct(Math.round(ok / tiempos.length * 100));
          setMinimo(Math.min(...tiempos));
          setMaximo(Math.max(...tiempos));

          const agrupado: Record<string, number[]> = {};
          rows.forEach(r => {
            const key = r.fecha?.split('T')[0] || 's/f';
            if (!agrupado[key]) agrupado[key] = [];
            agrupado[key].push(Number(r.tiempo_minutos));
          });
          setHistorial(Object.entries(agrupado).map(([fecha, vals]) => ({
            fecha, promedio: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10, cantidad: vals.length, sla: SLA,
          })));
        }
      } catch { /* empty */ } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const chartData = historial.slice(-12).map(h => ({ fecha: h.fecha?.split('T')[0]?.slice(5) || 's/f', minutos: h.promedio, sla: h.sla }));
  const tieneDatos = total > 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Reportes de Atencion</h2>
        <p className="text-slate-500 text-sm mt-1">Analisis de metricas de atencion al cliente y cumplimiento SLA</p>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : !tieneDatos ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Clock size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No hay datos suficientes</h3>
          <p className="text-slate-400 text-sm">Los reportes de atencion se generaran cuando se registren tiempos de atencion.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Promedio respuesta', valor: `${promedio} min`, icono: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Dentro de SLA', valor: `${slaPct}%`, icono: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Incumplimientos', valor: fueraSla, icono: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Total registros', valor: total, icono: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
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
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Clock size={18} className="text-blue-600" /> Tiempos de Respuesta vs SLA</h3>
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
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-600" /> Resumen de Cumplimiento</h3>
              <div className="flex flex-col gap-5">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">Dentro de SLA</span>
                    <span className="text-sm font-medium text-emerald-600">{slaPct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${slaPct}%` }} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">Incumplidos</span>
                    <span className="text-sm font-medium text-red-600">{100 - slaPct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${100 - slaPct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-xs text-slate-500">Total</p><p className="text-lg font-bold text-slate-800">{total}</p></div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="text-xs text-emerald-600">OK</p><p className="text-lg font-bold text-emerald-700">{dentroSla}</p></div>
                  <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-xs text-red-600">Fallidos</p><p className="text-lg font-bold text-red-700">{fueraSla}</p></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">{slaPct >= 80 ? <TrendingUp size={18} className="text-emerald-600" /> : <TrendingDown size={18} className="text-red-600" />} Resumen Ejecutivo</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 text-center"><p className="text-xs text-slate-500 mb-1">Promedio General</p><p className="text-2xl font-bold text-blue-600">{promedio} min</p></div>
              <div className="bg-slate-50 rounded-xl p-4 text-center"><p className="text-xs text-slate-500 mb-1">Minimo</p><p className="text-2xl font-bold text-emerald-600">{minimo} min</p></div>
              <div className="bg-slate-50 rounded-xl p-4 text-center"><p className="text-xs text-slate-500 mb-1">Maximo</p><p className="text-2xl font-bold text-red-600">{maximo} min</p></div>
              <div className="bg-slate-50 rounded-xl p-4 text-center"><p className="text-xs text-slate-500 mb-1">Cumplimiento SLA</p><p className={`text-2xl font-bold ${slaPct >= 80 ? 'text-emerald-600' : slaPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{slaPct}%</p></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportesAtencion;
