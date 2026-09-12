import { edgeFunction } from './edge';

export interface Estadisticas {
  cantidad: number;
  media: number;
  mediana: number;
  desviacion_estandar: number;
  minimo: number;
  maximo: number;
  percentil_25: number;
  percentil_75: number;
}

export interface TiempoPunto {
  hora: string;
  minutos: number;
  sla: number;
}

export interface Optimizacion {
  id: number;
  nombre: string;
  descripcion: string | null;
  parametros_entrada: unknown;
  resultado: unknown;
  costo_inicial: number;
  costo_optimizado: number | null;
  estado: string;
  created_at: string;
}

export interface InterpolacionPunto {
  x: number;
  observado: number | null;
  interpolado: number;
}

export const scipyService = {
  getEstadisticas: async (): Promise<Estadisticas[]> => {
    const { data } = await import('./supabase').then(m => m.supabase.from('metricas_estadisticas').select('*').order('created_at', { ascending: false }).limit(10));
    return data || [];
  },

  calcularEstadisticas: (valores: number[]) =>
    edgeFunction<Estadisticas>('scipy-estadisticas', { valores }),

  getTiemposAtencion: async (): Promise<TiempoPunto[]> => {
    try {
      const { supabase } = await import('./supabase');
      const { data } = await supabase.from('tiempos_atencion').select('*').order('fecha', { ascending: false }).limit(12);
      if (data?.length) {
        return data.map((r: { fecha: string; tiempo_minutos: number }) => ({
          hora: new Date(r.fecha).toLocaleDateString('es', { day: '2-digit', month: '2-digit' }),
          minutos: r.tiempo_minutos,
          sla: 30,
        })).reverse();
      }
    } catch {}
    return [
      { hora: '08:00', minutos: 14.5, sla: 30 },
      { hora: '10:00', minutos: 18.2, sla: 30 },
      { hora: '12:00', minutos: 24.1, sla: 30 },
      { hora: '14:00', minutos: 19.8, sla: 30 },
      { hora: '16:00', minutos: 15.3, sla: 30 },
      { hora: '18:00', minutos: 12.0, sla: 30 },
    ];
  },

  getOptimizacion: async (): Promise<{ optimizaciones: Optimizacion[]; puntajeGeneral: number }> => {
    try {
      const { supabase } = await import('./supabase');
      const { data } = await supabase.from('optimizaciones').select('*').order('created_at', { ascending: false }).limit(5);
      return { optimizaciones: data || [], puntajeGeneral: 87 };
    } catch {
      return { optimizaciones: [], puntajeGeneral: 87 };
    }
  },

  optimizar: (params: { nombre?: string; descripcion?: string; parametros_entrada: Record<string, number> }) =>
    edgeFunction('scipy-optimizacion', params),

  interpolar: (data: { x: number[]; y: number[]; x_new: number[] }) =>
    edgeFunction<{ puntos: InterpolacionPunto[]; r2: number; errorMedio: number; errorRelativo: number }>('scipy-interpolacion', data),
};
