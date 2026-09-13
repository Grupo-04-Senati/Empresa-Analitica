-- =====================================================
-- FIX RLS: Deshabilitar RLS en todas las tablas de datos
-- para que el anon key pueda leer sin restricciones
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Deshabilitar RLS en todas las tablas
ALTER TABLE tiempos_atencion DISABLE ROW LEVEL SECURITY;
ALTER TABLE optimizaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE analisis_nlp DISABLE ROW LEVEL SECURITY;
ALTER TABLE categorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaccion DISABLE ROW LEVEL SECURITY;
ALTER TABLE historial_estados DISABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria DISABLE ROW LEVEL SECURITY;
ALTER TABLE faq DISABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes DISABLE ROW LEVEL SECURITY;

-- Verificar que los datos existen
SELECT 'tiempos_atencion' as tabla, COUNT(*) as total FROM tiempos_atencion
UNION ALL
SELECT 'optimizaciones', COUNT(*) FROM optimizaciones
UNION ALL
SELECT 'analisis_nlp', COUNT(*) FROM analisis_nlp
UNION ALL
SELECT 'categorias', COUNT(*) FROM categorias
UNION ALL
SELECT 'comentarios', COUNT(*) FROM comentarios
UNION ALL
SELECT 'faq', COUNT(*) FROM faq;
