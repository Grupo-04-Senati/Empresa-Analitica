import { apiGet, apiPost } from './api';

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
  getEstadisticas: () => apiGet<Estadisticas[]>('/api/scipy/estadisticas'),

  calcularEstadisticas: (valores: number[]) =>
    apiPost<Estadisticas>('/api/scipy/estadisticas', { valores }),

  getTiemposAtencion: () => apiGet<TiempoPunto[]>('/api/scipy/tiempos-atencion'),

  getOptimizacion: () => apiGet<{ optimizaciones: Optimizacion[]; puntajeGeneral: number }>('/api/scipy/optimizacion'),

  optimizar: (params: { nombre?: string; descripcion?: string; parametros_entrada: Record<string, number> }) =>
    apiPost('/api/scipy/optimizacion', params),

  interpolar: (data: { x: number[]; y: number[]; x_new: number[] }) =>
    apiPost<{ puntos: InterpolacionPunto[]; r2: number; errorMedio: number; errorRelativo: number }>('/api/scipy/interpolacion', data),
};
