import { apiGet, apiPost } from './api';

export interface AnalisisNLP {
  sentimiento: 'positivo' | 'neutro' | 'negativo';
  confianza: number;
  categoria: string;
  keywords: string[];
  temas: string[];
}

export interface CentroInteligente {
  clientes: number;
  comentarios: number;
  promedioRespuesta: number;
  procesados: number;
}

export interface CategoriaDist {
  nombre: string;
  total: number;
  porcentaje: number;
  color: string;
}

export interface PalabraFrecuente {
  palabra: string;
  frecuencia: number;
  color: string;
}

export interface ComentarioNLP {
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

export const nltkService = {
  analizarTexto: (texto: string) =>
    apiPost<AnalisisNLP>('/api/nltk/analizar', { texto }),

  getCentroInteligente: () => apiGet<CentroInteligente>('/api/nltk/centro-inteligente'),

  getComentariosNLP: () => apiGet<ComentarioNLP[]>('/api/nltk/comentarios'),

  getCategoriasDist: () => apiGet<CategoriaDist[]>('/api/nltk/categorias'),

  getPalabrasFrecuentes: () => apiGet<PalabraFrecuente[]>('/api/nltk/palabras-frecuentes'),

  calcularFrecuencias: (textos: string[]) =>
    apiPost<{ palabras_frecuentes: { palabra: string; frecuencia: number }[] }>('/api/nltk/palabras-frecuentes', textos),

  clasificar: (data: { texto?: string; comentarios?: Record<string, unknown>[] }) =>
    apiPost('/api/nltk/clasificar', data),
};
