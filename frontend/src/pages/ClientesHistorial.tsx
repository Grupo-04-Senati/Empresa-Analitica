import { useState, useEffect } from 'react';
import { History, Filter, Loader2, Search, Download, Trash2, X } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface UsuarioDB {
  id: number;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  activo: boolean;
  rol: string;
  created_at: string;
}

export const ClientesHistorial = () => {
  const [usuarios, setUsuarios] = useState<UsuarioDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [clearing, setClearing] = useState(false);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('*')
        .in('rol', ['USUARIO', 'usuario'])
        .order('created_at', { ascending: false });
      setUsuarios(data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const filtrados = usuarios.filter((c) => {
    const texto = `${c.nombre} ${c.email} ${c.empresa || ''}`.toLowerCase();
    const matchBusqueda = !busqueda || texto.includes(busqueda.toLowerCase());
    if (filtroEstado === 'activo') return c.activo && matchBusqueda;
    if (filtroEstado === 'inactivo') return !c.activo && matchBusqueda;
    return matchBusqueda;
  });

  const exportCSV = () => {
    const headers = ['Nombre', 'Email', 'Telefono', 'Empresa', 'Estado', 'Fecha Alta'];
    const rows = filtrados.map((u) => [
      u.nombre,
      u.email,
      u.telefono || '',
      u.empresa || '',
      u.activo ? 'Activo' : 'Inactivo',
      new Date(u.created_at).toLocaleDateString('es-ES'),
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

  const clearHistory = async () => {
    if (!confirm('¿Estas seguro de borrar TODO el historial de clientes? Esta accion no se puede deshacer.')) return;
    setClearing(true);
    try {
      for (const u of usuarios) {
        await supabase.from('rostros').delete().eq('usuario_id', u.id);
      }
      await supabase.from('usuarios').delete().in('rol', ['USUARIO', 'usuario']);
      setUsuarios([]);
    } catch {
      // silent
    } finally {
      setClearing(false);
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
            <button onClick={clearHistory} disabled={clearing || usuarios.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-100 disabled:opacity-50">
              {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Borrar Historial
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
                  <th className="px-5 py-3">Fecha Alta</th>
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
                  filtrados.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 transition hover:bg-slate-50">
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
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(c.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })}
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
