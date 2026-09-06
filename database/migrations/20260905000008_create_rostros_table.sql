-- ============================================================
-- NEXUS Corp · Centro Inteligente
-- Migracion: 008 - Tabla de rostros para reconocimiento facial
-- Fecha: 2026-09-05
-- ============================================================

-- Crear tabla de rostros para almacenar embeddings faciales
CREATE TABLE IF NOT EXISTS rostros (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    embedding JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices para busquedas eficientes
CREATE INDEX IF NOT EXISTS idx_rostros_usuario ON rostros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_rostros_created ON rostros(created_at);

-- Habilitar Realtime para la tabla de rostros
ALTER PUBLICATION supabase_realtime ADD TABLE rostros;

-- Deshabilitar RLS para la tabla de rostros
ALTER TABLE rostros DISABLE ROW LEVEL SECURITY;

-- Trigger para updated_at automatico
CREATE TRIGGER update_rostros_updated_at BEFORE UPDATE ON rostros
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentario de la tabla
COMMENT ON TABLE rostros IS 'Almacena embeddings faciales para reconocimiento de usuarios';
COMMENT ON COLUMN rostros.usuario_id IS 'Referencia al usuario propietario del rostro';
COMMENT ON COLUMN rostros.embedding IS 'Vector de embedding facial en formato JSON (Float32Array serializado)';
