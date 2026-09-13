import { useState, useEffect } from 'react';
import { History, Filter, Loader2, Search, Download, Trash2 } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface HistorialEntry {
  id: number;
  usuario_id: number | null;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  accion: string;
  fecha: string;
  is_active?: boolean;
}

export const ClientesHistorial = () => {
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [clearing, setClearing] = useState(false);

  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const { data: activeUsers } = await supabase
        .from('usuarios')
        .select('id, nombre, email, telefono, empresa, activo, created_at')
        .in('rol', ['USUARIO', 'usuario']);

      const { data: historyLogs } = await supabase
        .from('historial_clientes')
        .select('*')
        .order('fecha', { ascending: false });

      const activeIds = new Set((activeUsers || []).map(u => u.id));

      const merged: HistorialEntry[] = [];

      for (const u of (activeUsers || [])) {
        merged.push({
          id: u.id,
          usuario_id: u.id,
          nombre: u.nombre,
          email: u.email,
          telefono: u.telefono || '',
          empresa: u.empresa || '',
          accion: u.activo ? 'Activo' : 'Desactivado',
          fecha: u.created_at,
          is_active: true,
        });
      }

      for (const h of (historyLogs || [])) {
        if (h.usuario_id && activeIds.has(h.usuario_id)) continue;
        merged.push({
          ...h,
          is_active: false,
        });
      }

      merged.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setHistorial(merged);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorial();
  }, []);

  const filtrados = historial.filter((c) => {
    const texto = `${c.nombre} ${c.email} ${c.empresa || ''}`.toLowerCase();
    const matchBusqueda = !busqueda || texto.includes(busqueda.toLowerCase());
    if (filtroEstado === 'activo') return (c.accion === 'Activo' || c.accion === 'Reactivado') && matchBusqueda;
    if (filtroEstado === 'inactivo') return (c.accion !== 'Activo') && matchBusqueda;
    return matchBusqueda;
  });

  const exportCSV = () => {
    const headers = ['Nombre', 'Email', 'Telefono', 'Empresa', 'Accion', 'Fecha'];
    const rows = filtrados.map((u) => [
      u.nombre,
      u.email,
      u.telefono || '',
      u.empresa || '',
      u.accion,
      new Date(u.fecha).toLocaleDateString('es-ES'),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_clientes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const vaciarHistorial = async () => {
    if (!confirm('¿VACIAR historial? Esto eliminara los registros antiguos pero mantendra los clientes activos.')) return;
    setClearing(true);
    try {
      const { data: activeUsers } = await supabase
        .from('usuarios')
        .select('id')
        .in('rol', ['USUARIO', 'usuario']);
      const activeIds = (activeUsers || []).map(u => u.id);

      if (activeIds.length > 0) {
        await supabase.from('historial_clientes').delete().not('usuario_id', 'in', `(${activeIds.join(',')})`);
      } else {
        await supabase.from('historial_clientes').delete().neq('id', 0);
      }
      fetchHistorial();
    } catch {
      // silent
    } finally {
      setClearing(false);
    }
  };

  const getAccionBadge = (accion: string) => {
    switch (accion) {
      case 'Activo': return 'bg-emerald-50 text-emerald-700';
      case 'Reactivado': return 'bg-blue-50 text-blue-700';
      case 'Desactivado': return 'bg-amber-50 text-amber-700';
      case 'Eliminado': return 'bg-red-50 text-red-700';
      case 'Creado': return 'bg-indigo-50 text-indigo-700';
      case 'Editado': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Historial de Clientes</h1>
            <p className="mt-1 text-sm text-slate-500">Registro completo de clientes con fecha de alta</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
              <Download size={16} />
              Exportar CSV
            </button>
            <button onClick={vaciarHistorial} disabled={clearing} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-100 disabled:opacity-50">
              {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              VACIAR
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600">
              <History size={16} className="text-slate-400" />
              Historial ({filtrados.length})
            </span>
            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Buscar cliente..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition w-56" />
              </div>
              <Filter size={14} className="text-slate-400" />
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Nombre</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Telefono</th>
                  <th className="px-5 py-3">Empresa</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                      <Loader2 className="mx-auto mb-2 animate-spin" size={24} />
                      Cargando historial...
                    </td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                      No se encontraron registros
                    </td>
                  </tr>
                ) : (
                  filtrados.map((c, idx) => (
                    <tr key={`${c.usuario_id || c.id}-${idx}`} className="border-b border-slate-50 transition hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                            {c.nombre.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                          <span className="font-medium text-slate-900">{c.nombre}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{c.email}</td>
                      <td className="px-5 py-3 text-slate-600">{c.telefono || '—'}</td>
                      <td className="px-5 py-3 text-slate-600">{c.empresa || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${getAccionBadge(c.accion)}`}>
                          {c.accion}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(c.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientesHistorial;
