import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Clock, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface TiempoRow {
  id: number;
  tiempo_minutos: number;
  fecha: string;
  operador: string | null;
}

const SLA = 30;

export const ReportesAtencion = () => {
  const [tiempos, setTiempos] = useState<TiempoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('tiempos_atencion').select('id, tiempo_minutos, fecha, operador').order('fecha', { ascending: false });
      if (!error && data) setTiempos(data as TiempoRow[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const total = tiempos.length;
    const promedio = total > 0 ? Math.round(tiempos.reduce((s, t) => s + t.tiempo_minutos, 0) / total * 10) / 10 : 0;
    const dentroSLA = tiempos.filter((t) => t.tiempo_minutos <= SLA).length;
    const incumplidos = total - dentroSLA;
    const slaPct = total > 0 ? Math.round((dentroSLA / total) * 100) : 0;
    return { total, promedio, dentroSLA, incumplidos, slaPct };
  }, [tiempos]);

  const chartData = useMemo(() => {
    const porFecha: Record<string, number[]> = {};
    tiempos.forEach((t) => {
      const fecha = t.fecha?.split('T')[0]?.slice(5) ?? 's/f';
      if (!porFecha[fecha]) porFecha[fecha] = [];
      porFecha[fecha].push(t.tiempo_minutos);
    });
    return Object.entries(porFecha).map(([fecha, mins]) => ({
      fecha,
      minutos: Math.round(mins.reduce((s, v) => s + v, 0) / mins.length),
      sla: SLA,
    })).slice(-12);
  }, [tiempos]);

  const kpis = [
    { label: 'Promedio respuesta', valor: stats.promedio > 0 ? `${stats.promedio} min` : '—', icono: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Dentro de SLA', valor: stats.total > 0 ? `${stats.slaPct}%` : '—', icono: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Incumplimientos', valor: stats.total > 0 ? stats.incumplidos.toString() : '—', icono: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Total registros', valor: stats.total.toString(), icono: Download, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes de Atención</h2>
          <p className="text-slate-500 text-sm mt-1">Análisis de métricas de atención al cliente y cumplimiento SLA</p>
        </div>
      </div>

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
          {loading ? (
            <div className="h-[260px] flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : chartData.length === 0 ? (
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
          {loading ? (
            <div className="h-[260px] flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
          ) : stats.total === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">Sin datos</div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">Dentro de SLA</span>
                  <span className="text-sm font-medium text-emerald-600">{stats.slaPct}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.slaPct}%` }} />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">Incumplidos</span>
                  <span className="text-sm font-medium text-red-600">{100 - stats.slaPct}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${100 - stats.slaPct}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-xs text-slate-500">Total</p><p className="text-lg font-bold text-slate-800">{stats.total}</p></div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center"><p className="text-xs text-emerald-600">OK</p><p className="text-lg font-bold text-emerald-700">{stats.dentroSLA}</p></div>
                <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-xs text-red-600">Fallidos</p><p className="text-lg font-bold text-red-700">{stats.incumplidos}</p></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportesAtencion;
