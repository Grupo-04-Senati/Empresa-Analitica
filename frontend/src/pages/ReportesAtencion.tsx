import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Clock, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Loader2, Filter, RefreshCw } from 'lucide-react';
import { fetchTiempos, fetchClientes, fetchOperadores, calcStats, agruparPorDia, agruparPorOperador, FiltrosCompletos } from '@/services/statsService';

const SLA = 30;
const COLORS = ['#059669', '#dc2626'];

export const ReportesAtencion = () => {
  const [tiempos, setTiempos] = useState<{ fecha: string; tiempo_minutos: number; cliente_id: number | null; operador: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);
  const [operadores, setOperadores] = useState<string[]>([]);
  const [filtros, setFiltros] = useState<FiltrosCompletos>({});
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const fetchData = async (f: FiltrosCompletos = {}) => {
    setLoading(true);
    try {
      const [t, c, o] = await Promise.all([fetchTiempos(f), fetchClientes(), fetchOperadores()]);
      setTiempos(t); setClientes(c); setOperadores(o);
    } catch { /* empty */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const vals = tiempos.map(t => t.tiempo_minutos);
  const stats = calcStats(vals);
  const total = vals.length;
  const dentro = vals.filter(t => t <= SLA).length;
  const slaPct = total > 0 ? Math.round(dentro / total * 100) : 0;
  const fuera = total - dentro;

  const diario = agruparPorDia(tiempos);
  const porOperador = agruparPorOperador(tiempos);
  const chartData = diario.slice(-15).map(d => ({ fecha: d.fecha.slice(5), promedio: d.promedio, sla: SLA }));

  const aplicar = () => { fetchData(filtros); setMostrarFiltros(false); };
  const limpiar = () => { setFiltros({}); fetchData({}); setMostrarFiltros(false); };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes de Atencion</h2>
          <p className="text-slate-500 text-sm mt-1">Metricas de tiempos de atencion (SLA: {SLA} min) - datos de tiempos_atencion</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2"><Filter size={16} /> Filtros</button>
          <button onClick={() => fetchData(filtros)} disabled={loading} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Recalcular</button>
        </div>
      </div>

      {mostrarFiltros && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-700 mb-3">Filtros de tiempos de atencion</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label className="block text-xs text-slate-500 mb-1">Fecha inicio</label><input type="date" value={filtros.fecha_inicio || ''} onChange={e => setFiltros(f => ({ ...f, fecha_inicio: e.target.value || undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Fecha fin</label><input type="date" value={filtros.fecha_fin || ''} onChange={e => setFiltros(f => ({ ...f, fecha_fin: e.target.value || undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Cliente</label><select value={filtros.cliente_id || ''} onChange={e => setFiltros(f => ({ ...f, cliente_id: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"><option value="">Todos</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><label className="block text-xs text-slate-500 mb-1">Operador</label><select value={filtros.operador || ''} onChange={e => setFiltros(f => ({ ...f, operador: e.target.value || undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"><option value="">Todos</option>{operadores.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={aplicar} className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 rounded-lg transition">Aplicar</button>
            <button onClick={limpiar} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm py-2 px-4 rounded-lg transition">Limpiar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : total === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Clock size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No hay datos de tiempos de atencion</h3>
          <p className="text-slate-400 text-sm">Los reportes se generaran cuando se registren tiempos en la tabla tiempos_atencion.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Promedio', valor: `${stats?.media || 0} min`, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Cumple SLA', valor: `${slaPct}%`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Incumplimientos', valor: fuera, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Total registros', valor: total, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}><Clock size={20} /></span>
                <div><p className="text-xs text-slate-500 uppercase">{k.label}</p><p className="text-xl font-bold text-slate-800">{k.valor}</p></div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-4">Tiempos Diarios vs SLA</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                    <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Area type="monotone" dataKey="promedio" name="Promedio (min)" stroke="#2563eb" strokeWidth={2.5} fill="url(#grad)" />
                    <Area type="monotone" dataKey="sla" name="SLA (min)" stroke="#d97706" strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-4">Cumplimiento SLA</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ name: 'Cumple SLA', value: dentro }, { name: 'Excede SLA', value: fuera }]} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                      {[0, 1].map(i => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {porOperador.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
              <h3 className="font-semibold text-slate-700 mb-4">Promedio por Operador</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porOperador}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                    <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Bar dataKey="promedio" name="Promedio (min)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {stats && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-3">Estadisticas del Periodo</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-xs text-slate-500">Media</p><p className="text-lg font-bold text-blue-600">{stats.media} min</p></div>
                <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-xs text-slate-500">Mediana</p><p className="text-lg font-bold text-purple-600">{stats.mediana} min</p></div>
                <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-xs text-slate-500">Min - Max</p><p className="text-lg font-bold text-emerald-600">{stats.minimo} – {stats.maximo}</p></div>
                <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-xs text-slate-500">Desv. Estandar</p><p className="text-lg font-bold text-amber-600">{stats.desviacion_estandar} min</p></div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportesAtencion;
