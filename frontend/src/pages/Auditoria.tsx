import { useState, useEffect, useRef } from 'react';
import { Shield, Search, Eye, UserPlus, LogIn, LogOut, Edit3, Trash2, Bell, Scan, AlertTriangle, X, Clock, RotateCcw } from 'lucide-react';

const SB_URL = 'https://poikhicityheikmnfltb.supabase.co';
const SB_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || '';

interface AuditRow {
  id: number;
  created_at: string;
  accion: string;
  tabla: string | null;
  usuario_email: string | null;
  usuario_id: number | null;
  registro_id: number | null;
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  ip: string | null;
  detalles: Record<string, unknown> | string | null;
  modulo: string | null;
}

async function adminDelete(query: string) {
  const res = await fetch(`${SB_URL}/rest/v1/auditoria?${query}`, {
    method: 'DELETE',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  return res.ok;
}

async function adminSelect(): Promise<AuditRow[]> {
  const res = await fetch(`${SB_URL}/rest/v1/auditoria?select=*&order=created_at.desc&limit=200`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) return [];
  return res.json();
}

const ACCIONES: Record<string, { icon: typeof Shield; color: string; bg: string }> = {
  LOGIN: { icon: LogIn, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  LOGOUT: { icon: LogOut, color: 'text-slate-600', bg: 'bg-slate-100' },
  REGISTER: { icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-100' },
  CREATE: { icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-100' },
  UPDATE: { icon: Edit3, color: 'text-amber-600', bg: 'bg-amber-100' },
  DELETE: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-100' },
  VIEW: { icon: Eye, color: 'text-slate-500', bg: 'bg-slate-100' },
  EXPORT: { icon: RotateCcw, color: 'text-purple-600', bg: 'bg-purple-100' },
  NOTIFICATION: { icon: Bell, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  FACE_LOGIN: { icon: Scan, color: 'text-cyan-600', bg: 'bg-cyan-100' },
  FACE_REGISTER: { icon: Scan, color: 'text-cyan-600', bg: 'bg-cyan-100' },
  ROLE_CHANGE: { icon: Shield, color: 'text-pink-600', bg: 'bg-pink-100' },
  ERROR: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
};

const LIMPIEZA_OPCIONES = [
  { value: '', label: 'Sin limite', hours: 0 },
  { value: '1h', label: 'Auto: borrar cada hora', hours: 1 },
  { value: '24h', label: 'Auto: borrar cada 24 horas', hours: 24 },
  { value: '7d', label: 'Auto: borrar cada 7 dias', hours: 168 },
  { value: '30d', label: 'Auto: borrar cada 30 dias', hours: 720 },
];

export const Auditoria = () => {
  const [eventos, setEventos] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');
  const [filtroTabla, setFiltroTabla] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditRow | null>(null);
  const [limpieza, setLimpieza] = useState(() => localStorage.getItem('audit_cleanup') || '');
  const [msg, setMsg] = useState('');
  const [deleting, setDeleting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAuditoria = async () => {
    try {
      const data = await adminSelect();
      if (data.length > 0) setEventos(data);
    } catch {} finally { setLoading(false); }
  };

  const autoCleanup = async () => {
    const saved = localStorage.getItem('audit_cleanup');
    if (!saved) return;
    const opt = LIMPIEZA_OPCIONES.find((o) => o.value === saved);
    if (!opt || !opt.hours) return;
    const fecha = new Date(Date.now() - opt.hours * 3600000).toISOString();
    try {
      await adminDelete(`created_at=lt.${encodeURIComponent(fecha)}`);
      setEventos((prev) => prev.filter((e) => new Date(e.created_at) >= new Date(fecha)));
    } catch {}
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await adminSelect();
        if (active && data.length > 0) setEventos(data);
      } catch {} finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loading) return;
    const interval = setInterval(async () => {
      try {
        const data = await adminSelect();
        setEventos((prev) => {
          if (data.length !== prev.length) return data;
          const changed = data.some((d, i) => !prev[i] || d.id !== prev[i].id);
          return changed ? data : prev;
        });
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    cleanupRef.current = setInterval(autoCleanup, 60000);
    autoCleanup();
    return () => { if (cleanupRef.current) clearInterval(cleanupRef.current); };
  }, []);

  const handleLimpiezaChange = (value: string) => {
    setLimpieza(value);
    if (value) {
      localStorage.setItem('audit_cleanup', value);
    } else {
      localStorage.removeItem('audit_cleanup');
    }
    autoCleanup();
  };

  const handleBorrarAhora = async () => {
    setDeleting(true);
    try {
      const saved = localStorage.getItem('audit_cleanup');
      if (!saved) {
        await adminDelete('id=gt.0');
        setEventos([]);
        setMsg('Todos los eventos eliminados');
      } else {
        const opt = LIMPIEZA_OPCIONES.find((o) => o.value === saved);
        if (opt && opt.hours) {
          const fecha = new Date(Date.now() - opt.hours * 3600000).toISOString();
          await adminDelete(`created_at=lt.${encodeURIComponent(fecha)}`);
          setEventos((prev) => prev.filter((e) => new Date(e.created_at) >= new Date(fecha)));
          setMsg(`Eventos anteriores a ${opt.label} eliminados`);
        }
      }
    } catch { setMsg('Error al borrar'); }
    setTimeout(() => setMsg(''), 3000);
    setDeleting(false);
  };

  const filtrados = eventos.filter((e) => {
    const texto = `${e.usuario_email || ''} ${e.accion} ${e.tabla || ''} ${typeof e.detalles === 'string' ? e.detalles : JSON.stringify(e.detalles || '')} ${e.modulo || ''}`.toLowerCase();
    const matchBusqueda = texto.includes(busqueda.toLowerCase());
    const matchAccion = !filtroAccion || e.accion === filtroAccion;
    const matchTabla = !filtroTabla || e.tabla === filtroTabla;
    return matchBusqueda && matchAccion && matchTabla;
  });

  const tablas = [...new Set(eventos.map((e) => e.tabla).filter(Boolean))];
  const acciones = [...new Set(eventos.map((e) => e.accion))];

  const getAccionInfo = (accion: string) => ACCIONES[accion] || { icon: Shield, color: 'text-slate-500', bg: 'bg-slate-100' };

  const getDiff = (antes: Record<string, unknown> | null, despues: Record<string, unknown> | null) => {
    if (!antes || !despues) return null;
    const changes: { campo: string; old: unknown; new: unknown }[] = [];
    for (const key of Object.keys(despues)) {
      if (JSON.stringify(antes[key]) !== JSON.stringify(despues[key])) {
        changes.push({ campo: key, old: antes[key], new: despues[key] });
      }
    }
    return changes.length > 0 ? changes : null;
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Registro de Auditoria</h2>
            <p className="text-slate-500 text-sm mt-1">Trazabilidad en tiempo real — actualiza cada 3 segundos</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Tiempo real
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase">Total Eventos</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{eventos.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase">Tablas</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{tablas.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase">Acciones</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{acciones.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase">Hoy</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{eventos.filter((e) => new Date(e.created_at).toDateString() === new Date().toDateString()).length}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Buscar por usuario, accion, tabla..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" />
            </div>
            <select value={filtroAccion} onChange={(e) => setFiltroAccion(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
              <option value="">Todas las acciones</option>
              {acciones.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filtroTabla} onChange={(e) => setFiltroTabla(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
              <option value="">Todas las tablas</option>
              {tablas.map((t) => <option key={t || ''} value={t || ''}>{t}</option>)}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3 flex-1">
              <Clock size={16} className="text-slate-500 shrink-0" />
              <span className="text-xs text-slate-600 font-medium shrink-0">Borrado automatico:</span>
              <select value={limpieza} onChange={(e) => handleLimpiezaChange(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                {LIMPIEZA_OPCIONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {limpieza && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-medium shrink-0">Activo</span>}
            </div>
            <button
              onClick={handleBorrarAhora}
              disabled={deleting}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors shrink-0 shadow-sm"
            >
              <Trash2 size={14} />
              {deleting ? 'Borrando...' : 'Borrar ahora'}
            </button>
          </div>
          {msg && <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 text-center font-medium">{msg}</div>}

          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />
            <div className="flex flex-col gap-1">
              {filtrados.length === 0 && <p className="text-sm text-slate-400 text-center py-12">No se encontraron eventos</p>}
              {filtrados.map((e) => {
                const info = getAccionInfo(e.accion);
                const Icon = info.icon;
                const diff = getDiff(e.datos_anteriores, e.datos_nuevos);
                return (
                  <div key={e.id} onClick={() => setSelectedEvent(selectedEvent?.id === e.id ? null : e)} className="relative pl-10 pr-4 py-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className={`absolute left-2.5 top-3.5 w-5 h-5 rounded-full flex items-center justify-center ${info.bg}`}>
                      <Icon size={10} className={info.color} />
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${info.bg} ${info.color}`}>{e.accion}</span>
                          {e.tabla && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{e.tabla}</span>}
                          {e.modulo && <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{e.modulo}</span>}
                        </div>
                        <p className="text-sm text-slate-700 mt-1">
                          <span className="font-medium">{e.usuario_email || 'Sistema'}</span>
                          {e.detalles && <span className="text-slate-500"> — {typeof e.detalles === 'string' ? e.detalles : JSON.stringify(e.detalles)}</span>}
                        </p>
                        {diff && selectedEvent?.id === e.id && (
                          <div className="mt-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Cambios</p>
                            {diff.map((d, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs mb-1">
                                <span className="text-slate-500 font-medium">{d.campo}:</span>
                                <span className="text-red-500 line-through">{String(d.old || '—')}</span>
                                <span className="text-slate-400">→</span>
                                <span className="text-emerald-600">{String(d.new || '—')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(e.created_at).toLocaleString('es-ES')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setSelectedEvent(null)}>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">Detalle del Evento</h3>
                <button onClick={() => setSelectedEvent(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Accion:</span><span className="font-medium text-slate-700">{selectedEvent.accion}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tabla:</span><span className="font-medium text-slate-700">{selectedEvent.tabla || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Usuario:</span><span className="font-medium text-slate-700">{selectedEvent.usuario_email || 'Sistema'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Registro ID:</span><span className="font-medium text-slate-700">{selectedEvent.registro_id || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Fecha:</span><span className="font-medium text-slate-700">{new Date(selectedEvent.created_at).toLocaleString('es-ES')}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">IP:</span><span className="font-medium text-slate-700">{selectedEvent.ip || '—'}</span></div>
                {selectedEvent.detalles && <div><span className="text-slate-500">Detalles:</span><pre className="text-xs bg-slate-50 p-2 rounded-lg mt-1 overflow-x-auto">{typeof selectedEvent.detalles === 'string' ? selectedEvent.detalles : JSON.stringify(selectedEvent.detalles, null, 2)}</pre></div>}
                {selectedEvent.modulo && <div className="flex justify-between"><span className="text-slate-500">Modulo:</span><span className="font-medium text-slate-700">{selectedEvent.modulo}</span></div>}
                {selectedEvent.datos_anteriores && (
                  <div><span className="text-slate-500">Datos anteriores:</span><pre className="text-xs bg-slate-50 p-2 rounded-lg mt-1 overflow-x-auto">{JSON.stringify(selectedEvent.datos_anteriores, null, 2)}</pre></div>
                )}
                {selectedEvent.datos_nuevos && (
                  <div><span className="text-slate-500">Datos nuevos:</span><pre className="text-xs bg-slate-50 p-2 rounded-lg mt-1 overflow-x-auto">{JSON.stringify(selectedEvent.datos_nuevos, null, 2)}</pre></div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auditoria;
