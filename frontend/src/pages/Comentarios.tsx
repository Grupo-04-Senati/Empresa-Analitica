import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, Search, Filter, Loader2, X, Send, BarChart3, Trash2, ArrowRight } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';

const STOPWORDS = new Set(['de','la','el','en','y','a','los','del','las','un','por','con','una','su','para','es','al','lo','como','mas','o','pero','sus','le','ya','este','ha','si','porque','esta','son','entre','cuando','muy','sin','sobre','tambien','me','hasta','hay','donde','quien','desde','todo','nos','durante','todos','uno','les','ni','contra','otros','ese','eso','ante','ellos','esto','mi','antes','algunos','que','unos','yo','otro','otras','otra','el','tanto','esa','estos','mucho','quienes','nada','muchos','cual','poco','ella','estar','estas','algunas','algo','nosotros','mi','mis','tu','te','ti','tu','tus','ellas','nosotras','vosotros','vosotras','os']);

function analizarAutomatico(texto: string, categorias: { nombre: string; descripcion: string }[]): { categoria: string; confianza: number; palabras: string[] } {
  const limpio = texto.toLowerCase().replace(/[^\w\s]/g, ' ');
  const tokens = limpio.split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const freq: Record<string, number> = {};
  tokens.forEach((t) => { freq[t] = (freq[t] || 0) + 1; });
  const palabras = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([p]) => p);

  const positivas = ['excelente','bueno','buen','genial','increible','perfecto','agradecido','gracias','feliz','satisfecho','recomiendo','rapido','eficiente'];
  const negativas = ['malo','terrible','pesimo','horrible','lento','error','problema','queja','reclamo','insatisfecho','decepcionado','no funciona','no sirve','deficiente'];

  const textoLower = texto.toLowerCase();
  let posCount = 0, negCount = 0;
  positivas.forEach((p) => { if (textoLower.includes(p)) posCount++; });
  negativas.forEach((n) => { if (textoLower.includes(n)) negCount++; });

  let categoria = 'OTROS';
  let mejorScore = 0;
  for (const cat of categorias) {
    const nombreCat = cat.nombre.toLowerCase();
    const descCat = (cat.descripcion || '').toLowerCase();
    const score = (textoLower.includes(nombreCat) ? 10 : 0) + descCat.split(/\s+/).filter(w => w.length > 3 && textoLower.includes(w)).length;
    if (score > mejorScore) { mejorScore = score; categoria = cat.nombre.toUpperCase(); }
  }
  if (mejorScore === 0) {
    if (textoLower.match(/compr|venta|adquir|producto|precio/)) categoria = 'VENTAS';
    else if (textoLower.match(/soporte|ayuda|tecnic|repar|falla/)) categoria = 'SOPORTE';
    else if (textoLower.match(/reclamo|queja|malo|pesimo|defecto/)) categoria = 'RECLAMO';
    else if (textoLower.match(/consulta|pregunt|informacion|duda/)) categoria = 'CONSULTA';
    else if (textoLower.match(/excelente|gracias|buen|feliz|satisfecho/)) categoria = 'FELICITACION';
  }

  const total = posCount + negCount || 1;
  const confianza = Math.min(95, Math.round(50 + (Math.abs(posCount - negCount) / total) * 45));
  return { categoria, confianza, palabras };
}

interface ComentarioDB {
  id: number;
  cliente_id: number | null;
  usuario_id: number | null;
  contenido: string;
  canal: string;
  estado: string;
  categoria: string | null;
  tipo: string;
  fecha: string;
  procesado: boolean;
  clientes?: { nombre: string; empresa: string; usuario_id: number | null } | null;
}

interface AnalisisNLP {
  id: number;
  comentario_id: number;
  categoria_detectada: string | null;
  confianza: number | null;
}

interface ClienteOption { id: number; nombre: string; empresa: string; usuario_id: number | null; }

const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#ec4899'];

const canalOptions = ['web', 'email', 'telefono', 'chat', 'redes'];

export const Comentarios = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [comentarios, setComentarios] = useState<ComentarioDB[]>([]);
  const [analisis, setAnalisis] = useState<AnalisisNLP[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [contenido, setContenido] = useState('');
  const [canal, setCanal] = useState('web');
  const [clienteId, setClienteId] = useState<number | ''>('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [comRes, cliRes, anRes] = await Promise.all([
      supabase.from('comentarios').select('*, clientes(nombre, empresa, usuario_id)').eq('tipo', 'comentario').order('fecha', { ascending: false }),
      supabase.from('clientes').select('id, nombre, empresa, usuario_id').eq('activo', true),
      supabase.from('analisis_nlp').select('id, comentario_id, categoria_detectada, confianza, sentimiento'),
    ]);
    if (comRes.error) { setError(comRes.error.message); setLoading(false); return; }
    setComentarios((comRes.data || []) as unknown as ComentarioDB[]);
    setClientes((cliRes.data || []) as ClienteOption[]);
    setAnalisis((anRes.data || []) as AnalisisNLP[]);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!contenido.trim()) return;
    setSaving(true);
    setError('');
    try {
      const { data: nuevo, error: err } = await supabase.from('comentarios').insert({
        cliente_id: clienteId || null,
        usuario_id: user?.id ? Number(user.id) : null,
        contenido,
        canal,
        tipo: 'comentario',
        estado: 'pendiente',
        procesado: false,
        fecha: new Date().toISOString(),
      }).select('id').single();
      if (err) throw err;

      if (nuevo) {
        const { data: cats } = await supabase.from('categorias').select('nombre, descripcion').eq('activo', true);
        const resultado = analizarAutomatico(contenido, cats || []);
        await supabase.from('analisis_nlp').insert({
          comentario_id: nuevo.id,
          idioma: 'es',
          cantidad_palabras: resultado.palabras.length,
          palabras_limpias: resultado.palabras,
          palabras_frecuentes: resultado.palabras,
          categoria_detectada: resultado.categoria,
          confianza: resultado.confianza / 100,
          fecha_analisis: new Date().toISOString(),
        });
        await supabase.from('comentarios').update({ procesado: true, categoria: resultado.categoria }).eq('id', nuevo.id);
      }

      setShowModal(false);
      setContenido('');
      setClienteId('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear comentario');
    } finally {
      setSaving(false);
    }
  };

  const getAnalisis = (comentarioId: number) => analisis.find((a) => a.comentario_id === comentarioId);

  const eliminarComentario = async (id: number) => {
    if (!confirm('Eliminar este comentario?')) return;
    await supabase.from('analisis_nlp').delete().eq('comentario_id', id);
    const { error } = await supabase.from('comentarios').delete().eq('id', id);
    if (!error) fetchData();
  };

  const filtrados = comentarios.filter((c) => {
    const matchBusq = `${c.clientes?.nombre || ''} ${c.contenido} ${c.categoria || ''}`.toLowerCase().includes(busqueda.toLowerCase());
    const matchEst = filtroEstado === 'todos' || c.estado === filtroEstado;
    const matchUser = isAdmin || c.usuario_id === Number(user?.id) || c.clientes?.usuario_id === Number(user?.id);
    return matchBusq && matchEst && matchUser;
  });

  const stats = {
    total: filtrados.length,
    pendientes: filtrados.filter((c) => c.estado === 'pendiente').length,
    enProceso: filtrados.filter((c) => c.estado === 'en_proceso').length,
    resueltos: filtrados.filter((c) => c.estado === 'resuelto').length,
  };

  const categoriaData = (() => {
    const counts: Record<string, number> = {};
    if (isAdmin) {
      analisis.forEach((a) => {
        if (a.categoria_detectada) counts[a.categoria_detectada] = (counts[a.categoria_detectada] || 0) + 1;
      });
    } else {
      filtrados.forEach((c) => {
        const a = getAnalisis(c.id);
        if (a?.categoria_detectada) counts[a.categoria_detectada] = (counts[a.categoria_detectada] || 0) + 1;
      });
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">Comentarios</h2>
          <p className="text-slate-500 text-sm mt-1">{isAdmin ? 'Comentarios de clientes con analisis NLP' : 'Tus comentarios'}</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Nuevo Comentario
        </button>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 mb-4">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: 'Total', valor: stats.total, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pendientes', valor: stats.pendientes, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'En Proceso', valor: stats.enProceso, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Resueltos', valor: stats.resueltos, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <span className={`flex items-center justify-center w-9 h-9 rounded-lg ${k.bg} ${k.color}`}><MessageSquare size={18} /></span>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{k.label}</p>
              <p className="text-lg font-bold text-slate-800">{k.valor}</p>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && categoriaData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700 text-sm">Distribucion por Categoria (NLP)</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoriaData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                  {categoriaData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700 text-sm">Lista de Comentarios</h3>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full md:w-48 pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              <Filter size={14} className="text-slate-400 shrink-0" />
              {['todos', 'pendiente', 'en_proceso', 'resuelto'].map((f) => (
                <button key={f} onClick={() => setFiltroEstado(f)} className={`px-2.5 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ${filtroEstado === f ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
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
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Comentario</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Canal</th>
                  {isAdmin && <th className="text-left py-3 px-4 font-medium text-slate-500">Categoria NLP</th>}
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha</th>
                  {isAdmin && <th className="text-right py-3 px-4 font-medium text-slate-500">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const a = getAnalisis(c.id);
                  const est = c.estado === 'resuelto' ? { label: 'Resuelto', cls: 'bg-emerald-100 text-emerald-700' } : c.estado === 'en_proceso' ? { label: 'En Proceso', cls: 'bg-blue-100 text-blue-700' } : { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' };
                  return (
                    <tr key={c.id} className={`group border-b border-slate-50 transition-colors ${isAdmin ? 'hover:bg-blue-50/50 cursor-pointer' : 'hover:bg-slate-50'}`} onClick={() => isAdmin && navigate(`/dashboard/analizar-comentario?comentario=${encodeURIComponent(c.contenido)}`)}>
                      <td className="py-3 px-4 font-medium text-slate-800">#{c.id}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{c.clientes?.nombre || 'Sin cliente'}</p>
                        {c.clientes?.empresa && <p className="text-xs text-slate-400">{c.clientes.empresa}</p>}
                      </td>
                      <td className="py-3 px-4 max-w-xs"><p className="text-slate-600 truncate">{c.contenido}</p></td>
                      <td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{c.canal}</span></td>
                      {isAdmin && (
                        <td className="py-3 px-4">
                          {a?.categoria_detectada ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700">{a.categoria_detectada}</span>
                          ) : (
                            <span className="text-xs text-slate-400">Sin analizar</span>
                          )}
                        </td>
                      )}
                      <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${est.cls}`}>{est.label}</span></td>
                      <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">{new Date(c.fecha).toLocaleDateString('es-ES')}</td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              Analizar <ArrowRight size={10} />
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); eliminarComentario(c.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filtrados.length === 0 && <tr><td colSpan={isAdmin ? 8 : 7} className="py-12 text-center text-slate-400 text-sm">No hay comentarios</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">Nuevo Comentario</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-50 transition"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                <select value={clienteId} onChange={(e) => setClienteId(Number(e.target.value) || '')} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} - {c.empresa}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Comentario</label>
                <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" placeholder="Escribe tu comentario..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Canal</label>
                <select value={canal} onChange={(e) => setCanal(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  {canalOptions.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition">Cancelar</button>
              <button onClick={handleSubmit} disabled={saving || !contenido.trim()} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Comentarios;
