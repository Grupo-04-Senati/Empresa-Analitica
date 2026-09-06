import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { MessageSquare, Plus, Send, Trash2, Filter, X, BrainCircuit, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { apiPost } from '@/services/api';
import type { ComentarioDB, ClienteDB } from '@/types';

const canalOptions = ['web', 'email', 'telefono', 'chat', 'redes'];

export const Comentarios = () => {
  const [comentarios, setComentarios] = useState<ComentarioDB[]>([]);
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [contenido, setContenido] = useState('');
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [canal, setCanal] = useState('web');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [procesando, setProcesando] = useState(false);
  const [autoProcesar, setAutoProcesar] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [comRes, cliRes] = await Promise.all([
      supabase.from('comentarios').select('*, clientes(nombre, empresa)').order('fecha', { ascending: false }),
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
    ]);
    if (comRes.data) setComentarios(comRes.data as ComentarioDB[]);
    if (cliRes.data) setClientes(cliRes.data as unknown as ClienteDB[]);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const total = comentarios.length;
    const pendientes = comentarios.filter((c) => c.estado === 'pendiente').length;
    const procesados = comentarios.filter((c) => c.procesado).length;
    const categorias = [...new Set(comentarios.map((c) => c.categoria).filter(Boolean))].length;
    return { total, pendientes, procesados, categorias };
  }, [comentarios]);

  const filtrados = useMemo(() => {
    if (filtroEstado === 'todos') return comentarios;
    return comentarios.filter((c) => c.estado === filtroEstado);
  }, [comentarios, filtroEstado]);

  const crearComentario = async (e: FormEvent) => {
    e.preventDefault();
    if (!contenido.trim()) return;
    setProcesando(true);
    setError('');
    try {
      const { data: newComment, error: err } = await supabase.from('comentarios').insert({
        cliente_id: clienteId || null,
        contenido: contenido.trim(),
        canal,
        estado: 'pendiente',
        procesado: false,
      }).select('id').single();
      if (err) throw err;

      if (autoProcesar && newComment?.id) {
        try {
          await apiPost(`/api/comentarios/${newComment.id}/procesar`);
        } catch (procErr) {
          console.warn('Auto-procesamiento falló:', procErr);
        }
      }

      setContenido('');
      setClienteId('');
      setCanal('web');
      setAutoProcesar(false);
      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear comentario');
    } finally {
      setProcesando(false);
    }
  };

  const eliminar = async (id: number) => {
    if (!confirm('¿Eliminar este comentario?')) return;
    setError('');
    try {
      const { error: err } = await supabase.from('comentarios').delete().eq('id', id);
      if (err) throw err;
      setComentarios((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const kpis = [
    { label: 'Total', valor: stats.total, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pendientes', valor: stats.pendientes, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Procesados', valor: stats.procesados, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Categorías', valor: stats.categorias, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Comentarios</h2>
          <p className="text-slate-500 text-sm mt-1">Gestión de comentarios de clientes</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25">
          <Plus size={16} /> Nuevo Comentario
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}>
              <MessageSquare size={20} />
            </span>
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
            <MessageSquare size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700">Lista de Comentarios</h3>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            {['todos', 'pendiente', 'procesado', 'resuelto'].map((f) => (
              <button key={f} onClick={() => setFiltroEstado(f)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filtroEstado === f ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Contenido</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Canal</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Categoría</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Procesado</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-800">{c.clientes?.nombre || 'Sin cliente'}</p>
                      {c.clientes?.empresa && <p className="text-xs text-slate-400">{c.clientes.empresa}</p>}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-slate-600 truncate">{c.contenido}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{c.canal}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{c.categoria || '—'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' : c.estado === 'resuelto' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {c.estado === 'pendiente' ? 'Pendiente' : c.estado === 'resuelto' ? 'Resuelto' : c.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.procesado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.procesado ? 'Procesado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(c.fecha).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => eliminar(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Eliminar">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">No hay comentarios</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-700">Nuevo Comentario</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <form onSubmit={crearComentario} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cliente</label>
                <select value={clienteId} onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
                  <option value="">Sin cliente</option>
                  {clientes.map((cl) => <option key={cl.id} value={cl.id}>{cl.nombre} — {cl.empresa || 'N/A'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Canal</label>
                <select value={canal} onChange={(e) => setCanal(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
                  {canalOptions.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Comentario</label>
                <textarea className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none" placeholder="Escribe el comentario..." rows={4} value={contenido} onChange={(e) => setContenido(e.target.value)} required />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoProcesar"
                  checked={autoProcesar}
                  onChange={(e) => setAutoProcesar(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="autoProcesar" className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                  <BrainCircuit size={14} className="text-purple-500" />
                  Procesar automáticamente (NLP)
                </label>
              </div>
              <button type="submit" disabled={procesando} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition-all">
                {procesando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={16} />}
                {procesando ? 'Guardando...' : 'Publicar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Comentarios;
