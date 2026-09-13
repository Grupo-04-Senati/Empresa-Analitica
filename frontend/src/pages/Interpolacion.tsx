import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Database, RefreshCw, Loader2, Filter, TrendingUp } from 'lucide-react';
import { fetchTiempos, fetchClientes, calcularInterpolacion, InterpResult, FiltrosCompletos } from '@/services/statsService';

export const Interpolacion = () => {
  const [resultado, setResultado] = useState<InterpResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);
  const [filtros, setFiltros] = useState<FiltrosCompletos>({});
  const [metodo, setMetodo] = useState('lineal');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const fetchData = async (f: FiltrosCompletos = {}, m: string = metodo) => {
    setLoading(true); setError('');
    try {
      const [tiempos, clientesData] = await Promise.all([fetchTiempos(f), fetchClientes()]);
      setClientes(clientesData);
      if (tiempos.length < 2) { setResultado(null); return; }
      const res = calcularInterpolacion(tiempos, m);
      setResultado(res);
    } catch { setError('Error al procesar interpolacion'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const aplicarFiltros = () => { fetchData(filtros, metodo); setMostrarFiltros(false); };
  const limpiarFiltros = () => { setFiltros({}); fetchData({}, metodo); setMostrarFiltros(false); };

  const chartData = resultado?.puntos.map(p => ({
    fecha: p.fecha, Observado: p.observado, Interpolado: p.interpolado,
  })) || [];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Interpolacion de Tiempos</h2>
          <p className="text-slate-500 text-sm mt-1">Modelado en tiempo real con datos de tiempos_atencion usando SciPy</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={metodo} onChange={e => { setMetodo(e.target.value); fetchData(filtros, e.target.value); }} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
            <option value="lineal">Lineal</option>
            <option value="cuadratico">Cuadratico</option>
          </select>
          <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2 transition">
            <Filter size={16} /> Filtros
          </button>
          <button onClick={() => fetchData(filtros, metodo)} disabled={loading} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2 transition disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Recalcular
          </button>
        </div>
      </div>

      {mostrarFiltros && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-700 mb-3">Filtros de datos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label className="block text-xs text-slate-500 mb-1">Fecha inicio</label><input type="date" value={filtros.fecha_inicio || ''} onChange={e => setFiltros(f => ({ ...f, fecha_inicio: e.target.value || undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Fecha fin</label><input type="date" value={filtros.fecha_fin || ''} onChange={e => setFiltros(f => ({ ...f, fecha_fin: e.target.value || undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Cliente</label><select value={filtros.cliente_id || ''} onChange={e => setFiltros(f => ({ ...f, cliente_id: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"><option value="">Todos</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={aplicarFiltros} className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 rounded-lg transition">Aplicar</button>
            <button onClick={limpiarFiltros} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm py-2 px-4 rounded-lg transition">Limpiar</button>
          </div>
        </div>
      )}

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>}

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : !resultado ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Database size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Recopilando datos insuficientes para el modelado</h3>
          <p className="text-slate-400 text-sm">La interpolacion requiere al menos 2 registros en la tabla tiempos_atencion.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Metodo</p><p className="text-xl font-bold text-blue-600 capitalize">{resultado.metodo}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Puntos reales</p><p className="text-xl font-bold text-emerald-600">{resultado.puntos_reales}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Puntos estimados</p><p className="text-xl font-bold text-amber-600">{resultado.puntos_estimados}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Rango</p><p className="text-sm font-bold text-slate-800">{resultado.fecha_inicio} a {resultado.fecha_fin}</p></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">R2</p><p className="text-xl font-bold text-purple-600">{resultado.r2.toFixed(4)}</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Error Medio</p><p className="text-xl font-bold text-amber-600">{resultado.error_medio} min</p></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs text-slate-500 uppercase tracking-wide">Error Relativo</p><p className="text-xl font-bold text-red-600">{resultado.error_relativo}%</p></div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600" /> Modelo de Interpolacion (metodo: {resultado.metodo})</h3>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Minutos', angle: -90, position: 'insideLeft', offset: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} />
                  <Line type="monotone" dataKey="Observado" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb' }} connectNulls={false} />
                  <Line type="monotone" dataKey="Interpolado" stroke="#d97706" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: '#d97706' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-3">Tabla de Resultados</h3>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-100"><th className="text-left py-2 px-3 font-medium text-slate-500">#</th><th className="text-left py-2 px-3 font-medium text-slate-500">Fecha</th><th className="text-left py-2 px-3 font-medium text-slate-500">Observado</th><th className="text-left py-2 px-3 font-medium text-slate-500">Interpolado</th><th className="text-left py-2 px-3 font-medium text-slate-500">Tipo</th></tr></thead>
                <tbody>
                  {resultado.puntos.map(p => (
                    <tr key={p.x} className="border-b border-slate-50"><td className="py-2 px-3 font-medium">{p.x}</td><td className="py-2 px-3">{p.fecha}</td><td className="py-2 px-3">{p.observado != null ? `${p.observado} min` : '—'}</td><td className="py-2 px-3 font-medium text-blue-600">{p.interpolado} min</td><td className="py-2 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.es_prediccion ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{p.es_prediccion ? 'Estimado' : 'Real'}</span></td></tr>
                  ))}
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
