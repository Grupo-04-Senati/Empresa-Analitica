-- Migracion para sistema facial MediaPipe 478 puntos
-- Ejecutar en Supabase Dashboard > SQL Editor

-- Agregar columna para landmarks completos478 (JSONB)
ALTER TABLE rostros ADD COLUMN IF NOT EXISTS landmarks_478 jsonb DEFAULT NULL;

-- Agregar columna para firma facial compacta (array numerico)
ALTER TABLE rostros ADD COLUMN IF NOT EXISTS face_signature jsonb DEFAULT NULL;

-- Agregar columna para datos de blendshapes
ALTER TABLE rostros ADD COLUMN IF NOT EXISTS blendshapes jsonb DEFAULT NULL;

-- Agregar columna para metadata del scan (estabilidad, frames, etc)
-- ya existe metadata (jsonb), podemos usarla para engine info

-- Comentario en las columnas
COMMENT ON COLUMN rostros.landmarks_478 IS '478 landmarks normalizados [x,y,z,...] — MediaPipe Face Mesh';
COMMENT ON COLUMN rostros.face_signature IS 'Firma facial compacta — indices clave de los 478 landmarks';
COMMENT ON COLUMN rostros.blendshapes IS 'Blendshapes de MediaPipe (expresiones faciales)';

-- Verificar estructura
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'rostros' 
ORDER BY ordinal_position;
