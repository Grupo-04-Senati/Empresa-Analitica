-- Migrar tabla rostros: 1 embedding -> 3 columnas (frontal, izquierda, derecha)
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- 1. Eliminar tabla antigua
DROP TABLE IF EXISTS rostros CASCADE;

-- 2. Crear nueva tabla con 3 columnas de embedding
CREATE TABLE rostros (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    embedding_frontal JSONB,
    embedding_izquierda JSONB,
    embedding_derecha JSONB,
    foto_preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indices
CREATE INDEX idx_rostros_usuario ON rostros(usuario_id);

-- 4. Deshabilitar RLS
ALTER TABLE rostros DISABLE ROW LEVEL SECURITY;

-- 5. Agregar a realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rostros;
