-- Agregar columna last_seen a clientes para rastrear actividad en linea
-- Clientes con last_seen en los ultimos 2 minutos se consideran "en linea"

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NULL;

-- Index para busqueda rapida de clientes activos
CREATE INDEX IF NOT EXISTS idx_clientes_last_seen ON clientes (last_seen DESC);

-- Funcion para actualizar last_seen del cliente actual
-- Se llama desde el heartbeat del frontend
CREATE OR REPLACE FUNCTION update_cliente_last_seen(p_cliente_id BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE clientes
  SET last_seen = NOW(),
      updated_at = NOW()
  WHERE id = p_cliente_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vista rapida: clientes en linea (ultimos 2 minutos)
CREATE OR REPLACE VIEW clientes_en_linea AS
SELECT id, nombre, email, last_seen
FROM clientes
WHERE last_seen IS NOT NULL
  AND last_seen > NOW() - INTERVAL '2 minutes';
