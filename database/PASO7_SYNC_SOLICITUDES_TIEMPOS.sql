-- PASO 7: Sincronizar Solicitudes <-> Tiempos de Atencion
-- Crear tiempos_atencion automaticamente cuando una solicitud cambia a "en_proceso" o "resuelto"

-- 1. Asegurar que tiempos_atencion tenga las columnas necesarias
ALTER TABLE tiempos_atencion ADD COLUMN IF NOT EXISTS solicitud_id BIGINT;
ALTER TABLE tiempos_atencion ADD COLUMN IF NOT EXISTS sla_cumplido BOOLEAN DEFAULT false;

-- 2. Agregar FK a comentarios (solicitudes) si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tiempos_atencion_comentario_id_fkey'
  ) THEN
    ALTER TABLE tiempos_atencion
      ADD CONSTRAINT tiempos_atencion_comentario_id_fkey
      FOREIGN KEY (comentario_id) REFERENCES comentarios(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Crear indice para busquedas rapidas
CREATE INDEX IF NOT EXISTS idx_tiempos_comentario ON tiempos_atencion(comentario_id);

-- 4. Funcion para crear tiempo de atención al cambiar estado a "en_proceso"
CREATE OR REPLACE FUNCTION fn_crear_tiempo_desde_solicitud()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'en_proceso' AND (OLD.estado IS NULL OR OLD.estado != 'en_proceso') THEN
    INSERT INTO tiempos_atencion (cliente_id, comentario_id, tiempo_minutos, fecha, operador, sla_cumplido)
    VALUES (
      NEW.cliente_id,
      NEW.id,
      0,
      NOW(),
      COALESCE(CAST(NEW.asignado_a AS TEXT), CAST(NEW.usuario_id AS TEXT)),
      false
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.estado = 'resuelto' AND (OLD.estado IS NULL OR OLD.estado != 'resuelto') THEN
    UPDATE tiempos_atencion
    SET tiempo_minutos = GREATEST(
      0,
      EXTRACT(EPOCH FROM (NOW() - tiempos_atencion.fecha)) / 60
    ),
    sla_cumplido = (
      EXTRACT(EPOCH FROM (NOW() - tiempos_atencion.fecha)) / 60 <= 30
    )
    WHERE comentario_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear trigger en comentarios (solicitudes)
DROP TRIGGER IF EXISTS trg_sync_solicitud_tiempo ON comentarios;
CREATE TRIGGER trg_sync_solicitud_tiempo
  AFTER UPDATE ON comentarios
  FOR EACH ROW
  WHEN (NEW.tipo = 'solicitud')
  EXECUTE FUNCTION fn_crear_tiempo_desde_solicitud();

-- 6. Actualizar registros existentes: sincronizar cliente_id donde falte
UPDATE tiempos_atencion t
SET cliente_id = c.cliente_id
FROM comentarios c
WHERE t.comentario_id = c.id
  AND t.cliente_id IS NULL
  AND c.cliente_id IS NOT NULL;

-- 7. Actualizar registros existentes: sincronizar operador donde falte
UPDATE tiempos_atencion t
SET operador = COALESCE(CAST(c.asignado_a AS TEXT), CAST(c.usuario_id AS TEXT))
FROM comentarios c
WHERE t.comentario_id = c.id
  AND t.operador IS NULL;

-- 8. Actualizar sla_cumplido para registros existentes sin calcular
UPDATE tiempos_atencion
SET sla_cumplido = (tiempo_minutos <= 30)
WHERE sla_cumplido IS NULL OR sla_cumplido = false;

-- 9. Asegurar RLS para tiempos_atencion
ALTER TABLE tiempos_atencion ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_tiempos' AND tablename = 'tiempos_atencion') THEN
    CREATE POLICY allow_all_tiempos ON tiempos_atencion FOR ALL USING (true);
  END IF;
END $$;
