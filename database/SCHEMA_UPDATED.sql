-- ============================================================
-- NEXUS Corp · Schema actualizado - Sincronizado con Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'USUARIO',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(200),
    telefono VARCHAR(50),
    empresa VARCHAR(200),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CATEGORIAS
CREATE TABLE IF NOT EXISTS categorias (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. COMENTARIOS
CREATE TABLE IF NOT EXISTS comentarios (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
    contenido TEXT NOT NULL,
    canal VARCHAR(30) DEFAULT 'web',
    estado VARCHAR(30) DEFAULT 'pendiente',
    categoria VARCHAR(50),
    fecha TIMESTAMPTZ DEFAULT NOW(),
    procesado BOOLEAN DEFAULT FALSE
);

-- 5. ANALISIS NLP
CREATE TABLE IF NOT EXISTS analisis_nlp (
    id BIGSERIAL PRIMARY KEY,
    comentario_id BIGINT NOT NULL REFERENCES comentarios(id) ON DELETE CASCADE,
    idioma VARCHAR(20) DEFAULT 'es',
    cantidad_palabras INTEGER DEFAULT 0,
    palabras_limpias JSONB,
    palabras_frecuentes JSONB,
    categoria_detectada VARCHAR(100),
    confianza NUMERIC(5,4),
    fecha_analisis TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TIEMPOS DE ATENCION
CREATE TABLE IF NOT EXISTS tiempos_atencion (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
    comentario_id BIGINT REFERENCES comentarios(id) ON DELETE SET NULL,
    tiempo_minutos NUMERIC(10,2) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    operador VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. METRICAS ESTADISTICAS
CREATE TABLE IF NOT EXISTS metricas_estadisticas (
    id BIGSERIAL PRIMARY KEY,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    total_comentarios INTEGER DEFAULT 0,
    comentarios_positivos INTEGER DEFAULT 0,
    comentarios_negativos INTEGER DEFAULT 0,
    comentarios_neutros INTEGER DEFAULT 0,
    tiempo_promedio_atencion NUMERIC(10,2) DEFAULT 0,
    satisfaccion_promedio NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. AUDITORIA
CREATE TABLE IF NOT EXISTS auditoria (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    tabla VARCHAR(100),
    registro_id BIGINT,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. OPTIMIZACIONES
CREATE TABLE IF NOT EXISTS optimizaciones (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(30) DEFAULT 'pendiente',
    resultado JSONB,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ROSTROS (Reconocimiento Facial)
CREATE TABLE IF NOT EXISTS rostros (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    embedding JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_rostros_usuario ON rostros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_rostros_created ON rostros(created_at);

-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CATEGORIAS POR DEFECTO
-- ============================================================

INSERT INTO categorias (nombre, descripcion, activo) VALUES
    ('SOPORTE TECNICO', 'Problemas tecnicos, errores, fallas del sistema', true),
    ('FACTURACION', 'Consultas sobre cobros, pagos, facturas', true),
    ('SERVICIO AL CLIENTE', 'Atencion general, quejas, sugerencias', true),
    ('VENTAS', 'Consultas sobre productos, precios, disponibilidad', true),
    ('DEVOLUCIONES', 'Solicitudes de devolucion o cambio de productos', true),
    ('ENTREGAS', 'Estado de envios, tiempos de entrega', true),
    ('GARANTIA', 'Reclamaciones de garantia de productos', true),
    ('SUGERENCIA', 'Ideas y mejoras propuestas por clientes', true),
    ('FACTURAS Y COBROS', 'Consultas especificas sobre facturas y cobros', true),
    ('INSTALACION Y CONFIGURACION', 'Ayuda con instalacion o configuracion de productos', true),
    ('CAMBIOS Y DEVOLUCIONES', 'Solicitudes de cambio o devolucion', true),
    ('RECLAMOS', 'Reclamos formales de clientes', true),
    ('CONSULTAS GENERALES', 'Preguntas generales sobre productos o servicios', true),
    ('FEEDBACK', 'Comentarios y retroalimentacion de clientes', true),
    ('EMERGENCIA', 'Situaciones criticas que requieren atencion inmediata', true)
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- DESHABILITAR RLS
-- ============================================================

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

-- ============================================================
-- HABILITAR REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE comentarios;
ALTER PUBLICATION supabase_realtime ADD TABLE clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE tiempos_atencion;
ALTER PUBLICATION supabase_realtime ADD TABLE analisis_nlp;
ALTER PUBLICATION supabase_realtime ADD TABLE categorias;
ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;
ALTER PUBLICATION supabase_realtime ADD TABLE rostros;
