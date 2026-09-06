import { useState, useEffect } from 'react';
import { Inbox, Search, Filter, Loader2, Clock, CheckCircle2, AlertTriangle, MessageSquare } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';

interface SolicitudRow {
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

const estadoConfig: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  en_proceso: { label: 'En Proceso', cls: 'bg-blue-100 text-blue-700', icon: AlertTriangle },
  resuelto: { label: 'Resuelto', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
};

export const Solicitudes = () => {
  const { canEdit } = useAuth();
  const [solicitudes, setSolicitudes] = useState<SolicitudRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('solicitudes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('comentarios')
      .select('*, clientes(nombre, empresa)')
      .order('fecha', { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setSolicitudes((data || []) as unknown as SolicitudRow[]);
    setLoading(false);
  };

  const actualizarEstado = async (id: number, nuevoEstado: string) => {
    const { error: err } = await supabase.from('comentarios').update({ estado: nuevoEstado }).eq('id', id);
    if (!err) setSolicitudes((prev) => prev.map((s) => s.id === id ? { ...s, estado: nuevoEstado } : s));
  };

  const filtrados = solicitudes.filter((s) => {
    const matchBusq = `${s.clientes?.nombre || ''} ${s.contenido} ${s.categoria || ''}`.toLowerCase().includes(busqueda.toLowerCase());
    const matchEst = filtroEstado === 'todos' || s.estado === filtroEstado;
    return matchBusq && matchEst;
  });

  const stats = {
    total: solicitudes.length,
    pendientes: solicitudes.filter((s) => s.estado === 'pendiente').length,
    enProceso: solicitudes.filter((s) => s.estado === 'en_proceso').length,
    resueltas: solicitudes.filter((s) => s.estado === 'resuelto').length,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Solicitudes</h2>
          <p className="text-slate-500 text-sm mt-1">Gestión de solicitudes de atención al cliente</p>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', valor: stats.total, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pendientes', valor: stats.pendientes, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'En Proceso', valor: stats.enProceso, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Resueltas', valor: stats.resueltas, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}><Inbox size={20} /></span>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</p>
              <p className="text-xl font-bold text-slate-800">{k.valor}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Inbox size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700">Lista de Solicitudes</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <div className="flex items-center gap-1">
              <Filter size={14} className="text-slate-400" />
              {['todos', 'pendiente', 'en_proceso', 'resuelto'].map((f) => (
                <button key={f} onClick={() => setFiltroEstado(f)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${filtroEstado === f ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {f === 'todos' ? 'Todos' : f === 'en_proceso' ? 'En Proceso' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 font-medium text-slate-500">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Contenido</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Canal</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Categoría</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((s) => {
                  const est = estadoConfig[s.estado] || estadoConfig.pendiente;
                  const Icon = est.icon;
                  return (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-800">#{s.id}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{s.clientes?.nombre || 'Sin cliente'}</p>
                        {s.clientes?.empresa && <p className="text-xs text-slate-400">{s.clientes.empresa}</p>}
                      </td>
                      <td className="py-3 px-4 max-w-xs"><p className="text-slate-600 truncate">{s.contenido}</p></td>
                      <td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{s.canal}</span></td>
                      <td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{s.categoria || '—'}</span></td>
                      <td className="py-3 px-4"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${est.cls}`}><Icon size={12} />{est.label}</span></td>
                      <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">{new Date(s.fecha).toLocaleDateString('es-ES')}</td>
                      <td className="py-3 px-4 text-right">
                        {canEdit ? (
                          <select value={s.estado} onChange={(e) => actualizarEstado(s.id, e.target.value)} className="px-2 py-1 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                            <option value="pendiente">Pendiente</option>
                            <option value="en_proceso">En Proceso</option>
                            <option value="resuelto">Resuelto</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${est.cls}`}>
                            <Icon size={12} />{est.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">No hay solicitudes</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Solicitudes;
