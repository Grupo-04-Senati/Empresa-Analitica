import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { MessageSquare, Plus, Send, Trash2, Filter, X, Loader2, Clock, CheckCircle2, AlertTriangle, BarChart3, Search, Edit3 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';

interface ComentarioDB {
  id: number;
  cliente_id: number | null;
  contenido: string;
  canal: string;
  estado: string;
  categoria: string | null;
  fecha: string;
  procesado: boolean;
  clientes?: { nombre: string; empresa: string } | null;
}

interface ClienteOption { id: number; nombre: string; empresa: string; }

const canalOptions = ['web', 'email', 'telefono', 'chat', 'redes'];
const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#ec4899'];

const estadoConfig: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  en_proceso: { label: 'En Proceso', cls: 'bg-blue-100 text-blue-700', icon: AlertTriangle },
  resuelto: { label: 'Resuelto', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
};

export const Comentarios = () => {
  const { canEdit } = useAuth();
  const [comentarios, setComentarios] = useState<ComentarioDB[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [contenido, setContenido] = useState('');
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [canal, setCanal] = useState('web');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [comRes, cliRes] = await Promise.all([
      supabase.from('comentarios').select('*, clientes(nombre, empresa)').order('fecha', { ascending: false }),
      supabase.from('clientes').select('id, nombre, empresa').eq('activo', true).order('nombre'),
    ]);
    if (comRes.data) setComentarios(comRes.data as unknown as ComentarioDB[]);
    if (cliRes.data) setClientes(cliRes.data as ClienteOption[]);
    setLoading(false);
  };

  const stats = useMemo(() => ({
    total: comentarios.length,
    pendientes: comentarios.filter(c => c.estado === 'pendiente').length,
    enProceso: comentarios.filter(c => c.estado === 'en_proceso').length,
    resueltos: comentarios.filter(c => c.estado === 'resuelto').length,
  }), [comentarios]);

  const chartData = useMemo(() => {
    const porCanal: Record<string, number> = {};
    comentarios.forEach(c => { porCanal[c.canal] = (porCanal[c.canal] || 0) + 1; });
    return Object.entries(porCanal).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [comentarios]);

  const estadoPieData = [
    { name: 'Pendientes', value: stats.pendientes, color: '#d97706' },
    { name: 'En Proceso', value: stats.enProceso, color: '#2563eb' },
    { name: 'Resueltos', value: stats.resueltos, color: '#059669' },
  ];

  const filtrados = useMemo(() => {
    let result = comentarios;
    if (filtroEstado !== 'todos') result = result.filter(c => c.estado === filtroEstado);
    if (busqueda) {
      const q = busqueda.toLowerCase();
      result = result.filter(c =>
        `${c.clientes?.nombre || ''} ${c.contenido} ${c.categoria || ''} ${c.canal}`.toLowerCase().includes(q)
      );
    }
    return result;
  }, [comentarios, filtroEstado, busqueda]);

  const crearComentario = async (e: FormEvent) => {
    e.preventDefault();
    if (!contenido.trim()) return;
    setProcesando(true);
    setError('');
    try {
      const { error: err } = await supabase.from('comentarios').insert({
        cliente_id: clienteId || null, contenido: contenido.trim(), canal, estado: 'pendiente', procesado: false,
      });
      if (err) throw err;
      setContenido(''); setClienteId(''); setCanal('web'); setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setProcesando(false);
    }
  };

  const actualizarEstado = async (id: number, nuevoEstado: string) => {
    const { error } = await supabase.from('comentarios').update({ estado: nuevoEstado }).eq('id', id);
    if (!error) setComentarios(prev => prev.map(c => c.id === id ? { ...c, estado: nuevoEstado } : c));
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este comentario?')) return;
    const { error } = await supabase.from('comentarios').delete().eq('id', id);
    if (!error) setComentarios(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Solicitudes y Comentarios</h2>
          <p className="text-slate-500 text-sm mt-1">Gestion centralizada de solicitudes de clientes</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25">
          <Plus size={16} /> Nueva Solicitud
        </button>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 mb-4 flex items-center gap-2"><X size={14} />{error}<button onClick={() => setError('')} className="ml-auto"><X size={14} /></button></div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', valor: stats.total, color: 'text-blue-600', bg: 'bg-blue-50', icon: MessageSquare },
          { label: 'Pendientes', valor: stats.pendientes, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
          { label: 'En Proceso', valor: stats.enProceso, color: 'text-blue-600', bg: 'bg-blue-50', icon: AlertTriangle },
          { label: 'Resueltos', valor: stats.resueltos, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}><k.icon size={20} /></span>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p>
              <p className="text-xl font-bold text-slate-800">{k.valor}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-2">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="mb-4 font-semibold text-slate-700 flex items-center gap-2"><BarChart3 size={16} className="text-blue-600" /> Por Canal</h3>
          {chartData.length === 0 ? <div className="h-48 flex items-center justify-center text-sm text-slate-400">Sin datos</div> : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="mb-4 font-semibold text-slate-700 flex items-center gap-2"><BarChart3 size={16} className="text-emerald-600" /> Por Estado</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={estadoPieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                  {estadoPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700">Lista de Solicitudes</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <Filter size={14} className="text-slate-400" />
            {['todos', 'pendiente', 'en_proceso', 'resuelto'].map(f => (
              <button key={f} onClick={() => setFiltroEstado(f)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${filtroEstado === f ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {f === 'todos' ? 'Todos' : f === 'en_proceso' ? 'En Proceso' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 font-medium text-slate-500">#</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Comentario</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Canal</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => {
                  const est = estadoConfig[c.estado] || estadoConfig.pendiente;
                  const Icon = est.icon;
                  return (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-800">#{c.id}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{c.clientes?.nombre || 'Sin cliente'}</p>
                        {c.clientes?.empresa && <p className="text-xs text-slate-400">{c.clientes.empresa}</p>}
                      </td>
                      <td className="py-3 px-4 max-w-xs"><p className="text-slate-600 truncate">{c.contenido}</p></td>
                      <td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">{c.canal}</span></td>
                      <td className="py-3 px-4">
                        {canEdit ? (
                          <select value={c.estado} onChange={e => actualizarEstado(c.id, e.target.value)}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                            <option value="pendiente">Pendiente</option>
                            <option value="en_proceso">En Proceso</option>
                            <option value="resuelto">Resuelto</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${est.cls}`}><Icon size={12} />{est.label}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">{new Date(c.fecha).toLocaleDateString('es-ES')}</td>
                      <td className="py-3 px-4 text-right">
                        {canEdit ? (
                          <button onClick={() => eliminar(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Eliminar">
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">{c.categoria || '—'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm">No hay solicitudes</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-700">Nueva Solicitud</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <form onSubmit={crearComentario} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cliente</label>
                <select value={clienteId} onChange={e => setClienteId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">Sin cliente</option>
                  {clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.nombre} — {cl.empresa || 'N/A'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Canal</label>
                <select value={canal} onChange={e => setCanal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 capitalize">
                  {canalOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Comentario *</label>
                <textarea className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                  placeholder="Describe la solicitud del cliente..." rows={4} value={contenido} onChange={e => setContenido(e.target.value)} required />
              </div>
              <button type="submit" disabled={procesando} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition-all">
                {procesando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
                {procesando ? 'Enviando...' : 'Publicar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Comentarios;
