export interface ComentarioDB {
  id: number;
  cliente_id: number | null;
  contenido: string;
  canal: string;
  estado: string;
  categoria: string | null;
  fecha: string;
  procesado: boolean;
  clientes?: { nombre: string; empresa: string } | null;
}

export interface Comentario {
  id: number;
  clienteId: number | null;
  clienteNombre: string;
  empresa: string;
  texto: string;
  categoria: string;
  confianza: number;
  sentimiento: string;
  procesado: boolean;
  fecha: string;
  canal: string;
  estado: string;
}

export interface AnalisisNLPDB {
  id: number;
  comentario_id: number;
  idioma: string;
  cantidad_palabras: number;
  palabras_limpias: unknown;
  palabras_frecuentes: unknown;
  categoria_detectada: string | null;
  confianza: number;
  fecha_analisis: string;
}
