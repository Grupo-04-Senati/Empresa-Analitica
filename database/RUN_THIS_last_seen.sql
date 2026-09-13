-- Ejecutar esto en el SQL Editor de Supabase si last_seen no existe aun
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_last_seen ON clientes (last_seen DESC);
