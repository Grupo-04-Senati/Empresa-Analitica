import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { BrainCircuit, FileBarChart, TrendingUp, Hash, Loader2, Filter } from 'lucide-react';
import { fetchAnalisisNLP, fetchComentarios, fetchClientes, FiltrosCompletos } from '@/services/statsService';

const COLORS = ['#059669', '#d97706', '#dc2626', '#2563eb', '#7c3aed', '#0891b2'];

export const ReportesNLP = () => {
  const [analisis, setAnalisis] = useState<any[]>([]);
  const [totalComentarios, setTotalComentarios] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);
  const [filtros, setFiltros] = useState<FiltrosCompletos>({});
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const fetchData = async (f: FiltrosCompletos = {}) => {
    setLoading(true);
    try {
      const [nlpData, comData, clientesData] = await Promise.all([fetchAnalisisNLP(f), fetchComentarios(f), fetchClientes()]);
      setAnalisis(nlpData); setTotalComentarios(comData.length); setClientes(clientesData);
    } catch { /* empty */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const catMap: Record<string, number> = {};
  analisis.forEach((r: any) => { if (r.categoria_detectada) catMap[r.categoria_detectada] = (catMap[r.categoria_detectada] || 0) + 1; });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const confValues = analisis.filter((r: any) => r.confianza != null).map((r: any) => Number(r.confianza) * 100);
  const confProm = confValues.length > 0 ? Math.round(confValues.reduce((a, b) => a + b, 0) / confValues.length) : 0;

  const sentMap: Record<string, number> = {};
  analisis.forEach((r: any) => { if (r.sentimiento) sentMap[r.sentimiento] = (sentMap[r.sentimiento] || 0) + 1; });
  const sentData = Object.entries(sentMap).map(([name, value]) => ({ name, value }));

  const detalle = analisis.slice(0, 50).map((r: any) => ({
    id: r.id, categoria: r.categoria_detectada,
    confianza: r.confianza != null ? Number(r.confianza) * 100 : null,
    contenido: r.comentarios?.contenido || '—',
    cliente: (r.comentarios as any)?.clientes?.nombre || '—',
    fecha: r.comentarios?.fecha?.split('T')[0] || '—',
  }));

  const tieneDatos = analisis.length > 0;

  const aplicar = () => { fetchData(filtros); setMostrarFiltros(false); };
  const limpiar = () => { setFiltros({}); fetchData({}); setMostrarFiltros(false); };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes NLP</h2>
          <p className="text-slate-500 text-sm mt-1">Analisis de categorias y sentimiento - datos de analisis_nlp + comentarios + clientes</p>
        </div>
        <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm py-2 px-4 rounded-lg flex items-center gap-2"><Filter size={16} /> Filtros</button>
      </div>

      {mostrarFiltros && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-700 mb-3">Filtros de analisis NLP</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label className="block text-xs text-slate-500 mb-1">Fecha inicio</label><input type="date" value={filtros.fecha_inicio || ''} onChange={e => setFiltros(f => ({ ...f, fecha_inicio: e.target.value || undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Fecha fin</label><input type="date" value={filtros.fecha_fin || ''} onChange={e => setFiltros(f => ({ ...f, fecha_fin: e.target.value || undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Cliente</label><select value={filtros.cliente_id || ''} onChange={e => setFiltros(f => ({ ...f, cliente_id: e.target.value ? Number(e.target.value) : undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"><option value="">Todos</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><label className="block text-xs text-slate-500 mb-1">Categoria</label><select value={filtros.categoria || ''} onChange={e => setFiltros(f => ({ ...f, categoria: e.target.value || undefined }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"><option value="">Todas</option>{catData.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button onClick={aplicar} className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4 rounded-lg transition">Aplicar</button>
            <button onClick={limpiar} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm py-2 px-4 rounded-lg transition">Limpiar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : !tieneDatos ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BrainCircuit size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No hay datos de analisis NLP</h3>
          <p className="text-slate-400 text-sm">Los reportes se generaran cuando se analicen comentarios en la tabla analisis_nlp.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Analizados', valor: analisis.length, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Confianza prom.', valor: confProm > 0 ? `${confProm}%` : '—', color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Categorias', valor: catData.length, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Comentarios', valor: totalComentarios, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}><BrainCircuit size={20} /></span>
                <div><p className="text-xs text-slate-500 uppercase">{k.label}</p><p className="text-xl font-bold text-slate-800">{k.valor}</p></div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-4">Distribucion por Categoria</h3>
              {catData.length === 0 ? <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">Sin datos</div> : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={catData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                      {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Legend verticalAlign="bottom" iconType="circle" iconSize={8} /></PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-4">Sentimiento Detectado</h3>
              {sentData.length === 0 ? <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">Sin datos de sentimiento</div> : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sentData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Bar dataKey="value" name="Cantidad" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 mb-6">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100">
              <Hash size={18} className="text-amber-600" />
              <h3 className="font-semibold text-slate-700">Categorias Detectadas</h3>
            </div>
            <div className="p-5 flex flex-col gap-3">
              {catData.length === 0 ? <div className="text-slate-400 text-sm">Sin datos</div> : catData.map(c => {
                const pct = Math.round((c.value / analisis.length) * 100);
                return (<div key={c.name}><div className="flex items-center justify-between mb-1"><span className="text-sm text-slate-700">{c.name}</span><span className="text-xs font-medium text-blue-600">{c.value} ({pct}%)</span></div><div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} /></div></div>);
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100">
              <FileBarChart size={18} className="text-blue-600" />
              <h3 className="font-semibold text-slate-700">Detalle de Analisis</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100"><th className="text-left py-3 px-4 font-medium text-slate-500">ID</th><th className="text-left py-3 px-4 font-medium text-slate-500">Cliente</th><th className="text-left py-3 px-4 font-medium text-slate-500">Comentario</th><th className="text-left py-3 px-4 font-medium text-slate-500">Categoria</th><th className="text-left py-3 px-4 font-medium text-slate-500">Confianza</th><th className="text-left py-3 px-4 font-medium text-slate-500">Fecha</th></tr></thead>
                <tbody>
                  {detalle.map(a => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium">#{a.id}</td>
                      <td className="py-3 px-4">{a.cliente}</td>
                      <td className="py-3 px-4 max-w-xs truncate">{a.contenido?.slice(0, 60)}</td>
                      <td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{a.categoria || '—'}</span></td>
                      <td className="py-3 px-4 font-medium">{a.confianza != null ? `${a.confianza.toFixed(0)}%` : '—'}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">{a.fecha}</td>
                    </tr>
                  ))}
                  {detalle.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-sm">No hay analisis</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportesNLP;
