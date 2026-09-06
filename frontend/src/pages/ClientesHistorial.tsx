import { useState, useEffect } from 'react';
import { History, Filter, Loader2, Search } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface ClienteDB {
  id: number;
  nombre: string;
  empresa: string;
  email: string;
  telefono: string;
  activo: boolean;
  created_at: string;
}

export const ClientesHistorial = () => {
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });
      setClientes(data ?? []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const filtrados = clientes.filter((c) => {
    const texto = `${c.nombre} ${c.email} ${c.empresa}`.toLowerCase();
    const matchBusqueda = !busqueda || texto.includes(busqueda.toLowerCase());
    if (filtroEstado === 'activo') return c.activo && matchBusqueda;
    if (filtroEstado === 'inactivo') return !c.activo && matchBusqueda;
    return matchBusqueda;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Historial de Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">Registro completo de clientes con fecha de alta</p>
        </div>

        {/* Table Card */}
        <div className="rounded-xl bg-white shadow-sm">
          {/* Toolbar */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600">
              <History size={16} className="text-slate-400" />
              Historial
            </span>
            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition w-56"
                />
              </div>
              <Filter size={14} className="text-slate-400" />
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Nombre</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Teléfono</th>
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
                            {c.nombre
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <div>
                            <span className="font-medium text-slate-900">{c.nombre}</span>
                            <span className="ml-2 text-xs text-slate-400">{c.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{c.email}</td>
                      <td className="px-5 py-3 text-slate-600">{c.telefono || '—'}</td>
                      <td className="px-5 py-3 text-slate-600">{c.empresa}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            c.activo
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {new Date(c.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
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
