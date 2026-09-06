import { useState, useEffect } from 'react';
import { Shield, Search, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface AuditRow {
  id: number;
  created_at: string;
  accion: string;
  tabla: string | null;
  ip: string | null;
  detalles: unknown;
  usuarios?: { nombre: string; email: string } | null;
}

export const Auditoria = () => {
  const [eventos, setEventos] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const fetchAuditoria = async () => {
      try {
        const { data, error: err } = await supabase
          .from('auditoria')
          .select('*, usuarios(nombre, email)')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!err && data && data.length > 0) {
          setEventos(data as AuditRow[]);
        }
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    };
    fetchAuditoria();
  }, []);

  const filtrados = eventos.filter((e) => {
    const nombre = e.usuarios?.nombre || '';
    const texto = `${nombre} ${e.accion} ${e.tabla || ''}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Registro de Auditoría</h2>
          <p className="text-slate-500 text-sm mt-1">Trazabilidad de acciones y accesos en la plataforma</p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          Registro continuo
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Eventos registrados</span>
            <Shield size={18} className="text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{eventos.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Tablas afectadas</span>
            <Shield size={18} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{[...new Set(eventos.map((e) => e.tabla).filter(Boolean))].length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" placeholder="Buscar por usuario, acción o tabla..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <Shield size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Tabla de auditoría no disponible</p>
          </div>
        ) : eventos.length === 0 ? (
          <div className="py-16 text-center">
            <Shield size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Sin eventos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase"><span className="flex items-center gap-1.5"><Calendar size={12} /> Fecha</span></th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Usuario</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Acción</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Tabla</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">IP</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{e.usuarios?.nombre || 'Sistema'}</td>
                    <td className="py-3 px-4 text-slate-600">{e.accion}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">{e.tabla || '—'}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{e.ip || '—'}</td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-sm text-slate-400">No se encontraron eventos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auditoria;
