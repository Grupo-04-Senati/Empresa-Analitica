import { apiGet, apiPost, apiPut, apiDelete } from './api';

export interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  accion_url: string | null;
  created_at: string;
}

export interface NotificacionesResponse {
  notificaciones: Notificacion[];
  total_no_leidas: number;
}

export const notificacionesService = {
  getNotificaciones: (soloNoLeidas = false) =>
    apiGet<NotificacionesResponse>(`/api/notificaciones?solo_no_leidas=${soloNoLeidas}`),

  crearNotificacion: (data: { titulo: string; mensaje: string; tipo?: string; accion_url?: string }) =>
    apiPost<{ id: number; mensaje: string }>('/api/notificaciones', data),

  marcarLeida: (id: number) =>
    apiPut<{ mensaje: string }>(`/api/notificaciones/${id}/leer`),

  marcarTodasLeidas: () =>
    apiPut<{ mensaje: string }>('/api/notificaciones/leer-todas'),

  eliminar: (id: number) =>
    apiDelete<{ mensaje: string }>(`/api/notificaciones/${id}`),

  eliminarTodas: () =>
    apiDelete<{ mensaje: string }>('/api/notificaciones/eliminar-todas'),

  eliminarAntiguas: (meses: number) =>
    apiDelete<{ mensaje: string }>(`/api/notificaciones/eliminar-antiguas/${meses}`),
};
