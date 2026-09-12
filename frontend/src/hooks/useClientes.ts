import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface ClienteDB {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface UseClientesReturn {
  clientes: ClienteDB[];
  loading: boolean;
  error: string | null;
  fetchClientes: () => Promise<void>;
  crearCliente: (data: { nombre: string; email: string; telefono: string; empresa: string }) => Promise<boolean>;
  actualizarCliente: (id: number, data: { nombre: string; email: string; telefono: string; empresa: string }) => Promise<boolean>;
  eliminarCliente: (id: number) => Promise<boolean>;
  toggleEstado: (id: number) => Promise<boolean>;
}

export const useClientes = (): UseClientesReturn => {
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setClientes(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const crearCliente = useCallback(async (data: { nombre: string; email: string; telefono: string; empresa: string }) => {
    try {
      const { error: err } = await supabase.from('clientes').insert({ ...data, activo: true });
      if (err) throw err;
      await fetchClientes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear cliente');
      return false;
    }
  }, [fetchClientes]);

  const actualizarCliente = useCallback(async (id: number, data: { nombre: string; email: string; telefono: string; empresa: string }) => {
    try {
      const { error: err } = await supabase.from('clientes').update(data).eq('id', id);
      if (err) throw err;
      await fetchClientes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar cliente');
      return false;
    }
  }, [fetchClientes]);

  const eliminarCliente = useCallback(async (id: number) => {
    try {
      await supabase.from('comentarios').update({ cliente_id: null }).eq('cliente_id', id);
      await supabase.from('tiempos_atencion').update({ cliente_id: null }).eq('cliente_id', id);
      const { error: err } = await supabase.from('clientes').delete().eq('id', id);
      if (err) throw err;
      await fetchClientes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar cliente');
      return false;
    }
  }, [fetchClientes]);

  const toggleEstado = useCallback(async (id: number) => {
    try {
      const cliente = clientes.find((c) => c.id === id);
      if (!cliente) return false;
      const { error: err } = await supabase.from('clientes').update({ activo: !cliente.activo }).eq('id', id);
      if (err) throw err;
      await fetchClientes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
      return false;
    }
  }, [clientes, fetchClientes]);

  return { clientes, loading, error, fetchClientes, crearCliente, actualizarCliente, eliminarCliente, toggleEstado };
};
