import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, MessageSquare, Clock, CheckCircle2, Hash, Tags, Loader2, AlertTriangle, ClipboardList, Send, Plus, ArrowRight } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';

interface DashboardStats {
  totalClientes: number; totalComentarios: number; avgTiempoAtencion: number;
  porcentajeProcesados: number; totalAnalisis: number; comentariosPendientes: number;
  misSolicitudes: number; misPendientes: number; misResueltas: number;
}

interface CategoriaDist { nombre: string; total: number; porcentaje: number; }
interface PalabraFreq { palabra: string; frecuencia: number; }
interface TiempoPunto { fecha: string; minutos: number; sla: number; }
interface ItemReciente { id: number; contenido: string; estado: string; fecha: string; tipo: string; canal: string; categoria: string | null; }

export const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({ totalClientes: 0, totalComentarios: 0, avgTiempoAtencion: 0, porcentajeProcesados: 0, totalAnalisis: 0, comentariosPendientes: 0, misSolicitudes: 0, misPendientes: 0, misResueltas: 0 });
  const [categorias, setCategorias] = useState<CategoriaDist[]>([]);
  const [palabras, setPalabras] = useState<PalabraFreq[]>([]);
  const [tiempos, setTiempos] = useState<TiempoPunto[]>([]);
  const [recentes, setRecentes] = useState<ItemReciente[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [clientesRes, comentariosRes, tiemposRes, analisisRes] = await Promise.all([
          isAdmin ? supabase.from('clientes').select('id, created_at') : Promise.resolve({ data: [] }),
          isAdmin ? supabase.from('comentarios').select('id, procesado, canal, estado, fecha, tipo, usuario_id, clientes(usuario_id)') : supabase.from('comentarios').select('id, procesado, canal, estado, fecha, tipo, usuario_id, clientes(usuario_id)'),
          isAdmin ? supabase.from('tiempos_atencion').select('tiempo_minutos, fecha') : Promise.resolve({ data: [] }),
          isAdmin ? supabase.from('analisis_nlp').select('categoria_detectada, palabras_frecuentes') : Promise.resolve({ data: [] }),
        ]);

        let allComentarios = (comentariosRes.data || []) as any[];
        if (!isAdmin && user?.id) {
          allComentarios = allComentarios.filter((c) => c.usuario_id === Number(user.id) || c.clientes?.usuario_id === Number(user.id));
        }

        const totalClientes = (clientesRes.data || []).length;
        const totalComentarios = allComentarios.length;
        const procesados = allComentarios.filter((c) => c.procesado).length;
        const pendientes = totalComentarios - procesados;

        const tiemposData = (tiemposRes.data || []) as any[];
        const avgTiempoAtencion = tiemposData.length > 0 ? Math.round(tiemposData.reduce((s, t) => s + t.tiempo_minutos, 0) / tiemposData.length) : 0;

        setStats({
          totalClientes, totalComentarios, avgTiempoAtencion,
          porcentajeProcesados: totalComentarios > 0 ? Math.round((procesados / totalComentarios) * 100) : 0,
          totalAnalisis: (analisisRes.data || []).length,
          comentariosPendientes: pendientes,
          misSolicitudes: allComentarios.filter((c) => c.tipo === 'solicitud').length,
          misPendientes: allComentarios.filter((c) => c.tipo === 'solicitud' && c.estado === 'pendiente').length,
          misResueltas: allComentarios.filter((c) => c.tipo === 'solicitud' && c.estado === 'resuelto').length,
        });

        setRecentes(allComentarios.slice(0, 5).map((c) => ({ id: c.id, contenido: c.contenido || '', estado: c.estado || 'pendiente', fecha: c.fecha || '', tipo: c.tipo || 'comentario', canal: c.canal || 'web', categoria: c.categoria || null })));

        if (isAdmin) {
          const catCount: Record<string, number> = {};
          (analisisRes.data || []).forEach((a: any) => { if (a.categoria_detectada) catCount[a.categoria_detectada] = (catCount[a.categoria_detectada] || 0) + 1; });
          const totalAnalisis = Object.values(catCount).reduce((s, v) => s + v, 0);
          setCategorias(Object.entries(catCount).map(([nombre, total]) => ({ nombre, total, porcentaje: totalAnalisis > 0 ? Math.round((total / totalAnalisis) * 100) : 0 })).sort((a, b) => b.total - a.total));

          const freqMap: Record<string, number> = {};
          (analisisRes.data || []).forEach((a: any) => { if (a.palabras_frecuentes && Array.isArray(a.palabras_frecuentes)) a.palabras_frecuentes.forEach((w: any) => { const p = typeof w === 'string' ? w : w.palabra; const c = typeof w === 'object' && w.frecuencia ? w.frecuencia : 1; if (p) freqMap[p] = (freqMap[p] || 0) + c; }); });
          setPalabras(Object.entries(freqMap).map(([palabra, frecuencia]) => ({ palabra, frecuencia })).sort((a, b) => b.frecuencia - a.frecuencia).slice(0, 15));

          const tiemposPorFecha: Record<string, number[]> = {};
          tiemposData.forEach((t: any) => { const f = t.fecha?.split('T')[0] || 'sin fecha'; if (!tiemposPorFecha[f]) tiemposPorFecha[f] = []; tiemposPorFecha[f].push(t.tiempo_minutos); });
          setTiempos(Object.entries(tiemposPorFecha).map(([fecha, mins]) => ({ fecha: fecha.slice(5), minutos: Math.round(mins.reduce((s, v) => s + v, 0) / mins.length), sla: 30 })).slice(-14));
        }
      } catch (err) { console.error('Dashboard error:', err); }
      finally { setLoading(false); }
    };
    fetchDashboard();
    const channel = supabase.channel('dashboard-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios' }, () => fetchDashboard()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, user?.id]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><div className="flex flex-col items-center gap-3"><Loader2 size={32} className="animate-spin text-blue-600" /><p className="text-slate-500 text-sm font-medium">Cargando dashboard...</p></div></div>;

  const catColors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2'];

  const estadoConfig: Record<string, { label: string; cls: string }> = {
    pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
    en_proceso: { label: 'En Proceso', cls: 'bg-blue-100 text-blue-700' },
    resuelto: { label: 'Resuelto', cls: 'bg-emerald-100 text-emerald-700' },
  };

  if (!isAdmin) {
    const kpis = [
      { icono: ClipboardList, label: 'MIS SOLICITUDES', valor: stats.misSolicitudes.toString(), color: 'text-blue-600', bg: 'bg-blue-50' },
      { icono: AlertTriangle, label: 'PENDIENTES', valor: stats.misPendientes.toString(), color: 'text-amber-600', bg: 'bg-amber-50' },
      { icono: CheckCircle2, label: 'RESUELTAS', valor: stats.misResueltas.toString(), color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { icono: MessageSquare, label: 'COMENTARIOS', valor: stats.totalComentarios.toString(), color: 'text-violet-600', bg: 'bg-violet-50' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Mi Panel</h1>
            <p className="text-slate-500 text-sm mt-1">Bienvenido, {user?.nombre || user?.email}. Aqui tienes un resumen de tu actividad.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-3 bg-slate-800">
            <h2 className="text-xs font-bold text-white tracking-widest uppercase">Mis Metricas</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
            {kpis.map((k) => {
              const Icon = k.icono;
              return (
                <div key={k.label} className="px-5 py-4 flex flex-col items-center justify-center text-center hover:bg-slate-50/50:bg-slate-700/30 transition-colors">
                  <span className={`flex items-center justify-center w-10 h-10 rounded-xl mb-2 ${k.bg} ${k.color}`}><Icon size={20} /></span>
                  <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase mb-0.5">{k.label}</p>
                  <p className="text-2xl font-bold text-slate-800">{k.valor}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><ClipboardList size={18} className="text-blue-600" /><h3 className="font-semibold text-slate-700 text-sm">Mis Solicitudes Recientes</h3></div>
              <button onClick={() => navigate('/solicitudes')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">Ver todas <ArrowRight size={12} /></button>
            </div>
            {recentes.filter((r) => r.tipo === 'solicitud').length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No tienes solicitudes aun</p>
                <button onClick={() => navigate('/solicitudes')} className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"><Plus size={12} /> Crear solicitud</button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentes.filter((r) => r.tipo === 'solicitud').slice(0, 4).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{s.contenido}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(s.fecha).toLocaleDateString('es-ES')}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${(estadoConfig[s.estado] || estadoConfig.pendiente).cls}`}>{(estadoConfig[s.estado] || estadoConfig.pendiente).label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><MessageSquare size={18} className="text-violet-600" /><h3 className="font-semibold text-slate-700 text-sm">Mis Comentarios Recientes</h3></div>
              <button onClick={() => navigate('/comentarios')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">Ver todos <ArrowRight size={12} /></button>
            </div>
            {recentes.filter((r) => r.tipo === 'comentario').length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare size={32} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No tienes comentarios aun</p>
                <button onClick={() => navigate('/comentarios')} className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition"><Plus size={12} /> Escribir comentario</button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentes.filter((r) => r.tipo === 'comentario').slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{c.contenido}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.canal} - {new Date(c.fecha).toLocaleDateString('es-ES')}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${(estadoConfig[c.estado] || estadoConfig.pendiente).cls}`}>{(estadoConfig[c.estado] || estadoConfig.pendiente).label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
          <h3 className="font-semibold mb-2">Necesitas ayuda?</h3>
          <p className="text-blue-100 text-sm mb-4">Crea una solicitud de atencion y nuestro equipo te respondera lo antes posible.</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/solicitudes')} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition"><Send size={14} /> Nueva Solicitud</button>
            <button onClick={() => navigate('/comentarios')} className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white text-sm font-medium rounded-lg hover:bg-white/20 transition border border-white/20"><MessageSquare size={14} /> Escribir Comentario</button>
          </div>
        </div>
      </div>
    );
  }

  const kpis = [
    { icono: Users, label: 'CLIENTES', valor: stats.totalClientes.toString(), color: 'text-blue-600', bg: 'bg-blue-50' },
    { icono: MessageSquare, label: 'COMENTARIOS', valor: stats.totalComentarios.toLocaleString('es-ES'), color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icono: Clock, label: 'PROMEDIO', valor: stats.avgTiempoAtencion > 0 ? `${stats.avgTiempoAtencion} min` : '—', color: 'text-amber-600', bg: 'bg-amber-50' },
    { icono: CheckCircle2, label: 'PROCESADOS', valor: `${stats.porcentajeProcesados}%`, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard principal</h1>
          <p className="text-slate-500 text-sm mt-1">Vista general del centro de atencion.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> En vivo
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3 bg-slate-800"><h2 className="text-xs font-bold text-white tracking-widest uppercase">Centro Inteligente</h2></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
          {kpis.map((k) => {
            const Icon = k.icono;
            return (
              <div key={k.label} className="px-5 py-4 flex flex-col items-center justify-center text-center hover:bg-slate-50/50:bg-slate-700/30 transition-colors">
                <span className={`flex items-center justify-center w-10 h-10 rounded-xl mb-2 ${k.bg} ${k.color}`}><Icon size={20} /></span>
                <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase mb-0.5">{k.label}</p>
                <p className="text-2xl font-bold text-slate-800">{k.valor}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4"><Clock size={18} className="text-blue-600" /><h3 className="font-semibold text-slate-700 text-sm">Tiempos de Atencion</h3></div>
          {tiempos.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm"><div className="text-center"><Clock size={32} className="mx-auto mb-2 text-slate-300" /><p>Sin datos de tiempos</p></div></div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tiempos}>
                  <defs><linearGradient id="tiempoGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="minutos" name="Minutos" stroke="#2563eb" strokeWidth={2.5} fill="url(#tiempoGrad)" />
                  <Area type="monotone" dataKey="sla" name="SLA" stroke="#d97706" strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4"><Tags size={18} className="text-violet-600" /><h3 className="font-semibold text-slate-700 text-sm">Categorias NLP</h3></div>
          {categorias.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm"><div className="text-center"><Tags size={32} className="mx-auto mb-2 text-slate-300" /><p>Sin categorias disponibles</p></div></div>
          ) : (
            <div className="flex flex-col gap-3.5 max-h-[220px] overflow-y-auto pr-1">
              {categorias.map((c, i) => (
                <div key={c.nombre}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: catColors[i % catColors.length] }} /><span className="text-sm font-medium text-slate-700">{c.nombre}</span></div>
                    <span className="text-xs font-bold text-slate-500">{c.porcentaje}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.porcentaje}%`, background: catColors[i % catColors.length] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4"><Hash size={18} className="text-amber-600" /><h3 className="font-semibold text-slate-700 text-sm">Palabras Mas Frecuentes</h3></div>
        {palabras.length === 0 ? (
          <div className="h-[60px] flex items-center justify-center text-slate-400 text-sm"><p>Sin palabras frecuentes disponibles</p></div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {palabras.map((w) => (
              <span key={w.palabra} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all hover:scale-105" style={{ fontSize: `${Math.max(12, Math.min(15, 11 + w.frecuencia / 2))}px`, color: '#4f46e5', background: '#eef2ff', borderColor: '#c7d2fe' }}>
                {w.palabra} <span className="text-[10px] text-indigo-400 font-bold">{w.frecuencia}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {stats.comentariosPendientes > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{stats.comentariosPendientes} comentarios pendientes</p>
            <p className="text-xs text-amber-600 mt-0.5">Hay comentarios sin procesar que requieren atencion.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
