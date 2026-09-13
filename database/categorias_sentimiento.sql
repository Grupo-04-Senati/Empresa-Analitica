-- Categorías basadas en sentimiento: POSITIVO, NEGATIVO, NEUTRO
-- Ejecutar en Supabase SQL Editor

-- Desactivar categorías viejas que no sean estas tres
UPDATE categorias SET activo = false
WHERE nombre NOT IN ('POSITIVO', 'NEGATIVO', 'NEUTRO');

-- Insertar las tres categorías correctas (upsert)
INSERT INTO categorias (nombre, descripcion, activo)
VALUES
  ('POSITIVO', 'Comentarios con sentimiento positivo: felicitaciones, agradecimiento, satisfacción', true),
  ('NEGATIVO', 'Comentarios con sentimiento negativo: quejas, reclamos, insatisfacción, insultos', true),
  ('NEUTRO', 'Comentarios sin sentimiento claro: consultas, información, dudas', true)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  activo = true;

-- Verificar
SELECT id, nombre, activo FROM categorias ORDER BY nombre;
