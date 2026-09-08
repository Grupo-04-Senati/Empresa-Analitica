-- ============================================================
-- NEXUS Corp · Centro Inteligente
-- Migracion 001: Schema completo
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'usuario',
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
    cantidad_registros INTEGER NOT NULL,
    media NUMERIC(12,4),
    mediana NUMERIC(12,4),
    desviacion_estandar NUMERIC(12,4),
    minimo NUMERIC(12,4),
    maximo NUMERIC(12,4),
    percentil_25 NUMERIC(12,4),
    percentil_75 NUMERIC(12,4),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. OPTIMIZACIONES
CREATE TABLE IF NOT EXISTS optimizaciones (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    parametros_entrada JSONB NOT NULL,
    resultado JSONB,
    costo_inicial NUMERIC(14,4),
    costo_optimizado NUMERIC(14,4),
    estado VARCHAR(30) DEFAULT 'pendiente',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. AUDITORIA
CREATE TABLE IF NOT EXISTS auditoria (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    tabla VARCHAR(100),
    registro_id BIGINT,
    detalles JSONB,
    ip VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. NOTIFICACIONES
CREATE TABLE IF NOT EXISTS notificaciones (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    tipo VARCHAR(30) DEFAULT 'info',
    leida BOOLEAN DEFAULT FALSE,
    accion_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. SERVICIOS
CREATE TABLE IF NOT EXISTS servicios (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    keywords JSONB,
    categoria VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);
CREATE INDEX IF NOT EXISTS idx_comentarios_cliente ON comentarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_estado ON comentarios(estado);
CREATE INDEX IF NOT EXISTS idx_comentarios_fecha ON comentarios(fecha);
CREATE INDEX IF NOT EXISTS idx_analisis_comentario ON analisis_nlp(comentario_id);
CREATE INDEX IF NOT EXISTS idx_tiempos_cliente ON tiempos_atencion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tiempos_fecha ON tiempos_atencion(fecha);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(created_at);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_servicios_categoria ON servicios(categoria);
