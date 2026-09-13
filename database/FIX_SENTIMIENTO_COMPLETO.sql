-- ============================================
-- SQL COMPLETO: Categorías de Sentimiento
-- Ejecutar TODO en Supabase SQL Editor de UNA SOLA vez
-- ============================================

-- 1. Asegurar que analisis_nlp tenga columna sentimiento
ALTER TABLE public.analisis_nlp ADD COLUMN IF NOT EXISTS sentimiento VARCHAR(30) DEFAULT 'neutro';

-- 2. Asegurar que comentarios tenga columna categoria
ALTER TABLE public.comentarios ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT NULL;

-- 3. ELIMINAR todas las categorías viejas
DELETE FROM categorias;

-- 4. INSERTAR las 3 categorías de sentimiento
INSERT INTO categorias (nombre, descripcion, activo) VALUES
  ('POSITIVO', 'Comentarios con sentimiento positivo: felicitaciones, agradecimiento, satisfaccion', true),
  ('NEGATIVO', 'Comentarios con sentimiento negativo: quejas, reclamos, insatisfaccion, insultos', true),
  ('NEUTRO', 'Comentarios sin sentimiento claro: consultas, informacion, dudas', true)
ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion, activo = true;

-- 5. ACTUALIZAR sentimiento y categoria_detectada en analisis_nlp segun el CONTENIDO del comentario
UPDATE analisis_nlp a
SET
  sentimiento = CASE
    WHEN EXISTS (
      SELECT 1 FROM comentarios c
      WHERE c.id = a.comentario_id
        AND lower(c.contenido) ~ '(excelente|bueno|buen|buenas|genial|increible|perfecto|agradecido|agradecida|gracias|feliz|satisfecho|satisfecha|recomiendo|me gusta|maravilloso|fantastico|rapido|eficiente|calidad|profesional|amable|resolvio|ayuda|mejor|bien|ok|servicio bueno|todo bien|funciona bien)'
    ) THEN 'positivo'
    WHEN EXISTS (
      SELECT 1 FROM comentarios c
      WHERE c.id = a.comentario_id
        AND lower(c.contenido) ~ '(malo|mala|terrible|pesimo|horrible|lento|lenta|error|problema|queja|reclamo|insatisfecho|decepcionado|no funciona|no sirve|muy lento|deficiente|lamentable|estafa|fraude|furioso|molesto|incumplimiento|carajo|mierda|puta|maldito|culo|pendejo|estupido|imbecil|idiota|basura|asco|desastre|falso|robo|corrupto|inutil|verguenza|odio|detesto|desesperado|hartado|harto|jodido|hijueputa|malparido|careverga|marica|maricon|puto|pedo|caca|verga|torpe)'
    ) THEN 'negativo'
    ELSE 'neutro'
  END,
  categoria_detectada = CASE
    WHEN EXISTS (
      SELECT 1 FROM comentarios c
      WHERE c.id = a.comentario_id
        AND lower(c.contenido) ~ '(excelente|bueno|buen|buenas|genial|increible|perfecto|agradecido|agradecida|gracias|feliz|satisfecho|satisfecha|recomiendo|me gusta|maravilloso|fantastico|rapido|eficiente|calidad|profesional|amable|resolvio|ayuda|mejor|bien|ok|servicio bueno|todo bien|funciona bien)'
    ) THEN 'POSITIVO'
    WHEN EXISTS (
      SELECT 1 FROM comentarios c
      WHERE c.id = a.comentario_id
        AND lower(c.contenido) ~ '(malo|mala|terrible|pesimo|horrible|lento|lenta|error|problema|queja|reclamo|insatisfecho|decepcionado|no funciona|no sirve|muy lento|deficiente|lamentable|estafa|fraude|furioso|molesto|incumplimiento|carajo|mierda|puta|maldito|culo|pendejo|estupido|imbecil|idiota|basura|asco|desastre|falso|robo|corrupto|inutil|verguenza|odio|detesto|desesperado|hartado|harto|jodido|hijueputa|malparido|careverga|marica|maricon|puto|pedo|caca|verga|torpe)'
    ) THEN 'NEGATIVO'
    ELSE 'NEUTRO'
  END,
  confianza = CASE
    WHEN EXISTS (
      SELECT 1 FROM comentarios c
      WHERE c.id = a.comentario_id
        AND lower(c.contenido) ~ '(excelente|bueno|buen|buenas|genial|increible|perfecto|agradecido|agradecida|gracias|feliz|satisfecho|satisfecha|recomiendo|me gusta|maravilloso|fantastico|rapido|eficiente|calidad|profesional|amable|resolvio|ayuda|mejor|bien|ok|servicio bueno|todo bien|funciona bien)'
    ) THEN 0.80
    WHEN EXISTS (
      SELECT 1 FROM comentarios c
      WHERE c.id = a.comentario_id
        AND lower(c.contenido) ~ '(malo|mala|terrible|pesimo|horrible|lento|lenta|error|problema|queja|reclamo|insatisfecho|decepcionado|no funciona|no sirve|muy lento|deficiente|lamentable|estafa|fraude|furioso|molesto|incumplimiento|carajo|mierda|puta|maldito|culo|pendejo|estupido|imbecil|idiota|basura|asco|desastre|falso|robo|corrupto|inutil|verguenza|odio|detesto|desesperado|hartado|harto|jodido|hijueputa|malparido|careverga|marica|maricon|puto|pedo|caca|verga|torpe)'
    ) THEN 0.65
    ELSE 0.50
  END;

-- 6. INSERTAR analisis_nlp para comentarios que NO tengan uno
INSERT INTO analisis_nlp (comentario_id, idioma, categoria_detectada, confianza, sentimiento, fecha_analisis, cantidad_palabras)
SELECT
  c.id,
  'es',
  CASE
    WHEN lower(c.contenido) ~ '(excelente|bueno|buen|buenas|genial|increible|perfecto|agradecido|agradecida|gracias|feliz|satisfecho|satisfecha|recomiendo|me gusta|maravilloso|fantastico|rapido|eficiente|calidad|profesional|amable|resolvio|ayuda|mejor|bien|ok|servicio bueno|todo bien|funciona bien)' THEN 'POSITIVO'
    WHEN lower(c.contenido) ~ '(malo|mala|terrible|pesimo|horrible|lento|lenta|error|problema|queja|reclamo|insatisfecho|decepcionado|no funciona|no sirve|muy lento|deficiente|lamentable|estafa|fraude|furioso|molesto|incumplimiento|carajo|mierda|puta|maldito|culo|pendejo|estupido|imbecil|idiota|basura|asco|desastre|falso|robo|corrupto|inutil|verguenza|odio|detesto|desesperado|hartado|harto|jodido|hijueputa|malparido|careverga|marica|maricon|puto|pedo|caca|verga|torpe)' THEN 'NEGATIVO'
    ELSE 'NEUTRO'
  END,
  CASE
    WHEN lower(c.contenido) ~ '(excelente|bueno|buen|buenas|genial|increible|perfecto|agradecido|gracias|feliz|satisfecho|recomiendo|maravilloso|fantastico|rapido|eficiente|calidad|profesional|amable|ayuda|mejor|bien)' THEN 0.80
    WHEN lower(c.contenido) ~ '(malo|mala|terrible|pesimo|horrible|error|problema|queja|reclamo|insatisfecho|no funciona|deficiente|estafa|mierda|puta|basura|asco)' THEN 0.65
    ELSE 0.50
  END,
  CASE
    WHEN lower(c.contenido) ~ '(excelente|bueno|buen|buenas|genial|increible|perfecto|agradecido|gracias|feliz|satisfecho|recomiendo|maravilloso|fantastico|rapido|eficiente|calidad|profesional|amable|ayuda|mejor|bien)' THEN 'positivo'
    WHEN lower(c.contenido) ~ '(malo|mala|terrible|pesimo|horrible|error|problema|queja|reclamo|insatisfecho|no funciona|deficiente|estafa|mierda|puta|basura|asco)' THEN 'negativo'
    ELSE 'neutro'
  END,
  NOW(),
  array_length(string_to_array(lower(c.contenido), ' '), 1)
FROM comentarios c
LEFT JOIN analisis_nlp a ON a.comentario_id = c.id
WHERE a.id IS NULL;

-- 7. ACTUALIZAR categoria en comentarios desde analisis_nlp
UPDATE comentarios c
SET categoria = a.categoria_detectada
FROM analisis_nlp a
WHERE c.id = a.comentario_id;

-- 8. VERIFICAR
SELECT 'CATEGORIAS' as tabla, COUNT(*) as total FROM categorias
UNION ALL
SELECT 'ANALISIS_NLP', COUNT(*) FROM analisis_nlp
UNION ALL
SELECT 'CON_CATEGORIA', COUNT(*) FROM comentarios WHERE categoria IS NOT NULL;

SELECT a.categoria_detectada, a.sentimiento, COUNT(*) as total
FROM analisis_nlp a
GROUP BY a.categoria_detectada, a.sentimiento
ORDER BY total DESC;
