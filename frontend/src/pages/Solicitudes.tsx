import { useState, useEffect } from 'react';
import { ClipboardList, Plus, Search, Filter, Loader2, Clock, CheckCircle2, AlertTriangle, X, Send, ChevronDown, ChevronRight, Star, MessageSquare, UserCheck, Eye } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';

interface SolicitudDB {
  id: number;
  cliente_id: number | null;
  usuario_id: number | null;
  contenido: string;
  canal: string;
  estado: string;
  prioridad: string;
  tipo: string;
  fecha: string;
  respuesta: string | null;
  respuesta_admin_id: number | null;
  respuesta_fecha: string | null;
  asignado_a: number | null;
  visto: boolean;
  visto_fecha: string | null;
  categoria: string | null;
  clientes?: { nombre: string; empresa: string; usuario_id: number | null } | null;
}

interface HistorialEstado {
  id: number;
  comentario_id: number;
  estado: string;
  cambiado_por: number | null;
  created_at: string;
  usuarios?: { nombre: string } | null;
}

interface SatisfaccionDB {
  id: number;
  comentario_id: number;
  calificacion: number;
  created_at: string;
}

interface AdminUser { id: number; nombre: string; email: string; }

const estadoConfig: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  en_proceso: { label: 'En Proceso', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: AlertTriangle },
  resuelto: { label: 'Resuelto', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
};

const prioridadConfig: Record<string, { label: string; cls: string }> = {
  baja: { label: 'Baja', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  media: { label: 'Media', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  alta: { label: 'Alta', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  urgente: { label: 'Urgente', cls: 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-bold' },
};

const canalOptions = ['web', 'email', 'telefono', 'chat', 'redes'];

export const Solicitudes = () => {
  const { user, isAdmin } = useAuth();
  const [solicitudes, setSolicitudes] = useState<SolicitudDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<SolicitudDB | null>(null);
  const [showRespuestaModal, setShowRespuestaModal] = useState<SolicitudDB | null>(null);
  const [showSatisfaccionModal, setShowSatisfaccionModal] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [error, setError] = useState('');
  const [contenido, setContenido] = useState('');
  const [canal, setCanal] = useState('web');
  const [prioridad, setPrioridad] = useState('media');
  const [saving, setSaving] = useState(false);
  const [historial, setHistorial] = useState<HistorialEstado[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [respuesta, setRespuesta] = useState('');
  const [asignadoA, setAsignadoA] = useState<number | ''>('');
  const [satisfaccionCal, setSatisfaccionCal] = useState(5);
  const [satisfacciones, setSatisfacciones] = useState<SatisfaccionDB[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const userId = user?.id ? Number(user.id) : null;
    let query = supabase.from('comentarios').select('*, clientes(nombre, empresa, usuario_id)').eq('tipo', 'solicitud').order('fecha', { ascending: false });
    if (!isAdmin && userId) {
      query = query.eq('usuario_id', userId);
    }
    const { data, error: err } = await query;
    if (err) { setError(err.message); }
    setSolicitudes((data || []) as unknown as SolicitudDB[]);

    if (isAdmin) {
      const { data: adminsData } = await supabase.from('usuarios').select('id, nombre, email').eq('rol', 'admin').eq('activo', true);
      setAdmins((adminsData || []) as AdminUser[]);
    }

    const { data: satData } = await supabase.from('satisfaccion').select('id, comentario_id, calificacion, created_at');
    setSatisfacciones((satData || []) as SatisfaccionDB[]);

    setLoading(false);
  };

  const fetchHistorial = async (comentarioId: number) => {
    const { data } = await supabase.from('historial_estados').select('*, usuarios(nombre)').eq('comentario_id', comentarioId).order('created_at', { ascending: true });
    setHistorial((data || []) as unknown as HistorialEstado[]);
  };

  const handleSubmit = async () => {
    if (!contenido.trim()) return;
    setSaving(true);
    setError('');
    try {
      const userId = user?.id ? Number(user.id) : null;
      let clienteIdVal: number | null = null;
      if (userId) {
        const { data: cli } = await supabase.from('clientes').select('id').eq('usuario_id', userId).single();
        clienteIdVal = cli?.id || null;
      }
      const { data: nuevo, error: err } = await supabase.from('comentarios').insert({
        cliente_id: clienteIdVal,
        usuario_id: userId,
        contenido,
        canal,
        prioridad,
        tipo: 'solicitud',
        estado: 'pendiente',
        procesado: false,
        fecha: new Date().toISOString(),
      }).select('id').single();
      if (err) throw err;

      if (nuevo) {
        await supabase.from('historial_estados').insert({
          comentario_id: nuevo.id,
          estado: 'pendiente',
          cambiado_por: userId,
        });
      }

      setShowModal(false);
      setContenido('');
      setPrioridad('media');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const actualizarEstado = async (id: number, nuevoEstado: string) => {
    const userId = user?.id ? Number(user.id) : null;
    const updates: Record<string, unknown> = { estado: nuevoEstado };
    if (nuevoEstado === 'en_proceso') {
      updates.visto = true;
      updates.visto_fecha = new Date().toISOString();
    }
    if (nuevoEstado === 'resuelto') {
      updates.respuesta_fecha = updates.respuesta_fecha || new Date().toISOString();
    }
    const { error: err } = await supabase.from('comentarios').update(updates).eq('id', id);
    if (!err) {
      await supabase.from('historial_estados').insert({
        comentario_id: id,
        estado: nuevoEstado,
        cambiado_por: userId,
      });
      setSolicitudes((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));
    }
  };

  const handleAsignar = async (id: number, adminId: number | '') => {
    const { error: err } = await supabase.from('comentarios').update({ asignado_a: adminId || null }).eq('id', id);
    if (!err) {
      setSolicitudes((prev) => prev.map((s) => s.id === id ? { ...s, asignado_a: adminId || null } : s));
      if (adminId && showRespuestaModal?.id === id) {
        setShowRespuestaModal({ ...showRespuestaModal, asignado_a: adminId || null });
      }
    }
  };

  const handleRespuesta = async () => {
    if (!showRespuestaModal || !respuesta.trim()) return;
    const userId = user?.id ? Number(user.id) : null;
    const { error: err } = await supabase.from('comentarios').update({
      respuesta: respuesta.trim(),
      respuesta_admin_id: userId,
      respuesta_fecha: new Date().toISOString(),
    }).eq('id', showRespuestaModal.id);
    if (!err) {
      setSolicitudes((prev) => prev.map((s) => s.id === showRespuestaModal.id ? {
        ...s,
        respuesta: respuesta.trim(),
        respuesta_admin_id: userId,
        respuesta_fecha: new Date().toISOString(),
      } : s));
      setShowRespuestaModal(null);
      setRespuesta('');
      fetchData();
    }
  };

  const handleSatisfaccion = async () => {
    if (!showSatisfaccionModal) return;
    const userId = user?.id ? Number(user.id) : null;
    const existing = satisfacciones.find((s) => s.comentario_id === showSatisfaccionModal);
    if (existing) {
      await supabase.from('satisfaccion').update({ calificacion: satisfaccionCal }).eq('id', existing.id);
    } else {
      await supabase.from('satisfaccion').insert({
        comentario_id: showSatisfaccionModal,
        usuario_id: userId,
        calificacion: satisfaccionCal,
      });
    }
    setShowSatisfaccionModal(null);
    fetchData();
  };

  const getSatisfaccion = (comentarioId: number) => satisfacciones.find((s) => s.comentario_id === comentarioId);

  const filtrados = solicitudes.filter((s) => {
    const matchBusq = `${s.clientes?.nombre || ''} ${s.contenido} ${s.categoria || ''}`.toLowerCase().includes(busqueda.toLowerCase());
    const matchEst = filtroEstado === 'todos' || s.estado === filtroEstado;
    return matchBusq && matchEst;
  });

  const stats = {
    total: filtrados.length,
    pendientes: filtrados.filter((s) => s.estado === 'pendiente').length,
    enProceso: filtrados.filter((s) => s.estado === 'en_proceso').length,
    resueltas: filtrados.filter((s) => s.estado === 'resuelto').length,
  };

  const openDetail = async (s: SolicitudDB) => {
    setShowDetailModal(s);
    await fetchHistorial(s.id);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white">Solicitudes</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{isAdmin ? 'Tickets formales de atencion' : 'Tus solicitudes de atencion'}</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Nueva Solicitud
        </button>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 dark:text-red-300 text-sm p-3 mb-4">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: 'Total', valor: stats.total, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Pendientes', valor: stats.pendientes, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'En Proceso', valor: stats.enProceso, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Resueltas', valor: stats.resueltas, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        ].map((k) => (
          <div key={k.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
            <span className={`flex items-center justify-center w-9 h-9 rounded-lg ${k.bg} ${k.color}`}><ClipboardList size={18} /></span>
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">{k.label}</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white">{k.valor}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700 dark:text-white text-sm">Lista de Solicitudes</h3>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full md:w-48 pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              <Filter size={14} className="text-slate-400 shrink-0" />
              {['todos', 'pendiente', 'en_proceso', 'resuelto'].map((f) => (
                <button key={f} onClick={() => setFiltroEstado(f)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ${filtroEstado === f ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200'}`}>
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
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">ID</th>
                  {isAdmin && <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Cliente</th>}
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Solicitud</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Canal</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Prioridad</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Fecha</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((s) => {
                  const est = estadoConfig[s.estado] || estadoConfig.pendiente;
                  const pri = prioridadConfig[s.prioridad || 'media'] || prioridadConfig.media;
                  const Icon = est.icon;
                  return (
                    <tr key={s.id} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-white">#{s.id}</td>
                      {isAdmin && (
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-800 dark:text-white">{s.clientes?.nombre || 'Sin cliente'}</p>
                          {s.clientes?.empresa && <p className="text-xs text-slate-400">{s.clientes.empresa}</p>}
                        </td>
                      )}
                      <td className="py-3 px-4 max-w-xs"><p className="text-slate-600 dark:text-slate-300 truncate">{s.contenido}</p></td>
                      <td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{s.canal}</span></td>
                      <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${pri.cls}`}>{pri.label}</span></td>
                      <td className="py-3 px-4"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${est.cls}`}><Icon size={12} />{est.label}</span></td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">{new Date(s.fecha).toLocaleDateString('es-ES')}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openDetail(s)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 transition" title="Ver detalle">
                            <Eye size={14} />
                          </button>
                          {isAdmin && (
                            <>
                              <select value={s.estado} onChange={(e) => actualizarEstado(s.id, e.target.value)} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                                <option value="pendiente">Pendiente</option>
                                <option value="en_proceso">En Proceso</option>
                                <option value="resuelto">Resuelto</option>
                              </select>
                              <button onClick={() => { setShowRespuestaModal(s); setRespuesta(s.respuesta || ''); setAsignadoA(s.asignado_a || ''); }} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-400 hover:text-blue-600 transition" title="Responder">
                                <MessageSquare size={14} />
                              </button>
                            </>
                          )}
                          {!isAdmin && s.respuesta && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Respondido</span>
                          )}
                          {!isAdmin && s.estado === 'resuelto' && (
                            <button onClick={() => setShowSatisfaccionModal(s.id)} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-400 hover:text-amber-600 transition" title="Calificar">
                              <Star size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && <tr><td colSpan={isAdmin ? 8 : 7} className="py-12 text-center text-slate-400 text-sm">No hay solicitudes</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nueva solicitud */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Nueva Solicitud</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Describe tu solicitud</label>
                <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" placeholder="Escribe aqui tu solicitud..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Canal</label>
                  <select value={canal} onChange={(e) => setCanal(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    {canalOptions.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prioridad</label>
                  <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving || !contenido.trim()} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Solicitud #{showDetailModal.id}</h3>
              <button onClick={() => setShowDetailModal(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Estado</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mt-1 ${(estadoConfig[showDetailModal.estado] || estadoConfig.pendiente).cls}`}>
                    {(() => { const I = (estadoConfig[showDetailModal.estado] || estadoConfig.pendiente).icon; return <I size={12} />; })()}
                    {(estadoConfig[showDetailModal.estado] || estadoConfig.pendiente).label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Prioridad</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${(prioridadConfig[showDetailModal.prioridad || 'media'] || prioridadConfig.media).cls}`}>
                    {(prioridadConfig[showDetailModal.prioridad || 'media'] || prioridadConfig.media).label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Canal</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{showDetailModal.canal}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Fecha</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{new Date(showDetailModal.fecha).toLocaleString('es-ES')}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">Contenido</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">{showDetailModal.contenido}</p>
              </div>
              {showDetailModal.respuesta && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-semibold mb-1">Respuesta del administrador</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{showDetailModal.respuesta}</p>
                  {showDetailModal.respuesta_fecha && (
                    <p className="text-xs text-slate-400 mt-2">{new Date(showDetailModal.respuesta_fecha).toLocaleString('es-ES')}</p>
                  )}
                </div>
              )}
              {!showDetailModal.respuesta && isAdmin && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-xs text-amber-600 dark:text-amber-400 uppercase font-semibold mb-1">Sin respuesta</p>
                  <p className="text-xs text-slate-500">Esta solicitud aun no tiene respuesta del administrador.</p>
                </div>
              )}

              {/* Timeline */}
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-3">Historial de estados</p>
                <div className="space-y-0">
                  {historial.map((h, i) => (
                    <div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${i === historial.length - 1 ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        {i < historial.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{(estadoConfig[h.estado] || estadoConfig.pendiente).label}</p>
                        <p className="text-[10px] text-slate-400">{new Date(h.created_at).toLocaleString('es-ES')}</p>
                        {h.usuarios?.nombre && <p className="text-[10px] text-slate-400">por {h.usuarios.nombre}</p>}
                      </div>
                    </div>
                  ))}
                  {historial.length === 0 && <p className="text-xs text-slate-400">Sin historial</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal responder (admin) */}
      {showRespuestaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Responder Solicitud #{showRespuestaModal.id}</h3>
              <button onClick={() => setShowRespuestaModal(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">Mensaje del cliente</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">{showRespuestaModal.contenido}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Asignar responsable</label>
                <select value={asignadoA} onChange={(e) => { const val = Number(e.target.value) || ''; setAsignadoA(val); handleAsignar(showRespuestaModal.id, val); }} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">Sin asignar</option>
                  {admins.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Respuesta</label>
                <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" placeholder="Escribe tu respuesta..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => setShowRespuestaModal(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">Cancelar</button>
              <button onClick={handleRespuesta} disabled={!respuesta.trim()} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                <Send size={16} /> Enviar Respuesta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal satisfaccion */}
      {showSatisfaccionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Califica tu experiencia</h3>
              <button onClick={() => setShowSatisfaccionModal(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"><X size={18} /></button>
            </div>
            <div className="p-5 text-center">
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setSatisfaccionCal(star)} className="transition-transform hover:scale-110">
                    <Star size={32} className={star <= satisfaccionCal ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'} />
                  </button>
                ))}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{satisfaccionCal}/5 - {satisfaccionCal >= 4 ? 'Excelente' : satisfaccionCal >= 3 ? 'Bueno' : satisfaccionCal >= 2 ? 'Regular' : 'Malo'}</p>
              <button onClick={handleSatisfaccion} className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">Enviar Calificacion</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Solicitudes;
