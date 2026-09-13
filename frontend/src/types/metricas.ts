export interface MetricaEstadisticaDB {
  id: number;
  fecha_inicio: string;
  fecha_fin: string;
  cantidad_registros: number;
  media: number;
  mediana: number;
  desviacion_estandar: number;
  minimo: number;
  maximo: number;
  percentil_25: number;
  percentil_75: number;
  created_at: string;
}

export interface OptimizacionDB {
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

export interface PuntoTiempo {
  hora: string;
  minutos: number;
  sla: number;
}

export interface OptimizacionResultado {
  areas: { nombre: string; valor: number; color: string }[];
  recomendaciones: { titulo: string; descripcion: string; impacto: 'Alto' | 'Medio'; aplicada: boolean }[];
  puntajeGeneral: number;
}
