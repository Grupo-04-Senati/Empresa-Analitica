import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

interface DashboardStats {
  totalClientes: number;
  totalComentarios: number;
  avgTiempoAtencion: number;
  porcentajeProcesados: number;
  totalAnalisis: number;
  comentariosPendientes: number;
}

interface CategoriaDist {
  nombre: string;
  total: number;
  porcentaje: number;
}

interface PalabraFreq {
  palabra: string;
  frecuencia: number;
}

interface TiempoPunto {
  fecha: string;
  minutos: number;
  sla: number;
}

interface DashboardData {
  stats: DashboardStats;
  categorias: CategoriaDist[];
  palabras: PalabraFreq[];
  tiempos: TiempoPunto[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useDashboardData = (): DashboardData => {
  const [stats, setStats] = useState<DashboardStats>({
    totalClientes: 0,
    totalComentarios: 0,
    avgTiempoAtencion: 0,
    porcentajeProcesados: 0,
    totalAnalisis: 0,
    comentariosPendientes: 0,
  });
  const [categorias, setCategorias] = useState<CategoriaDist[]>([]);
  const [palabras, setPalabras] = useState<PalabraFreq[]>([]);
  const [tiempos, setTiempos] = useState<TiempoPunto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
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
      const avgTiempoAtencion = tiemposData.length > 0
        ? Math.round(tiemposData.reduce((s: any, t: any) => s + t.tiempo_minutos, 0) / tiemposData.length)
        : 0;

      setStats({
        totalClientes,
        totalComentarios,
        avgTiempoAtencion,
        porcentajeProcesados,
        totalAnalisis: analisisRes.data?.length || 0,
        comentariosPendientes: pendientes,
      });

      // Categorías NLP
      const catCount: Record<string, number> = {};
      (analisisRes.data || []).forEach((a: any) => {
        if (a.categoria_detectada) catCount[a.categoria_detectada] = (catCount[a.categoria_detectada] || 0) + 1;
      });
      const totalAnalisis = Object.values(catCount).reduce((s, v) => s + v, 0);
      const catDist = Object.entries(catCount)
        .map(([nombre, total]) => ({ nombre, total, porcentaje: totalAnalisis > 0 ? Math.round((total / totalAnalisis) * 100) : 0 }))
        .sort((a, b) => b.total - a.total);
      setCategorias(catDist);

      // Palabras frecuentes
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
        .slice(0, 20);
      setPalabras(palabrasFreq);

      // Tiempos de atención por fecha
      const tiemposPorFecha: Record<string, number[]> = {};
      tiemposData.forEach((t: any) => {
        const fecha = t.fecha?.split('T')[0] || 'sin fecha';
        if (!tiemposPorFecha[fecha]) tiemposPorFecha[fecha] = [];
        tiemposPorFecha[fecha].push(t.tiempo_minutos);
      });
      const tiemposChart = Object.entries(tiemposPorFecha)
        .map(([fecha, mins]) => ({
          fecha: fecha.slice(5),
          minutos: Math.round(mins.reduce((s, v) => s + v, 0) / mins.length),
          sla: 30,
        }))
        .slice(-12);
      setTiempos(tiemposChart);

      setError(null);
    } catch (err) {
      console.error('Dashboard error:', err);
      setError('Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios' }, () => fetchDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => fetchDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiempos_atencion' }, () => fetchDashboard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'analisis_nlp' }, () => fetchDashboard())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchDashboard]);

  return { stats, categorias, palabras, tiempos, loading, error, refetch: fetchDashboard };
};
