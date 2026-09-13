-- ============================================================
-- PASO 10: Agregar columna generado_por a notificaciones
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

ALTER TABLE notificaciones
ADD COLUMN IF NOT EXISTS generado_por VARCHAR(50) DEFAULT 'manual';

COMMENT ON COLUMN notificaciones.generado_por IS 'Identifica quien genero la notificacion: manual, sistema, admin';
