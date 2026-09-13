import { useState, useEffect } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Legend } from 'recharts';
import { Database, BarChart3, Loader2, Filter, TrendingUp, RefreshCw } from 'lucide-react';
import { fetchTiempos, fetchComentarios, fetchAnalisisNLP, fetchClientes, calcStats, agruparPorDia, agruparPorOperador, FiltrosCompletos } from '@/services/statsService';

const CAT_COLORS: Record<string, string> = { FELICITACION: '#059669', RECLAMO: '#dc2626', SOPORTE: '#2563eb', VENTAS: '#d97706', CONSULTA: '#7c3aed' };

export const ReportesEstadisticas = () => {
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);
  const [filtros, setFiltros] = useState<FiltrosCompletos>({});
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const [tiemposStats, setTiemposStats] = useState<any>(null);
  const [totalTiempos, setTotalTiempos] = useState(0);
  const [totalComentarios, setTotalComentarios] = useState(0);
  const [procesados, setProcesados] = useState(0);
  const [totalAnalisis, setTotalAnalisis] = useState(0);
  const [catDistribucion, setCatDistribucion] = useState<{ name: string; total: number }[]>([]);
  const [sentDistribucion, setSentDistribucion] = useState<{ name: string; value: number }[]>([]);
  const [tiemposDiarios, setTiemposDiarios] = useState<{ fecha: string; promedio: number; cantidad: number; minimo: number; maximo: number }[]>([]);
  const [porOperador, setPorOperador] = useState<{ nombre: string; registros: number; promedio: number; minimo: number; maximo: number }[]>([]);
  const [confProm, setConfProm] = useState(0);

  const fetchData = async (f: FiltrosCompletos = {}) => {
    setLoading(true);
    try {
      const [tiempos, comentarios, nlpData, clientesData] = await Promise.all([
        fetchTiempos(f), fetchComentarios(f), fetchAnalisisNLP(f), fetchClientes(),
      ]);
      setClientes(clientesData);

      const vals = tiempos.map(t => t.tiempo_minutos);
      setTotalTiempos(vals.length);
      setTiemposStats(calcStats(vals));

      setTotalComentarios(comentarios.length);
      setProcesados(comentarios.filter(c => c.procesado).length);
      setTotalAnalisis(nlpData.length);

      const catMap: Record<string, number> = {};
      nlpData.forEach((r: any) => { if (r.categoria_detectada) catMap[r.categoria_detectada] = (catMap[r.categoria_detectada] || 0) + 1; });
      setCatDistribucion(Object.entries(catMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total));

      const sentMap: Record<string, number> = {};
      nlpData.forEach((r: any) => { if (r.sentimiento) sentMap[r.sentimiento] = (sentMap[r.sentimiento] || 0) + 1; });
      setSentDistribucion(Object.entries(sentMap).map(([name, value]) => ({ name, value })));

      const confVals = nlpData.filter((r: any) => r.confianza != null).map((r: any) => Number(r.confianza) * 100);
      setConfProm(confVals.length > 0 ? Math.round(confVals.reduce((a: number, b: number) => a + b, 0) / confVals.length) : 0);

      setTiemposDiarios(agruparPorDia(tiempos));
      setPorOperador(agruparPorOperador(tiempos));
    } catch { /* empty */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const aplicar = () => { fetchData(filtros); setMostrarFiltros(false); };
  const limpiar = () => { setFiltros({}); fetchData({}); setMostrarFiltros(false); };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes Estadisticos</h2>
          <p className="text-slate-500 text-sm mt-1">Resumen general de todas las tablas del sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2"><Filter size={16} /> Filtros</button>
          <button onClick={() => fetchData(filtros)} disabled={loading} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Recalcular</button>
        </div>
      </div>

      {mostrarFiltros && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-700 mb-3">Filtros del reporte</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label className="block text-xs text-slate-500 mb-1">Fecha inicio</label><input type="date" value={filtros.fecha_inicio || ''} onChange={e => setFiltros(f => ({ ...f, fecha_inicio: e.target.value || undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Fecha fin</label><input type="date" value={filtros.fecha_fin || ''} onChange={e => setFiltros(f => ({ ...f, fecha_fin: e.target.value || undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Cliente</label><select value={filtros.cliente_id || ''} onChange={e => setFiltros(f => ({ ...f, cliente_id: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"><option value="">Todos</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><label className="block text-xs text-slate-500 mb-1">Categoria NLP</label><select value={filtros.categoria || ''} onChange={e => setFiltros(f => ({ ...f, categoria: e.target.value || undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"><option value="">Todas</option>{catDistribucion.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={aplicar} className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 rounded-lg transition">Aplicar</button>
            <button onClick={limpiar} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm py-2 px-4 rounded-lg transition">Limpiar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : totalTiempos === 0 && totalComentarios === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Database size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No hay datos suficientes</h3>
          <p className="text-slate-400 text-sm">Los reportes se generaran cuando haya datos en las tablas del sistema.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Comentarios', valor: totalComentarios, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Procesados', valor: procesados, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Analisis NLP', valor: totalAnalisis, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Tiempos registrados', valor: totalTiempos, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}><Database size={20} /></span>
                <div><p className="text-xs text-slate-500 uppercase">{k.label}</p><p className="text-xl font-bold text-slate-800">{k.valor}</p></div>
              </div>
            ))}
          </div>

          {tiemposStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Media tiempos', valor: `${tiemposStats.media} min`, color: 'text-blue-600' },
                { label: 'Mediana tiempos', valor: `${tiemposStats.mediana} min`, color: 'text-purple-600' },
                { label: 'Desv. estandar', valor: `${tiemposStats.desviacion_estandar} min`, color: 'text-amber-600' },
                { label: 'Min - Max', valor: `${tiemposStats.minimo} – ${tiemposStats.maximo} min`, color: 'text-emerald-600' },
                { label: 'P25 - P75', valor: `${tiemposStats.percentil_25} – ${tiemposStats.percentil_75} min`, color: 'text-blue-600' },
                { label: 'Confianza NLP prom.', valor: totalAnalisis > 0 ? `${confProm}%` : '—', color: 'text-purple-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.valor}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {tiemposDiarios.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600" /> Tiempos Diarios</h3>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tiemposDiarios.slice(-12)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Bar dataKey="promedio" name="Promedio (min)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {catDistribucion.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-amber-600" /> Categorias NLP</h3>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={catDistribucion}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Bar dataKey="total" name="Analisis" radius={[6, 6, 0, 0]}>
                        {catDistribucion.map(c => <Cell key={c.name} fill={CAT_COLORS[c.name] || '#6366f1'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {sentDistribucion.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
              <h3 className="font-semibold text-slate-700 mb-4">Distribucion de Sentimiento</h3>
              <div className="flex flex-wrap gap-4">
                {sentDistribucion.map(s => {
                  const pct = Math.round((s.value / totalAnalisis) * 100);
                  return (
                    <div key={s.name} className="bg-slate-50 rounded-xl p-4 min-w-[150px] text-center">
                      <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                      <p className="text-xs text-slate-500 capitalize">{s.name} ({pct}%)</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {porOperador.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-4">Tiempo Promedio por Operador</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100"><th className="text-left py-3 px-4 font-medium text-slate-500">Operador</th><th className="text-left py-3 px-4 font-medium text-slate-500">Registros</th><th className="text-left py-3 px-4 font-medium text-slate-500">Promedio</th><th className="text-left py-3 px-4 font-medium text-slate-500">Minimo</th><th className="text-left py-3 px-4 font-medium text-slate-500">Maximo</th></tr></thead>
                  <tbody>
                    {porOperador.map(op => (
                      <tr key={op.nombre} className="border-b border-slate-50"><td className="py-3 px-4 font-medium">{op.nombre}</td><td className="py-3 px-4">{op.registros}</td><td className="py-3 px-4 font-medium text-blue-600">{op.promedio} min</td><td className="py-3 px-4 text-emerald-600">{op.minimo} min</td><td className="py-3 px-4 text-red-600">{op.maximo} min</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportesEstadisticas;
