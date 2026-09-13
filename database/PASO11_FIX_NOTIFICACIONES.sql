-- ============================================================
-- PASO 11: Fix notificaciones - agrega eliminada + indices
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- 1. Agregar columna eliminada si no existe
ALTER TABLE notificaciones
ADD COLUMN IF NOT EXISTS eliminada BOOLEAN DEFAULT FALSE;

-- 2. Agregar columna generado_por si no existe
ALTER TABLE notificaciones
ADD COLUMN IF NOT EXISTS generado_por VARCHAR(50) DEFAULT 'manual';

-- 3. Agregar columna destinatario si no existe
ALTER TABLE notificaciones
ADD COLUMN IF NOT EXISTS destinatario VARCHAR(200);

-- 4. Indices para consultas rapidas
CREATE INDEX IF NOT EXISTS idx_notif_destinatario ON notificaciones(destinatario);
CREATE INDEX IF NOT EXISTS idx_notif_leida ON notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_notif_eliminada ON notificaciones(eliminada);
CREATE INDEX IF NOT EXISTS idx_notif_fecha ON notificaciones(created_at);

-- 5. RLS
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_notif' AND tablename = 'notificaciones') THEN
    CREATE POLICY allow_all_notif ON notificaciones FOR ALL USING (true);
  END IF;
END $$;
