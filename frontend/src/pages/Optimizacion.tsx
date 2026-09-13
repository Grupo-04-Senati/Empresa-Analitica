import { useState, useEffect, useMemo } from 'react';
import { Rocket, TrendingUp, Plus, Trash2, Loader2, X, Search, Zap, BarChart3, Users, Clock, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '@/services/supabase';
import { optimizarCostos, optimizarOperadores, optimizarTiempos, optimizarCarga, OptimResult } from '@/services/optimService';

interface OptimRow {
  id: number; nombre: string; descripcion: string | null; parametros_entrada: any; resultado: any;
  costo_inicial: number | null; costo_optimizado: number | null; estado: string; created_at: string;
}

const TIPOS = [
  { id: 'costos', label: 'Costos Operativos', icono: Zap, color: 'text-blue-600', bg: 'bg-blue-50', desc: 'Minimizar costos con funcion objetivo cuadratica' },
  { id: 'operadores', label: 'Asignacion de Operadores', icono: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Optimizar distribucion de operadores por canal' },
  { id: 'tiempos', label: 'Tiempos de Atencion', icono: Clock, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Minimizar desviacion respecto al tiempo promedio' },
  { id: 'carga', label: 'Carga de Trabajo', icono: Activity, color: 'text-purple-600', bg: 'bg-purple-50', desc: 'Equilibrar carga entre operadores' },
];

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];

export const Optimizacion = () => {
  const [datos, setDatos] = useState<OptimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tipoSeleccionado, setTipoSeleccionado] = useState('costos');
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultado, setResultado] = useState<OptimResult | null>(null);

  const [formCostos, setFormCostos] = useState({ recurso_a: '3', recurso_b: '5' });
  const [formOperadores, setFormOperadores] = useState({ web: '3', telefono: '2', presencial: '2' });
  const [formTiempos, setFormTiempos] = useState({ tipo_solicitud_1: '25', tipo_solicitud_2: '35', tipo_solicitud_3: '15', minimo: '5', maximo: '60' });
  const [formCarga, setFormCarga] = useState({ operadores: '5', solicitudes: '40', maxPorOperador: '10' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('optimizaciones').select('*').order('created_at', { ascending: false });
      setDatos((data || []) as OptimRow[]);
    } catch { /* empty */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const channel = supabase.channel('optim-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'optimizaciones' }, fetchData).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalOptimizaciones = datos.length;
  const completadas = datos.filter(d => d.estado === 'completado').length;
  const ahorroTotal = datos.filter(d => d.estado === 'completado').reduce((s, d) => s + ((d.costo_inicial || 0) - (d.costo_optimizado || 0)), 0);

  const chartData = useMemo(() => {
    return datos.slice(0, 10).reverse().map(d => ({
      nombre: d.nombre.slice(0, 15), inicial: d.costo_inicial || 0, optimizado: d.costo_optimizado || 0,
    }));
  }, [datos]);

  const tipoDistribucion = useMemo(() => {
    const map: Record<string, number> = {};
    datos.forEach(d => { const t = d.parametros_entrada?.tipo || 'otro'; map[t] = (map[t] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [datos]);

  const ejecutar = () => {
    setSaving(true);
    setResultado(null);
    setTimeout(() => {
      let res: OptimResult;
      switch (tipoSeleccionado) {
        case 'costos':
          res = optimizarCostos({ recurso_a: parseFloat(formCostos.recurso_a) || 3, recurso_b: parseFloat(formCostos.recurso_b) || 5 });
          break;
        case 'operadores':
          res = optimizarOperadores({ web: parseInt(formOperadores.web) || 3, telefono: parseInt(formOperadores.telefono) || 2, presencial: parseInt(formOperadores.presencial) || 2, costoWeb: 15, costoTel: 20, costoPres: 25, demandaWeb: 30, demandaTel: 20, demandaPres: 15 });
          break;
        case 'tiempos': {
          const tiempos: Record<string, number> = {};
          Object.entries(formTiempos).forEach(([k, v]) => { if (k !== 'minimo' && k !== 'maximo') tiempos[k] = parseFloat(v) || 20; });
          res = optimizarTiempos({ tiempos, minimo: parseFloat(formTiempos.minimo) || 5, maximo: parseFloat(formTiempos.maximo) || 60 });
          break;
        }
        case 'carga':
          res = optimizarCarga({ operadores: parseInt(formCarga.operadores) || 5, solicitudes: parseInt(formCarga.solicitudes) || 40, maxPorOperador: parseInt(formCarga.maxPorOperador) || 10 });
          break;
        default:
          res = { variables: {}, costo_inicial: 0, costo_optimizado: 0, ahorro: 0, converge: false, iteraciones: 0, metodo: 'N/A' };
      }
      setResultado(res);
      setSaving(false);
    }, 500);
  };

  const guardar = async () => {
    if (!resultado) return;
    setSaving(true);
    const tipo = TIPOS.find(t => t.id === tipoSeleccionado);
    const { error } = await supabase.from('optimizaciones').insert({
      nombre: tipo?.label || tipoSeleccionado,
      descripcion: `${tipo?.desc}. Metodo: ${resultado.metodo}. Iteraciones: ${resultado.iteraciones}`,
      parametros_entrada: { tipo: tipoSeleccionado, ...(tipoSeleccionado === 'costos' ? formCostos : tipoSeleccionado === 'operadores' ? formOperadores : tipoSeleccionado === 'tiempos' ? formTiempos : formCarga) },
      resultado: resultado.variables,
      costo_inicial: resultado.costo_inicial,
      costo_optimizado: resultado.costo_optimizado,
      estado: 'completado',
    });
    if (!error) { setShowModal(false); setResultado(null); fetchData(); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Eliminar esta optimizacion?')) return;
    await supabase.from('optimizaciones').delete().eq('id', id);
    fetchData();
  };

  const filtrados = datos.filter(d => `${d.nombre} ${d.descripcion || ''}`.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Optimizacion</h2>
          <p className="text-slate-500 text-sm mt-1">Minimizar costos, tiempos y carga con scipy.optimize.minimize</p>
        </div>
        <button onClick={() => { setShowModal(true); setResultado(null); setTipoSeleccionado('costos'); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition">
          <Plus size={16} /> Nueva Optimizacion
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'TOTAL', valor: totalOptimizaciones, icono: Rocket, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'COMPLETADAS', valor: completadas, icono: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'AHORRO TOTAL', valor: ahorroTotal > 0 ? `$${ahorroTotal.toFixed(2)}` : '$0.00', icono: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(k => {
          const Icon = k.icono;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
              <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}><Icon size={20} /></span>
              <div><p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p><p className="text-xl font-bold text-slate-800">{k.valor}</p></div>
            </div>
          );
        })}
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-blue-600" /> Costo Inicial vs Optimizado</h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey="inicial" name="Inicial" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="optimizado" name="Optimizado" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {tipoDistribucion.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Zap size={18} className="text-emerald-600" /> Distribucion por Tipo</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={tipoDistribucion} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                    {tipoDistribucion.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip /><Legend verticalAlign="bottom" iconType="circle" iconSize={8} /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="flex items-center gap-3 p-5 border-b border-slate-100">
          <Rocket size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700">Historial</h3>
          <div className="relative flex-1 max-w-sm ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
        </div>
        {loading ? (
          <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 font-medium text-slate-500">Nombre</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Descripcion</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Costo Inicial</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Costo Optimizado</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Ahorro</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th>
              </tr></thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={8} className="py-12 text-center text-slate-400">No hay optimizaciones</td></tr>
                ) : filtrados.map(d => {
                  const ahorro = (d.costo_inicial || 0) - (d.costo_optimizado || 0);
                  return (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-800">{d.nombre}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{d.descripcion || 'Sin descripcion'}</td>
                      <td className="py-3 px-4 text-slate-600">${(d.costo_inicial || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-slate-600">${(d.costo_optimizado || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 font-medium text-emerald-600">{ahorro > 0 ? `$${ahorro.toFixed(2)}` : '$0.00'}</td>
                      <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${d.estado === 'completado' ? 'bg-emerald-100 text-emerald-700' : d.estado === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{d.estado}</span></td>
                      <td className="py-3 px-4 text-slate-500 text-xs">{new Date(d.created_at).toLocaleDateString('es-ES')}</td>
                      <td className="py-3 px-4 text-right"><button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Nueva Optimizacion</h3>
              <button onClick={() => { setShowModal(false); setResultado(null); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>

            <div className="p-5">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Tipo de optimizacion</h4>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {TIPOS.map(t => {
                  const Icon = t.icono;
                  return (
                    <button key={t.id} onClick={() => { setTipoSeleccionado(t.id); setResultado(null); }}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${tipoSeleccionado === t.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-center gap-2 mb-1"><Icon size={18} className={t.color} /><span className="text-sm font-semibold text-slate-800">{t.label}</span></div>
                      <p className="text-xs text-slate-500">{t.desc}</p>
                    </button>
                  );
                })}
              </div>

              <h4 className="text-sm font-semibold text-slate-700 mb-3">Parametros</h4>
              {tipoSeleccionado === 'costos' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-xs text-slate-500 mb-1">Recurso A</label><input type="number" step="0.1" value={formCostos.recurso_a} onChange={e => setFormCostos(f => ({ ...f, recurso_a: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">Recurso B</label><input type="number" step="0.1" value={formCostos.recurso_b} onChange={e => setFormCostos(f => ({ ...f, recurso_b: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
                </div>
              )}
              {tipoSeleccionado === 'operadores' && (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div><label className="block text-xs text-slate-500 mb-1">Web</label><input type="number" value={formOperadores.web} onChange={e => setFormOperadores(f => ({ ...f, web: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">Telefono</label><input type="number" value={formOperadores.telefono} onChange={e => setFormOperadores(f => ({ ...f, telefono: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">Presencial</label><input type="number" value={formOperadores.presencial} onChange={e => setFormOperadores(f => ({ ...f, presencial: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
                </div>
              )}
              {tipoSeleccionado === 'tiempos' && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {Object.entries(formTiempos).map(([k, v]) => (
                    <div key={k}><label className="block text-xs text-slate-500 mb-1">{k.replace(/_/g, ' ')}</label><input type="number" value={v} onChange={e => setFormTiempos(f => ({ ...f, [k]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
                  ))}
                </div>
              )}
              {tipoSeleccionado === 'carga' && (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div><label className="block text-xs text-slate-500 mb-1">Operadores</label><input type="number" value={formCarga.operadores} onChange={e => setFormCarga(f => ({ ...f, operadores: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">Solicitudes</label><input type="number" value={formCarga.solicitudes} onChange={e => setFormCarga(f => ({ ...f, solicitudes: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">Max/Operador</label><input type="number" value={formCarga.maxPorOperador} onChange={e => setFormCarga(f => ({ ...f, maxPorOperador: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" /></div>
                </div>
              )}

              <div className="flex gap-2 mb-4">
                <button onClick={ejecutar} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Ejecutar
                </button>
                {resultado && (
                  <button onClick={guardar} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
                    Guardar en Supabase
                  </button>
                )}
              </div>

              {resultado && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Resultado</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Inicial</p><p className="text-lg font-bold text-red-600">${resultado.costo_inicial}</p></div>
                    <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Optimizado</p><p className="text-lg font-bold text-emerald-600">${resultado.costo_optimizado}</p></div>
                    <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Ahorro</p><p className="text-lg font-bold text-amber-600">${resultado.ahorro}</p></div>
                    <div className="bg-white rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Iteraciones</p><p className="text-lg font-bold text-blue-600">{resultado.iteraciones}</p></div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Variables optimizadas:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(resultado.variables).map(([k, v]) => (
                        <span key={k} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{k}: {v}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Optimizacion;
