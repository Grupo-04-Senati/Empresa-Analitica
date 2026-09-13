-- ============================================================
-- PASO 1: Ampliar esquema de auditoria y notificaciones
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

-- 1a. AUDITORIA: agregar usuario_o_sistema
ALTER TABLE auditoria
  ADD COLUMN IF NOT EXISTS usuario_o_sistema VARCHAR(50) DEFAULT 'usuario';

COMMENT ON COLUMN auditoria.usuario_o_sistema IS
  'Quien ejecuto la accion: usuario (admin/analista), sistema (trigger automatico), o sistema_nlp (clasificacion automatica)';

-- 1b. NOTIFICACIONES: agregar columnas para notificaciones automaticas
ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS redirigir_a VARCHAR(300);

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS origen_tabla VARCHAR(100);

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS origen_id BIGINT;

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS generado_por VARCHAR(20) DEFAULT 'admin';

COMMENT ON COLUMN notificaciones.generado_por IS
  'admin = enviado manualmente por un administrador, sistema = generado automaticamente por un trigger o evento';

COMMENT ON COLUMN notificaciones.origen_tabla IS
  'Tabla que genero la notificacion (solicitudes, comentarios, etc.)';

COMMENT ON COLUMN notificaciones.origen_id IS
  'ID del registro en la tabla origen que genero la notificacion';

-- 1c. Index para busqueda rapida de notificaciones por origen
CREATE INDEX IF NOT EXISTS idx_notificaciones_origen
  ON notificaciones (origen_tabla, origen_id)
  WHERE origen_tabla IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notificaciones_generado
  ON notificaciones (generado_por);
