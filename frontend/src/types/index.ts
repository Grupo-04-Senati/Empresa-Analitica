export type { ClienteDB } from './clientes';
export type { ComentarioDB, Comentario, AnalisisNLPDB } from './comentarios';
export type { MetricaEstadisticaDB, OptimizacionDB, PuntoTiempo, OptimizacionResultado } from './metricas';

// Tipos legacy (mantener por compatibilidad)
export type EstadoEntidad = 'activo' | 'inactivo' | 'pendiente';
export type Severidad = 'baja' | 'media' | 'alta';
export type Prioridad = 'baja' | 'media' | 'alta' | 'urgente';

export interface CategoriaDB {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

export interface TiempoAtencionDB {
  id: number;
  cliente_id: number | null;
  comentario_id: number | null;
  tiempo_minutos: number;
  fecha: string;
  operador: string | null;
  created_at: string;
  clientes?: { nombre: string; empresa: string } | null;
}

export interface AuditoriaDB {
  id: number;
  usuario_id: number | null;
  accion: string;
  tabla: string | null;
  registro_id: number | null;
  detalles: unknown;
  ip: string | null;
  created_at: string;
  usuarios?: { nombre: string; email: string } | null;
}

export interface UsuarioDB {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  created_at: string;
}

export interface EventoAuditoria {
  id: number;
  fecha: string;
  usuario: string;
  accion: string;
  tabla: string;
  ip: string;
}

export interface PuntoInterpolacion {
  x: number;
  observado: number | null;
  interpolado: number;
}

export interface InterpolacionResultado {
  puntos: PuntoInterpolacion[];
  r2: number;
  errorMedio: number;
  errorRelativo: number;
}

export interface ResultadoNLP {
  sentimiento: 'positivo' | 'neutro' | 'negativo';
  confianza: number;
  categoria: string;
  keywords: string[];
  temas: string[];
}

export interface CategoriaNLP {
  nombre: string;
  porcentaje: number;
  color: string;
  total: number;
}

export interface PalabraFrecuente {
  palabra: string;
  frecuencia: number;
  color: string;
}

export interface CentroInteligente {
  clientes: number;
  comentarios: number;
  promedioRespuesta: number;
  procesados: number;
}
