import { useState, useEffect } from 'react';
import { Database, Calculator, BarChart3, TrendingUp, RefreshCw, Loader2, AlertTriangle, BrainCircuit, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calcStats, fetchTiempos, fetchComentarios, fetchAnalisisNLP, fetchClientes, StatsResult, FiltrosCompletos } from '@/services/statsService';

const KpiCard = ({ icono: Icon, valor, subtitulo, color, bg }: { icono: any; valor: string | number; subtitulo: string; color: string; bg: string }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
    <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${bg} ${color}`}><Icon size={20} /></span>
    <div><p className="text-xl font-bold text-slate-800">{valor}</p><p className="text-xs text-slate-500">{subtitulo}</p></div>
  </div>
);

export const Estadisticas = () => {
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [resumen, setResumen] = useState({ totalComentarios: 0, procesados: 0, totalAnalisis: 0, totalTiempos: 0 });
  const [catDistribucion, setCatDistribucion] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);
  const [filtros, setFiltros] = useState<FiltrosCompletos>({});
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const fetchData = async (f: FiltrosCompletos = {}) => {
    setLoading(true);
    try {
      const [tiempos, comentarios, nlpData, clientesData] = await Promise.all([
        fetchTiempos(f), fetchComentarios(f), fetchAnalisisNLP(f), fetchClientes(),
      ]);
      setClientes(clientesData);

      const tiemposVals = tiempos.map(t => t.tiempo_minutos);
      setStats(calcStats(tiemposVals));

      setResumen({
        totalTiempos: tiempos.length,
        totalComentarios: comentarios.length,
        procesados: comentarios.filter(c => c.procesado).length,
        totalAnalisis: nlpData.length,
      });

      const catMap: Record<string, number> = {};
      nlpData.forEach((r: any) => { if (r.categoria_detectada) catMap[r.categoria_detectada] = (catMap[r.categoria_detectada] || 0) + 1; });
      setCatDistribucion(Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
    } catch { /* empty */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const aplicarFiltros = () => { fetchData(filtros); setMostrarFiltros(false); };
  const limpiarFiltros = () => { setFiltros({}); fetchData({}); setMostrarFiltros(false); };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Estadisticas Avanzadas</h2>
          <p className="text-slate-500 text-sm mt-1">Analisis de datos de las tablas del sistema usando metodos estadisticos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2 transition">
            <Filter size={16} /> Filtros
          </button>
          <button onClick={() => fetchData(filtros)} disabled={loading} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2 transition disabled:opacity-50">
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

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : resumen.totalTiempos === 0 && resumen.totalComentarios === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Database size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">Recopilando datos insuficientes para el modelado</h3>
          <p className="text-slate-400 text-sm">Las estadisticas se calcularan cuando haya datos en las tablas tiempos_atencion, comentarios o analisis_nlp.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard icono={Database} valor={resumen.totalTiempos} subtitulo="Registros de tiempos" color="text-blue-600" bg="bg-blue-50" />
            <KpiCard icono={Calculator} valor={stats ? `${stats.media} min` : '—'} subtitulo="Media de tiempos" color="text-emerald-600" bg="bg-emerald-50" />
            <KpiCard icono={BarChart3} valor={stats ? `${stats.desviacion_estandar} min` : '—'} subtitulo="Desviacion estandar" color="text-amber-600" bg="bg-amber-50" />
            <KpiCard icono={BrainCircuit} valor={resumen.totalAnalisis} subtitulo="Analisis NLP" color="text-purple-600" bg="bg-purple-50" />
          </div>

          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Minimo', valor: `${stats.minimo} min`, color: 'text-emerald-600' },
                { label: 'Maximo', valor: `${stats.maximo} min`, color: 'text-red-600' },
                { label: 'Mediana', valor: `${stats.mediana} min`, color: 'text-purple-600' },
                { label: 'P25', valor: `${stats.percentil_25} min`, color: 'text-blue-600' },
                { label: 'P75', valor: `${stats.percentil_75} min`, color: 'text-blue-600' },
                { label: 'Cantidad', valor: `${stats.cantidad} registros`, color: 'text-slate-800' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.valor}</p>
                </div>
              ))}
            </div>
          )}

          {stats && stats.desviacion_estandar > stats.media * 0.5 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">Alta variabilidad detectada</p>
                <p className="text-sm text-amber-700">La desviacion estandar ({stats.desviacion_estandar} min) es alta comparada con la media ({stats.media} min), lo que indica tiempos de atencion inconsistentes.</p>
              </div>
            </div>
          )}

          {catDistribucion.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><BrainCircuit size={18} className="text-blue-600" /> Distribucion de Categorias (NLP)</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={catDistribucion}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Bar dataKey="value" name="Analisis" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600" /> Resumen de Datos</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div><p className="text-2xl font-bold text-slate-800">{resumen.totalComentarios}</p><p className="text-xs text-slate-500">Comentarios totales</p></div>
              <div><p className="text-2xl font-bold text-emerald-600">{resumen.procesados}</p><p className="text-xs text-slate-500">Procesados</p></div>
              <div><p className="text-2xl font-bold text-blue-600">{resumen.totalAnalisis}</p><p className="text-xs text-slate-500">Analisis NLP</p></div>
              <div><p className="text-2xl font-bold text-amber-600">{resumen.totalTiempos}</p><p className="text-xs text-slate-500">Tiempos registrados</p></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Estadisticas;
