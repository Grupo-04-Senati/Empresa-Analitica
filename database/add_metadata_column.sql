ALTER TABLE rostros ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN rostros.metadata IS 'Almacena 68 landmarks faciales (x,y), proporciones geometricas, angulos y equivalencia unica del rostro';
