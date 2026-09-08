import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, Clock, Filter, Loader2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificacionesService, Notificacion } from '../services/notificaciones';

const tipoConfig: Record<string, { label: string; cls: string; icon: typeof Bell }> = {
  info: { label: 'Info', cls: 'bg-blue-100 text-blue-700', icon: Info },
  success: { label: 'Éxito', cls: 'bg-emerald-100 text-emerald-700', icon: Check },
  warning: { label: 'Advertencia', cls: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  error: { label: 'Error', cls: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export const Notificaciones = () => {
  const { user } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todas' | 'no_leidas' | 'leidas'>('todas');
  const [filtroTiempo, setFiltroTiempo] = useState<'todos' | 'mes' | 'trimestre' | 'anio'>('todos');

  useEffect(() => { fetchNotificaciones(); }, []);

  const fetchNotificaciones = async () => {
    setLoading(true);
    try {
      const res = await notificacionesService.getNotificaciones();
      setNotificaciones(res.notificaciones);
      setTotalNoLeidas(res.total_no_leidas);
    } catch (err) {
      console.error('Error fetching notificaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const marcarLeida = async (id: number) => {
    await notificacionesService.marcarLeida(id);
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    setTotalNoLeidas(prev => Math.max(0, prev - 1));
  };

  const marcarTodasLeidas = async () => {
    await notificacionesService.marcarTodasLeidas();
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    setTotalNoLeidas(0);
  };

  const eliminar = async (id: number) => {
    await notificacionesService.eliminar(id);
    const notif = notificaciones.find(n => n.id === id);
    setNotificaciones(prev => prev.filter(n => n.id !== id));
    if (notif && !notif.leida) setTotalNoLeidas(prev => Math.max(0, prev - 1));
  };

  const eliminarTodas = async () => {
    if (!confirm('¿Eliminar todas las notificaciones?')) return;
    await notificacionesService.eliminarTodas();
    setNotificaciones([]);
    setTotalNoLeidas(0);
  };

  const eliminarAntiguas = async (meses: number) => {
    const label = meses === 1 ? '1 mes' : meses === 3 ? '3 meses' : '1 año';
    if (!confirm(`¿Eliminar notificaciones de más de ${label}?`)) return;
    await notificacionesService.eliminarAntiguas(meses);
    fetchNotificaciones();
  };

  const filtradas = notificaciones.filter(n => {
    if (filtro === 'no_leidas') return !n.leida;
    if (filtro === 'leidas') return n.leida;
    return true;
  }).filter(n => {
    if (filtroTiempo === 'todos') return true;
    const fecha = new Date(n.created_at);
    const ahora = new Date();
    const diff = ahora.getTime() - fecha.getTime();
    const dias = diff / (1000 * 60 * 60 * 24);
    if (filtroTiempo === 'mes') return dias <= 30;
    if (filtroTiempo === 'trimestre') return dias <= 90;
    if (filtroTiempo === 'anio') return dias <= 365;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Notificaciones</h2>
          <p className="text-slate-500 text-sm mt-1">Gestiona tus notificaciones del sistema</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {totalNoLeidas > 0 && (
            <button onClick={marcarTodasLeidas} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition">
              <CheckCheck size={14} /> Marcar todas leídas
            </button>
          )}
          <button onClick={eliminarTodas} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition">
            <Trash2 size={14} /> Eliminar todas
          </button>
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition">
              <Clock size={14} /> Antiguas
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-10 hidden group-hover:block min-w-[160px]">
              <button onClick={() => eliminarAntiguas(1)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50">Más de 1 mes</button>
              <button onClick={() => eliminarAntiguas(3)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50">Más de 3 meses</button>
              <button onClick={() => eliminarAntiguas(12)} className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50">Más de 1 año</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1">
          {(['todas', 'no_leidas', 'leidas'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filtro === f ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {f === 'todas' ? 'Todas' : f === 'no_leidas' ? `No leídas (${totalNoLeidas})` : 'Leídas'}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-slate-400" />
          {(['todos', 'mes', 'trimestre', 'anio'] as const).map(f => (
            <button key={f} onClick={() => setFiltroTiempo(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filtroTiempo === f ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {f === 'todos' ? 'Todo' : f === 'mes' ? 'Mes' : f === 'trimestre' ? 'Trimestre' : 'Año'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Bell size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-medium">Sin notificaciones</p>
          <p className="text-slate-400 text-sm mt-1">No hay notificaciones {filtro === 'no_leidas' ? 'sin leer' : ''} para mostrar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(n => {
            const config = tipoConfig[n.tipo] || tipoConfig.info;
            const Icon = config.icon;
            return (
              <div key={n.id}
                className={`bg-white rounded-xl border p-4 flex items-start gap-3 transition-all hover:shadow-sm ${
                  n.leida ? 'border-slate-100 opacity-70' : 'border-slate-200 shadow-sm'
                }`}>
                <span className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${config.cls}`}>
                  <Icon size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`font-semibold text-sm ${n.leida ? 'text-slate-500' : 'text-slate-800'}`}>{n.titulo}</p>
                    {!n.leida && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{n.mensaje}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {new Date(n.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!n.leida && (
                    <button onClick={() => marcarLeida(n.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition" title="Marcar como leída">
                      <Check size={14} />
                    </button>
                  )}
                  <button onClick={() => eliminar(n.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition" title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notificaciones;
