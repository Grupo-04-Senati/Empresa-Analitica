-- ============================================================
-- NEXUS Corp · Configuración de Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. HABILITAR REALTIME en tablas necesarias
ALTER PUBLICATION supabase_realtime ADD TABLE comentarios;
ALTER PUBLICATION supabase_realtime ADD TABLE clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE tiempos_atencion;
ALTER PUBLICATION supabase_realtime ADD TABLE analisis_nlp;
ALTER PUBLICATION supabase_realtime ADD TABLE categorias;
ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;
ALTER PUBLICATION supabase_realtime ADD TABLE rostros;

-- 2. DESHABILITAR RLS (ya confirmado por el usuario)
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE categorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE analisis_nlp DISABLE ROW LEVEL SECURITY;
ALTER TABLE tiempos_atencion DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria DISABLE ROW LEVEL SECURITY;
ALTER TABLE optimizaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_estadisticas DISABLE ROW LEVEL SECURITY;
ALTER TABLE rostros DISABLE ROW LEVEL SECURITY;

-- 3. CREAR FUNCIÓN para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. TRIGGERS para updated_at
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rostros_updated_at BEFORE UPDATE ON rostros
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. INSERTAR CATEGORÍAS POR DEFECTO (si la tabla está vacía)
INSERT INTO categorias (nombre, descripcion, activo) VALUES
    ('SOPORTE TÉCNICO', 'Problemas técnicos, errores, fallas del sistema', true),
    ('FACTURACIÓN', 'Consultas sobre cobros, pagos, facturas', true),
    ('SERVICIO AL CLIENTE', 'Atención general, quejas, sugerencias', true),
    ('VENTAS', 'Consultas sobre productos, precios, disponibilidad', true),
    ('DEVOLUCIONES', 'Solicitudes de devolución o cambio de productos', true),
    ('ENTREGAS', 'Estado de envíos, tiempos de entrega', true),
    ('GARANTÍA', 'Reclamaciones de garantía de productos', true),
    ('SUGERENCIA', 'Ideas y mejoras propuestas por clientes', true)
ON CONFLICT (nombre) DO NOTHING;

-- 6. VERIFICAR TABLAS EXISTENTES
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
