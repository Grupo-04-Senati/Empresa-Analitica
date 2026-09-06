-- ============================================================
-- NEXUS Corp · Centro Inteligente
-- Migración: 005 - Realtime y triggers
-- Fecha: 2026-09-01
-- ============================================================

-- 1. HABILITAR REALTIME en tablas necesarias
ALTER PUBLICATION supabase_realtime ADD TABLE comentarios;
ALTER PUBLICATION supabase_realtime ADD TABLE clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE tiempos_atencion;
ALTER PUBLICATION supabase_realtime ADD TABLE analisis_nlp;
ALTER PUBLICATION supabase_realtime ADD TABLE categorias;
ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;

-- 2. CREAR FUNCIÓN para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. TRIGGERS para updated_at
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
