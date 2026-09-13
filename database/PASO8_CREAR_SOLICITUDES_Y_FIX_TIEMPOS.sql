-- ============================================================
-- PASO 8: Crear tabla solicitudes + corregir tiempos_atencion
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- 1. CREAR TABLA SOLICITUDES
CREATE TABLE IF NOT EXISTS solicitudes (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
  contenido TEXT NOT NULL,
  canal VARCHAR(30) DEFAULT 'web',
  prioridad VARCHAR(20) DEFAULT 'normal',
  estado VARCHAR(30) DEFAULT 'pendiente',
  operador VARCHAR(150),
  usuario_id BIGINT,
  fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
  fecha_inicio TIMESTAMPTZ,
  fecha_resolucion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CORREGIR TABLA TIEMPOS_ATENCION
ALTER TABLE tiempos_atencion
  ADD COLUMN IF NOT EXISTS solicitud_id BIGINT REFERENCES solicitudes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS sla_cumplido BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. INDICES
CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente ON solicitudes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha ON solicitudes(fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_tiempos_solicitud ON tiempos_atencion(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_tiempos_cliente ON tiempos_atencion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tiempos_fecha ON tiempos_atencion(fecha);

-- 4. FUNCION: Crear tiempo al cambiar solicitud a en_proceso
CREATE OR REPLACE FUNCTION fn_solicitud_to_tiempo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'en_proceso' AND (OLD.estado IS NULL OR OLD.estado != 'en_proceso') THEN
    INSERT INTO tiempos_atencion (solicitud_id, cliente_id, tiempo_minutos, fecha, operador, estado, sla_cumplido)
    VALUES (
      NEW.id,
      NEW.cliente_id,
      0,
      CURRENT_DATE,
      COALESCE(NEW.operador, CAST(NEW.usuario_id AS TEXT)),
      'en_proceso',
      FALSE
    )
    ON CONFLICT DO NOTHING;

    UPDATE solicitudes SET fecha_inicio = NOW(), updated_at = NOW() WHERE id = NEW.id;
  END IF;

  IF NEW.estado = 'resuelto' AND (OLD.estado IS NULL OR OLD.estado != 'resuelto') THEN
    UPDATE tiempos_atencion
    SET tiempo_minutos = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(
      (SELECT fecha_inicio FROM solicitudes WHERE id = NEW.id), NOW()
    ))) / 60, 2)),
    sla_cumplido = (GREATEST(0, EXTRACT(EPOCH FROM (NOW() - COALESCE(
      (SELECT fecha_inicio FROM solicitudes WHERE id = NEW.id), NOW()
    ))) / 60) <= 30),
    estado = 'resuelto',
    updated_at = NOW()
    WHERE solicitud_id = NEW.id;

    UPDATE solicitudes SET fecha_resolucion = NOW(), updated_at = NOW() WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. TRIGGER en solicitudes
DROP TRIGGER IF EXISTS trg_solicitud_tiempo ON solicitudes;
CREATE TRIGGER trg_solicitud_tiempo
  AFTER UPDATE ON solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION fn_solicitud_to_tiempo();

-- 6. RLS para solicitudes
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_solicitudes' AND tablename = 'solicitudes') THEN
    CREATE POLICY allow_all_solicitudes ON solicitudes FOR ALL USING (true);
  END IF;
END $$;

-- 7. RLS para tiempos_atencion (asegurar)
ALTER TABLE tiempos_atencion ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_tiempos' AND tablename = 'tiempos_atencion') THEN
    CREATE POLICY allow_all_tiempos ON tiempos_atencion FOR ALL USING (true);
  END IF;
END $$;
