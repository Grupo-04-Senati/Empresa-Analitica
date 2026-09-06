import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, MessageSquare, Clock, CheckCircle2, Hash, Tags, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';

interface DashboardStats { totalClientes: number; totalComentarios: number; avgTiempoAtencion: number; porcentajeProcesados: number; totalAnalisis: number; comentariosPendientes: number; }
interface CategoriaDist { nombre: string; total: number; porcentaje: number; }
interface PalabraFreq { palabra: string; frecuencia: number; }
interface TiempoPunto { fecha: string; minutos: number; sla: number; }

export const Dashboard = () => {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({ totalClientes: 0, totalComentarios: 0, avgTiempoAtencion: 0, porcentajeProcesados: 0, totalAnalisis: 0, comentariosPendientes: 0 });
  const [categorias, setCategorias] = useState<CategoriaDist[]>([]);
  const [palabras, setPalabras] = useState<PalabraFreq[]>([]);
  const [tiempos, setTiempos] = useState<TiempoPunto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [clientesRes, comentariosRes, tiemposRes, analisisRes] = await Promise.all([
          supabase.from('clientes').select('id, created_at'),
          supabase.from('comentarios').select('id, procesado, canal, estado, fecha'),
          supabase.from('tiempos_atencion').select('tiempo_minutos, fecha'),
          supabase.from('analisis_nlp').select('categoria_detectada, palabras_frecuentes'),
        ]);

        const allClientes = clientesRes.data || [];
        const allComentarios = comentariosRes.data || [];
        const totalClientes = allClientes.length;
        const totalComentarios = allComentarios.length;
        const procesados = allComentarios.filter((c: any) => c.procesado).length;
        const pendientes = totalComentarios - procesados;
        const porcentajeProcesados = totalComentarios > 0 ? Math.round((procesados / totalComentarios) * 100) : 0;

        const tiemposData = tiemposRes.data || [];
        const avgTiempoAtencion = tiemposData.length > 0 ? Math.round(tiemposData.reduce((s: any, t: any) => s + t.tiempo_minutos, 0) / tiemposData.length) : 0;

        setStats({ totalClientes, totalComentarios, avgTiempoAtencion, porcentajeProcesados, totalAnalisis: analisisRes.data?.length || 0, comentariosPendientes: pendientes });

        const catCount: Record<string, number> = {};
        (analisisRes.data || []).forEach((a: any) => {
          if (a.categoria_detectada) catCount[a.categoria_detectada] = (catCount[a.categoria_detectada] || 0) + 1;
        });
        const totalAnalisis = Object.values(catCount).reduce((s, v) => s + v, 0);
        const catDist = Object.entries(catCount)
          .map(([nombre, total]) => ({ nombre, total, porcentaje: totalAnalisis > 0 ? Math.round((total / totalAnalisis) * 100) : 0 }))
          .sort((a, b) => b.total - a.total);
        setCategorias(catDist);

        const freqMap: Record<string, number> = {};
        (analisisRes.data || []).forEach((a: any) => {
          if (a.palabras_frecuentes && Array.isArray(a.palabras_frecuentes)) {
            a.palabras_frecuentes.forEach((w: any) => {
              const palabra = typeof w === 'string' ? w : w.palabra;
              const count = typeof w === 'object' && w.frecuencia ? w.frecuencia : 1;
              if (palabra) freqMap[palabra] = (freqMap[palabra] || 0) + count;
            });
          }
        });
        const palabrasFreq = Object.entries(freqMap)
          .map(([palabra, frecuencia]) => ({ palabra, frecuencia }))
          .sort((a, b) => b.frecuencia - a.frecuencia)
          .slice(0, 15);
        setPalabras(palabrasFreq);

        const tiemposPorFecha: Record<string, number[]> = {};
        tiemposData.forEach((t: any) => {
          const fecha = t.fecha?.split('T')[0] || 'sin fecha';
          if (!tiemposPorFecha[fecha]) tiemposPorFecha[fecha] = [];
          tiemposPorFecha[fecha].push(t.tiempo_minutos);
        });
        const tiemposChart = Object.entries(tiemposPorFecha)
          .map(([fecha, mins]) => ({ fecha: fecha.slice(5), minutos: Math.round(mins.reduce((s, v) => s + v, 0) / mins.length), sla: 30 }))
          .slice(-14);
        setTiempos(tiemposChart);
      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios' }, () => fetchDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => fetchDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiempos_atencion' }, () => fetchDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'analisis_nlp' }, () => fetchDashboard())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-slate-500 text-sm font-medium">Cargando dashboard...</p>
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

  const catColors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard principal</h1>
          <p className="text-slate-500 text-sm mt-1">El dashboard es la parte mas importante del sistema.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          En vivo
        </div>
      </div>

      {/* Centro Inteligente - KPIs */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3 bg-slate-800">
          <h2 className="text-xs font-bold text-white tracking-widest uppercase">Centro Inteligente</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
          {kpis.map((k) => {
            const Icon = k.icono;
            return (
              <div key={k.label} className="px-5 py-4 flex flex-col items-center justify-center text-center hover:bg-slate-50/50 transition-colors">
                <span className={`flex items-center justify-center w-10 h-10 rounded-xl mb-2 ${k.bg} ${k.color}`}>
                  <Icon size={20} />
                </span>
                <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase mb-0.5">{k.label}</p>
                <p className="text-2xl font-bold text-slate-800">{k.valor}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row: Tiempos + Categorías NLP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tiempos de Atención */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700 text-sm">Tiempos de Atencion</h3>
          </div>
          {tiempos.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
              <div className="text-center">
                <Clock size={32} className="mx-auto mb-2 text-slate-300" />
                <p>Sin datos de tiempos</p>
              </div>
            </div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tiempos}>
                  <defs>
                    <linearGradient id="tiempoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                    labelStyle={{ fontWeight: 600, color: '#475569' }}
                  />
                  <Area type="monotone" dataKey="minutos" name="Minutos" stroke="#2563eb" strokeWidth={2.5} fill="url(#tiempoGrad)" />
                  <Area type="monotone" dataKey="sla" name="SLA" stroke="#d97706" strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Categorías NLP */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Tags size={18} className="text-violet-600" />
            <h3 className="font-semibold text-slate-700 text-sm">Categorias NLP</h3>
          </div>
          {categorias.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
              <div className="text-center">
                <Tags size={32} className="mx-auto mb-2 text-slate-300" />
                <p>Sin categorias disponibles</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 max-h-[220px] overflow-y-auto pr-1">
              {categorias.map((c, i) => (
                <div key={c.nombre}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: catColors[i % catColors.length] }} />
                      <span className="text-sm font-medium text-slate-700">{c.nombre}</span>
                    </div>
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

      {/* Palabras Más Frecuentes */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Hash size={18} className="text-amber-600" />
          <h3 className="font-semibold text-slate-700 text-sm">Palabras Mas Frecuentes</h3>
        </div>
        {palabras.length === 0 ? (
          <div className="h-[60px] flex items-center justify-center text-slate-400 text-sm">
            <div className="text-center">
              <p>Sin palabras frecuentes disponibles</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {palabras.map((w) => (
              <span
                key={w.palabra}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all hover:scale-105"
                style={{
                  fontSize: `${Math.max(12, Math.min(15, 11 + w.frecuencia / 2))}px`,
                  color: '#4f46e5',
                  background: '#eef2ff',
                  borderColor: '#c7d2fe',
                }}
              >
                {w.palabra}
                <span className="text-[10px] text-indigo-400 font-bold">{w.frecuencia}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Alertas pendientes (solo admin) */}
      {isAdmin && stats.comentariosPendientes > 0 && (
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
