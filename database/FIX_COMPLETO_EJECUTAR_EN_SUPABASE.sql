-- ============================================================
-- FIX COMPLETO: Todas las tablas y columnas faltantes
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor
-- ============================================================

-- 1. TABLA SOLICITUDES (no existe)
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

-- 2. CORREGIR TIEMPOS_ATENCION
ALTER TABLE tiempos_atencion ADD COLUMN IF NOT EXISTS solicitud_id BIGINT;
ALTER TABLE tiempos_atencion ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'pendiente';
ALTER TABLE tiempos_atencion ADD COLUMN IF NOT EXISTS sla_cumplido BOOLEAN DEFAULT FALSE;
ALTER TABLE tiempos_atencion ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. CORREGIR NOTIFICACIONES
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS generado_por VARCHAR(50) DEFAULT 'manual';
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS eliminada BOOLEAN DEFAULT FALSE;
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS destinatario VARCHAR(200);

-- 4. TABLA AUDITORIA (no existe)
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

-- 5. INDICES
CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente ON solicitudes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha ON solicitudes(fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_tiempos_solicitud ON tiempos_atencion(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_tiempos_cliente ON tiempos_atencion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tiempos_fecha ON tiempos_atencion(fecha);
CREATE INDEX IF NOT EXISTS idx_notif_dest ON notificaciones(destinatario);
CREATE INDEX IF NOT EXISTS idx_notif_leida ON notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_notif_eliminada ON notificaciones(eliminada);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria(accion);

-- 6. TRIGGER: sync solicitudes → tiempos_atencion
CREATE OR REPLACE FUNCTION fn_solicitud_to_tiempo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'en_proceso' AND (OLD.estado IS NULL OR OLD.estado != 'en_proceso') THEN
    INSERT INTO tiempos_atencion (solicitud_id, cliente_id, tiempo_minutos, fecha, operador, estado, sla_cumplido)
    VALUES (NEW.id, NEW.cliente_id, 0, CURRENT_DATE, COALESCE(NEW.operador, CAST(NEW.usuario_id AS TEXT)), 'en_proceso', FALSE)
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
    estado = 'resuelto', updated_at = NOW()
    WHERE solicitud_id = NEW.id;
    UPDATE solicitudes SET fecha_resolucion = NOW(), updated_at = NOW() WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_solicitud_tiempo ON solicitudes;
CREATE TRIGGER trg_solicitud_tiempo
  AFTER UPDATE ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION fn_solicitud_to_tiempo();

-- 7. RLS (habilitar todas)
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiempos_atencion ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_sol' AND tablename = 'solicitudes') THEN
    CREATE POLICY allow_all_sol ON solicitudes FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_tiempos2' AND tablename = 'tiempos_atencion') THEN
    CREATE POLICY allow_all_tiempos2 ON tiempos_atencion FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_notif2' AND tablename = 'notificaciones') THEN
    CREATE POLICY allow_all_notif2 ON notificaciones FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_aud' AND tablename = 'auditoria') THEN
    CREATE POLICY allow_all_aud ON auditoria FOR ALL USING (true);
  END IF;
END $$;
