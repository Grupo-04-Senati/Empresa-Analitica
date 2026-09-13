-- ============================================================
-- PASO 9: Tabla auditoria + Endpoint cambio de rol
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- 1. CREAR TABLA AUDITORIA (si no existe)
CREATE TABLE IF NOT EXISTS auditoria (
  id BIGSERIAL PRIMARY KEY,
  usuario_email VARCHAR(200),
  usuario_id BIGINT,
  accion VARCHAR(50) NOT NULL,
  tabla VARCHAR(100),
  registro_id BIGINT,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  ip VARCHAR(50),
  detalles TEXT,
  modulo VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INDICES
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria(accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(created_at);

-- 3. RLS
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_auditoria' AND tablename = 'auditoria') THEN
    CREATE POLICY allow_all_auditoria ON auditoria FOR ALL USING (true);
  END IF;
END $$;
