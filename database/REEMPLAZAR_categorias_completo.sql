-- PASO COMPLETO: Reemplazar categorías viejas por POSITIVO/NEGATIVO/NEUTRO
-- y actualizar todos los registros existentes en analisis_nlp
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar TODAS las categorías viejas
DELETE FROM categorias;

-- 2. Insertar las 3 categorías de sentimiento
INSERT INTO categorias (nombre, descripcion, activo) VALUES
  ('POSITIVO', 'Comentarios con sentimiento positivo: felicitaciones, agradecimiento, satisfacción', true),
  ('NEGATIVO', 'Comentarios con sentimiento negativo: quejas, reclamos, insatisfacción, insultos', true),
  ('NEUTRO', 'Comentarios sin sentimiento claro: consultas, información, dudas', true);

-- 3. Actualizar TODOS los registros de analisis_nlp según su sentimiento
UPDATE analisis_nlp SET categoria_detectada = 'POSITIVO' WHERE sentimiento = 'positivo';
UPDATE analisis_nlp SET categoria_detectada = 'NEGATIVO' WHERE sentimiento = 'negativo';
UPDATE analisis_nlp SET categoria_detectada = 'NEUTRO' WHERE sentimiento = 'neutro' OR sentimiento IS NULL;

-- 4. Actualizar la columna categoria en comentarios según su analisis_nlp
UPDATE comentarios c
SET categoria = a.categoria_detectada
FROM analisis_nlp a
WHERE c.id = a.comentario_id;

-- 5. Verificar resultados
SELECT 'categorias' as tabla, COUNT(*) as total FROM categorias
UNION ALL
SELECT 'analisis_nlp', COUNT(*) FROM analisis_nlp
UNION ALL
SELECT 'comentarios_con_categoria', COUNT(*) FROM comentarios WHERE categoria IS NOT NULL;

SELECT a.categoria_detectada, a.sentimiento, COUNT(*) as total
FROM analisis_nlp a
GROUP BY a.categoria_detectada, a.sentimiento
ORDER BY total DESC;
