import { supabase } from './supabase';

export interface AuditEvent {
  usuario_email?: string;
  usuario_id?: number;
  accion: string;
  tabla?: string;
  registro_id?: number;
  datos_anteriores?: Record<string, unknown>;
  datos_nuevos?: Record<string, unknown>;
  ip?: string;
  detalles?: string;
  modulo?: string;
}

export async function logAudit(event: AuditEvent) {
  try {
    const row: Record<string, unknown> = {
      usuario_email: event.usuario_email || null,
      usuario_id: event.usuario_id || null,
      accion: event.accion,
      tabla: event.tabla || null,
      registro_id: event.registro_id || null,
      datos_anteriores: event.datos_anteriores || null,
      datos_nuevos: event.datos_nuevos || null,
      ip: event.ip || null,
      detalles: event.detalles || null,
      modulo: event.modulo || null,
    };

    const { error } = await supabase.from('auditoria').insert(row);
    if (error) {
      console.warn('[audit] INSERT FAILED:', error.message);
    } else {
      console.log('[audit] OK:', event.accion);
    }
  } catch (e) {
    console.warn('[audit] CATCH:', e);
  }
}
