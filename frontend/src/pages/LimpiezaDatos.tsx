import { useState, useEffect } from 'react';
import { Trash2, Search, AlertTriangle, CheckCircle2, Loader2, Database, Users, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface Cliente {
  id: number;
  nombre: string;
  email: string;
  empresa: string;
  telefono: string;
  activo: boolean;
  created_at: string;
}

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  created_at: string;
}

export const LimpiezaDatos = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionadosClientes, setSeleccionadosClientes] = useState<number[]>([]);
  const [seleccionadosUsuarios, setSeleccionadosUsuarios] = useState<number[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const [resultado, setResultado] = useState<{ exitosos: number; fallidos: number; mensajes: string[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'clientes' | 'usuarios'>('clientes');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch clientes
    const { data: clientesData } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch usuarios
    const { data: usuariosData } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, activo, created_at')
      .order('created_at', { ascending: false });

    if (clientesData) setClientes(clientesData as Cliente[]);
    if (usuariosData) setUsuarios(usuariosData as Usuario[]);
    
    setLoading(false);
  };

  const esFalso = (nombre: string, email: string, empresa?: string): boolean => {
    const nombreLower = nombre.toLowerCase();
    const emailLower = email.toLowerCase();
    const empresaLower = empresa?.toLowerCase() || '';
    
    const patrones = [
      'test', 'ejemplo', 'demo', 'fake', 'prueba', 'sample', 'dummy',
      'foo', 'bar', 'baz', 'test1', 'test2', 'test3',
      'ejemplo1', 'ejemplo2', 'ejemplo3',
      'cliente1', 'cliente2', 'cliente3',
      'user1', 'user2', 'user3',
      'usuario1', 'usuario2', 'usuario3',
      'admin1', 'admin2', 'admin3'
    ];
    
    return patrones.some(patron => 
      nombreLower.includes(patron) || 
      emailLower.includes(patron) || 
      empresaLower.includes(patron)
    );
  };

  const clientesFalsos = clientes.filter(c => esFalso(c.nombre, c.email, c.empresa));
  const clientesReales = clientes.filter(c => !esFalso(c.nombre, c.email, c.empresa));
  const usuariosFalsos = usuarios.filter(u => esFalso(u.nombre, u.email));
  const usuariosReales = usuarios.filter(u => !esFalso(u.nombre, u.email));

  const clientesFiltrados = clientes.filter(c => {
    const texto = `${c.nombre} ${c.email} ${c.empresa}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  const usuariosFiltrados = usuarios.filter(u => {
    const texto = `${u.nombre} ${u.email}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  const toggleSeleccionCliente = (id: number) => {
    setSeleccionadosClientes(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSeleccionUsuario = (id: number) => {
    setSeleccionadosUsuarios(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const seleccionarTodosLosFalsos = () => {
    if (activeTab === 'clientes') {
      setSeleccionadosClientes(clientesFalsos.map(c => c.id));
    } else {
      setSeleccionadosUsuarios(usuariosFalsos.map(u => u.id));
    }
  };

  const limpiarSeleccion = () => {
    setSeleccionadosClientes([]);
    setSeleccionadosUsuarios([]);
  };

  const eliminarSeleccionados = async () => {
    const seleccionados = activeTab === 'clientes' ? seleccionadosClientes : seleccionadosUsuarios;
    if (seleccionados.length === 0) return;
    
    setEliminando(true);
    setResultado(null);
    
    let exitosos = 0;
    let fallidos = 0;
    const mensajes: string[] = [];
    
    for (const id of seleccionados) {
      try {
        if (activeTab === 'clientes') {
          // Eliminar análisis NLP de comentarios del cliente
          const { data: comentarios } = await supabase
            .from('comentarios')
            .select('id')
            .eq('cliente_id', id);
          
          if (comentarios && comentarios.length > 0) {
            const comentarioIds = comentarios.map(c => c.id);
            
            await supabase
              .from('analisis_nlp')
              .delete()
              .in('comentario_id', comentarioIds);
            
            await supabase
              .from('comentarios')
              .delete()
              .eq('cliente_id', id);
          }
          
          // Eliminar tiempos de atención
          await supabase
            .from('tiempos_atencion')
            .delete()
            .eq('cliente_id', id);
          
          // Eliminar el cliente
          const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', id);
          
          if (error) throw error;
          exitosos++;
          mensajes.push(`✅ Cliente ${id} eliminado correctamente`);
        } else {
          // Eliminar auditoría del usuario
          await supabase
            .from('auditoria')
            .delete()
            .eq('usuario_id', id);
          
          // Eliminar el usuario
          const { error } = await supabase
            .from('usuarios')
            .delete()
            .eq('id', id);
          
          if (error) throw error;
          exitosos++;
          mensajes.push(`✅ Usuario ${id} eliminado correctamente`);
        }
      } catch (error) {
        fallidos++;
        mensajes.push(`❌ Error eliminando ${activeTab === 'clientes' ? 'cliente' : 'usuario'} ${id}: ${error}`);
      }
    }
    
    setResultado({ exitosos, fallidos, mensajes });
    setSeleccionadosClientes([]);
    setSeleccionadosUsuarios([]);
    fetchData();
    setEliminando(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-slate-500 text-sm">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database size={24} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Limpieza de Datos</h1>
          </div>
          <p className="text-slate-500">
            Elimina clientes y usuarios de prueba o datos falsos que fueron creados durante el desarrollo.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('clientes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              activeTab === 'clientes'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Users size={16} />
            Clientes ({clientes.length})
          </button>
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              activeTab === 'usuarios'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <UserCheck size={16} />
            Usuarios ({usuarios.length})
          </button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600">
                <Database size={20} />
              </span>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total {activeTab === 'clientes' ? 'Clientes' : 'Usuarios'}</p>
                <p className="text-xl font-bold text-slate-800">
                  {activeTab === 'clientes' ? clientes.length : usuarios.length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 text-amber-600">
                <AlertTriangle size={20} />
              </span>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Posibles Falsos</p>
                <p className="text-xl font-bold text-slate-800">
                  {activeTab === 'clientes' ? clientesFalsos.length : usuariosFalsos.length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Datos Reales</p>
                <p className="text-xl font-bold text-slate-800">
                  {activeTab === 'clientes' ? clientesReales.length : usuariosReales.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={seleccionarTodosLosFalsos}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-700 font-medium text-sm hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle size={16} />
              Seleccionar Todos los Falsos ({activeTab === 'clientes' ? clientesFalsos.length : usuariosFalsos.length})
            </button>
            
            <button
              onClick={limpiarSeleccion}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              Limpiar Selección
            </button>
            
            {(activeTab === 'clientes' ? seleccionadosClientes.length : seleccionadosUsuarios.length) > 0 && (
              <button
                onClick={eliminarSeleccionados}
                disabled={eliminando}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {eliminando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                {eliminando ? 'Eliminando...' : `Eliminar Seleccionados (${activeTab === 'clientes' ? seleccionadosClientes.length : seleccionadosUsuarios.length})`}
              </button>
            )}
          </div>
          
          {(activeTab === 'clientes' ? seleccionadosClientes.length : seleccionadosUsuarios.length) > 0 && (
            <p className="mt-3 text-sm text-slate-500">
              {activeTab === 'clientes' ? seleccionadosClientes.length : seleccionadosUsuarios.length} {activeTab === 'clientes' ? 'cliente(s)' : 'usuario(s)'} seleccionado(s) para eliminación
            </p>
          )}
        </div>

        {/* Resultado */}
        {resultado && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <h3 className="font-semibold text-slate-700 mb-3">Resultado de la Limpieza</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-sm text-slate-600">
                  <strong>{resultado.exitosos}</strong> eliminados exitosamente
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-sm text-slate-600">
                  <strong>{resultado.fallidos}</strong> errores
                </span>
              </div>
            </div>
            
            {resultado.mensajes.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                {resultado.mensajes.map((msg, i) => (
                  <p key={i} className="text-xs text-slate-600 mb-1">{msg}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Búsqueda */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`Buscar por nombre o email...`}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
            <span className="text-sm text-slate-500">
              {activeTab === 'clientes' ? clientesFiltrados.length : usuariosFiltrados.length} registros
            </span>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700">
              {activeTab === 'clientes' ? 'Todos los Clientes' : 'Todos los Usuarios'}
            </h3>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
              {activeTab === 'clientes' ? clientesFiltrados.length : usuariosFiltrados.length} registros
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-500 w-10">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (activeTab === 'clientes') {
                          if (e.target.checked) {
                            setSeleccionadosClientes(clientesFiltrados.map(c => c.id));
                          } else {
                            setSeleccionadosClientes([]);
                          }
                        } else {
                          if (e.target.checked) {
                            setSeleccionadosUsuarios(usuariosFiltrados.map(u => u.id));
                          } else {
                            setSeleccionadosUsuarios([]);
                          }
                        }
                      }}
                      checked={
                        activeTab === 'clientes' 
                          ? seleccionadosClientes.length === clientesFiltrados.length && clientesFiltrados.length > 0
                          : seleccionadosUsuarios.length === usuariosFiltrados.length && usuariosFiltrados.length > 0
                      }
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">
                    {activeTab === 'clientes' ? 'Cliente' : 'Usuario'}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Email</th>
                  {activeTab === 'clientes' ? (
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Empresa</th>
                  ) : (
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Rol</th>
                  )}
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha Creación</th>
                </tr>
              </thead>
              <tbody>
                {activeTab === 'clientes' ? (
                  clientesFiltrados.map((c) => {
                    const esFalsoDetectado = esFalso(c.nombre, c.email, c.empresa);
                    const isSelected = seleccionadosClientes.includes(c.id);
                    
                    return (
                      <tr 
                        key={c.id} 
                        className={`border-b border-slate-100 transition-colors ${
                          isSelected ? 'bg-blue-50' : esFalsoDetectado ? 'bg-amber-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSeleccionCliente(c.id)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              esFalsoDetectado 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {c.nombre.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <p className="font-medium text-slate-800">{c.nombre}</p>
                              <p className="text-xs text-slate-400">ID: {c.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{c.email}</td>
                        <td className="py-3 px-4 text-slate-600">{c.empresa || '—'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            c.activo 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {c.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            esFalsoDetectado 
                              ? 'bg-amber-100 text-amber-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {esFalsoDetectado ? '⚠️ Posible Falso' : '✅ Real'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(c.created_at).toLocaleDateString('es-ES')}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  usuariosFiltrados.map((u) => {
                    const esFalsoDetectado = esFalso(u.nombre, u.email);
                    const isSelected = seleccionadosUsuarios.includes(u.id);
                    
                    return (
                      <tr 
                        key={u.id} 
                        className={`border-b border-slate-100 transition-colors ${
                          isSelected ? 'bg-blue-50' : esFalsoDetectado ? 'bg-amber-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSeleccionUsuario(u.id)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              esFalsoDetectado 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {u.nombre.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <p className="font-medium text-slate-800">{u.nombre}</p>
                              <p className="text-xs text-slate-400">ID: {u.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{u.email}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            u.rol.toUpperCase() === 'ADMIN'
                              ? 'bg-emerald-50 text-emerald-700'
                              : u.rol.toUpperCase() === 'ANALISTA'
                                ? 'bg-blue-50 text-blue-700'
                                : u.rol.toUpperCase() === 'SUPERVISOR'
                                  ? 'bg-purple-50 text-purple-700'
                                  : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.rol}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            u.activo 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            esFalsoDetectado 
                              ? 'bg-amber-100 text-amber-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {esFalsoDetectado ? '⚠️ Posible Falso' : '✅ Real'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(u.created_at).toLocaleDateString('es-ES')}
                        </td>
                      </tr>
                    );
                  })
                )}
                {(activeTab === 'clientes' ? clientesFiltrados.length : usuariosFiltrados.length) === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No se encontraron {activeTab === 'clientes' ? 'clientes' : 'usuarios'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Instrucciones */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h4 className="font-semibold text-blue-800 mb-2">Instrucciones de Uso</h4>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Selecciona la pestaña de {activeTab === 'clientes' ? 'Clientes' : 'Usuarios'} que deseas limpiar</li>
            <li>Revisa la lista y identifica cuáles son datos de prueba</li>
            <li>Los elementos marcados como "⚠️ Posible Falso" son candidatos a eliminación</li>
            <li>Selecciona los elementos que deseas eliminar</li>
            <li>Haz clic en "Eliminar Seleccionados" para borrarlos permanentemente</li>
            <li>Los datos reales se conservarán intactos</li>
          </ol>
          <p className="mt-3 text-xs text-blue-600">
            <strong>Nota:</strong> Para usuarios, esta acción eliminará también los registros de auditoría relacionados.
            Para clientes, eliminará comentarios, análisis NLP y tiempos de atención relacionados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LimpiezaDatos;
