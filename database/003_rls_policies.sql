-- ============================================================
-- NEXUS Corp · Centro Inteligente
-- Script de Permisos y Acceso Total para Supabase (RLS FIX)
-- ============================================================

-- 1. Desactivar RLS o aplicar políticas permisivas en todas las tablas
ALTER TABLE IF EXISTS usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comentarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS analisis_nlp DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tiempos_atencion DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS metricas_estadisticas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS optimizaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auditoria DISABLE ROW LEVEL SECURITY;

-- 2. Otorgar permisos GRANT completos al rol anon y authenticated
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Políticas universales por si se activa RLS en el futuro
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%s_unrestricted_policy" ON %I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_unrestricted_policy" ON %I FOR ALL TO public USING (true) WITH CHECK (true);', tbl, tbl);
    END LOOP;
END $$;

