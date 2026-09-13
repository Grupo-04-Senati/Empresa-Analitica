-- ============================================
-- FIX COMPLETO: Categorias ML del Backend
-- Ejecutar TODO en Supabase SQL Editor
-- ============================================

-- 1. Asegurar columna sentimiento en analisis_nlp
ALTER TABLE public.analisis_nlp ADD COLUMN IF NOT EXISTS sentimiento VARCHAR(30) DEFAULT 'neutro';

-- 2. Asegurar columna categoria en comentarios
ALTER TABLE public.comentarios ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT NULL;

-- 3. ELIMINAR todas las categorias viejas
DELETE FROM categorias;

-- 4. INSERTAR las 5 categorias ML del backend
INSERT INTO categorias (nombre, descripcion, activo) VALUES
  ('FELICITACION', 'Felicitaciones, agradecimiento, satisfaccion, recomiendan el servicio', true),
  ('RECLAMO', 'Quejas, reclamos, insatisfaccion, problemas, cancelaciones', true),
  ('SOPORTE', 'Problemas tecnicos, errores, acceso, configuracion, ayuda', true),
  ('VENTAS', 'Facturacion, precios, planes, contratacion, cotizaciones', true),
  ('CONSULTA', 'Consultas generales, informacion, dudas', true);

-- 5. ACTUALizar analisis_nlp segun el CONTENIDO del comentario
-- FELICITACION
UPDATE analisis_nlp a
SET sentimiento = 'positivo',
    categoria_detectada = 'FELICITACION',
    confianza = 0.85
FROM comentarios c
WHERE c.id = a.comentario_id
  AND lower(c.contenido) ~ '(excelente|bueno|buen|buenas|genial|increible|perfecto|agradecido|agradecida|gracias|feliz|satisfecho|satisfecha|recomiendo|me gusta|maravilloso|fantastico|rapido|eficiente|calidad|profesional|amable|resolvio|ayuda|mejor|bien|ok|servicio bueno|todo bien|funciona bien)'
  AND NOT lower(c.contenido) ~ '(malo|mala|terrible|pesimo|horrible|error|problema|queja|reclamo|no funciona|no sirve)';

-- RECLAMO
UPDATE analisis_nlp a
SET sentimiento = 'negativo',
    categoria_detectada = 'RECLAMO',
    confianza = 0.75
FROM comentarios c
WHERE c.id = a.comentario_id
  AND lower(c.contenido) ~ '(malo|mala|terrible|pesimo|horrible|lento|lenta|error|problema|queja|reclamo|insatisfecho|decepcionado|no funciona|no sirve|muy lento|deficiente|lamentable|estafa|fraude|furioso|molesto|incumplimiento|carajo|mierda|puta|basura|asco|desastre|odio)'
  AND NOT lower(c.contenido) ~ '(excelente|bueno|gracias|feliz|satisfecho|recomiendo)';

-- SOPORTE
UPDATE analisis_nlp a
SET sentimiento = 'neutro',
    categoria_detectada = 'SOPORTE',
    confianza = 0.70
FROM comentarios c
WHERE c.id = a.comentario_id
  AND lower(c.contenido) ~ '(sistema|contrasena|clave|acceso|login|pantalla|soporte|tecnico|bug|plataforma|aplicacion|app|cuenta|conexion|configurar|configuracion|ayuda|error|no puedo|no me funciona)';

-- VENTAS
UPDATE analisis_nlp a
SET sentimiento = 'neutro',
    categoria_detectada = 'VENTAS',
    confianza = 0.70
FROM comentarios c
WHERE c.id = a.comentario_id
  AND lower(c.contenido) ~ '(factura|facturacion|precio|precios|costo|comprar|compra|plan|planes|contrato|pagar|pago|descuento|tarifa|cotizacion|presupuesto|ventas)';

-- NEUTRO (todo lo que no matchee arriba)
UPDATE analisis_nlp a
SET sentimiento = 'neutro',
    categoria_detectada = 'CONSULTA',
    confianza = 0.60
FROM comentarios c
WHERE c.id = a.comentario_id
  AND (a.categoria_detectada IS NULL OR a.categoria_detectada = '' OR a.categoria_detectada = 'SUGERENCIA' OR a.categoria_detectada = 'FACTURACION');

-- 6. INSERTAR analisis_nlp para comentarios SIN analisis
INSERT INTO analisis_nlp (comentario_id, idioma, categoria_detectada, confianza, sentimiento, fecha_analisis, cantidad_palabras)
SELECT
  c.id, 'es',
  CASE
    WHEN lower(c.contenido) ~ '(excelente|bueno|buen|buenas|genial|increible|perfecto|agradecido|gracias|feliz|satisfecho|recomiendo|maravilloso|fantastico|rapido|eficiente|calidad|profesional|amable|ayuda|mejor|bien)' THEN 'FELICITACION'
    WHEN lower(c.contenido) ~ '(malo|mala|terrible|pesimo|horrible|error|problema|queja|reclamo|insatisfecho|no funciona|deficiente|estafa|mierda|puta|basura|asco|carajo|horrible)' THEN 'RECLAMO'
    WHEN lower(c.contenido) ~ '(sistema|contrasena|acceso|login|soporte|tecnico|bug|plataforma|app|cuenta|conexion|ayuda|error|no puedo|no me funciona)' THEN 'SOPORTE'
    WHEN lower(c.contenido) ~ '(factura|precio|precios|costo|comprar|plan|planes|contrato|pago|descuento|tarifa|cotizacion|presupuesto)' THEN 'VENTAS'
    ELSE 'CONSULTA'
  END,
  CASE
    WHEN lower(c.contenido) ~ '(excelente|bueno|gracias|feliz|satisfecho|recomiendo)' THEN 0.85
    WHEN lower(c.contenido) ~ '(malo|mala|terrible|pesimo|horrible|error|problema|queja)' THEN 0.75
    WHEN lower(c.contenido) ~ '(sistema|soporte|tecnico|bug|ayuda|precio|factura)' THEN 0.70
    ELSE 0.60
  END,
  CASE
    WHEN lower(c.contenido) ~ '(excelente|bueno|gracias|feliz|satisfecho|recomiendo)' THEN 'positivo'
    WHEN lower(c.contenido) ~ '(malo|mala|terrible|pesimo|horrible|error|problema|queja)' THEN 'negativo'
    ELSE 'neutro'
  END,
  NOW(),
  array_length(string_to_array(lower(c.contenido), ' '), 1)
FROM comentarios c
LEFT JOIN analisis_nlp a ON a.comentario_id = c.id
WHERE a.id IS NULL;

-- 7. ACTUALizar categoria en comentarios
UPDATE comentarios c
SET categoria = a.categoria_detectada
FROM analisis_nlp a
WHERE c.id = a.comentario_id;

-- 8. VERIFICAR
SELECT 'CATEGORIAS' as tabla, COUNT(*) as total FROM categorias
UNION ALL
SELECT 'ANALISIS_NLP', COUNT(*) FROM analisis_nlp
UNION ALL
SELECT 'COMENTARIOS_CON_CAT', COUNT(*) FROM comentarios WHERE categoria IS NOT NULL;

SELECT a.categoria_detectada, a.sentimiento, COUNT(*) as total
FROM analisis_nlp a
GROUP BY a.categoria_detectada, a.sentimiento
ORDER BY total DESC;
