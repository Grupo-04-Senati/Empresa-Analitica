-- ============================================================
-- LIMPIEZA COMPLETA DE TABLAS
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================
-- Esto eliminará TODOS los datos pero mantendrá la estructura
-- ============================================================

-- Deshabilitar triggers temporalmente para limpieza rápida
SET session_replication_role = 'replica';

-- Limpiar todas las tablas en orden correcto (respetando foreign keys)
DELETE FROM notificaciones;
DELETE FROM historial_clientes;
DELETE FROM faq;
DELETE FROM historial_estados;
DELETE FROM satisfaccion;
DELETE FROM rostros;
DELETE FROM analisis_nlp;
DELETE FROM tiempos_atencion;
DELETE FROM auditoria;
DELETE FROM optimizaciones;
DELETE FROM metricas_estadisticas;
DELETE FROM comentarios;
DELETE FROM categorias;
DELETE FROM clientes;
DELETE FROM usuarios;

-- Resetear secuencias a 1 (solo si existen)
DO $$
DECLARE
    seq RECORD;
BEGIN
    FOR seq IN 
        SELECT sequencename 
        FROM pg_sequences 
        WHERE schemaname = 'public' 
        AND sequencename LIKE '%_id_seq'
    LOOP
        EXECUTE format('ALTER SEQUENCE %I RESTART WITH 1', seq.sequencename);
    END LOOP;
END $$;

-- Rehabilitar triggers
SET session_replication_role = 'origin';

-- ============================================================
-- VERIFICACION
-- ============================================================
SELECT 
    schemaname,
    relname as tablename,
    n_live_tup as registros
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;

-- ============================================================
-- FIN - Todas las tablas están vacías y listas para usar
-- ============================================================
