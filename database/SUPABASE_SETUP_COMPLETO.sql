-- ============================================================
-- NEXUS Corp · Centro Inteligente de Analisis Empresarial
-- SCRIPT COMPLETO DE BASE DE DATOS PARA SUPABASE
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================
-- IMPORTANTE: Ejecutar TODO este script de una sola vez
-- ============================================================

-- ============================================================
-- PARTE 1: LIMPIEZA PREVIA (opcional - ejecutar si hay tablas viejas)
-- ============================================================
-- Descomentar si necesitas empezar desde cero:
-- DROP TABLE IF EXISTS notificaciones CASCADE;
-- DROP TABLE IF EXISTS historial_clientes CASCADE;
-- DROP TABLE IF EXISTS rostros CASCADE;
-- DROP TABLE IF EXISTS analisis_nlp CASCADE;
-- DROP TABLE IF EXISTS tiempos_atencion CASCADE;
-- DROP TABLE IF EXISTS metricas_estadisticas CASCADE;
-- DROP TABLE IF EXISTS optimizaciones CASCADE;
-- DROP TABLE IF EXISTS auditoria CASCADE;
-- DROP TABLE IF EXISTS comentarios CASCADE;
-- DROP TABLE IF EXISTS categorias CASCADE;
-- DROP TABLE IF EXISTS clientes CASCADE;
-- DROP TABLE IF EXISTS usuarios CASCADE;

-- ============================================================
-- PARTE 2: TABLAS PRINCIPALES
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
    email VARCHAR(200) UNIQUE,
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
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    contenido TEXT NOT NULL,
    tipo VARCHAR(20) DEFAULT 'comentario',
    canal VARCHAR(30) DEFAULT 'web',
    estado VARCHAR(30) DEFAULT 'pendiente',
    categoria VARCHAR(50),
    prioridad TEXT DEFAULT 'media',
    respuesta TEXT,
    respuesta_admin_id BIGINT REFERENCES usuarios(id),
    respuesta_fecha TIMESTAMPTZ,
    asignado_a BIGINT REFERENCES usuarios(id),
    visto BOOLEAN DEFAULT false,
    visto_fecha TIMESTAMPTZ,
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

-- 8. OPTIMIZACIONES
CREATE TABLE IF NOT EXISTS optimizaciones (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    estado VARCHAR(30) DEFAULT 'pendiente',
    resultado JSONB,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. AUDITORIA
CREATE TABLE IF NOT EXISTS auditoria (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    usuario_email VARCHAR(200),
    accion TEXT NOT NULL,
    tabla VARCHAR(100),
    registro_id BIGINT,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip VARCHAR(45),
    ip_address INET,
    detalle TEXT,
    entidad TEXT,
    entidad_id BIGINT,
    detalles JSONB,
    modulo VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ROSTROS (Reconocimiento Facial)
CREATE TABLE IF NOT EXISTS rostros (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    embedding_frontal JSONB,
    embedding_izquierda JSONB,
    embedding_derecha JSONB,
    foto_preview TEXT,
    embedding JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. SATISFACCION
CREATE TABLE IF NOT EXISTS satisfaccion (
    id BIGSERIAL PRIMARY KEY,
    comentario_id BIGINT REFERENCES comentarios(id) ON DELETE CASCADE,
    usuario_id BIGINT REFERENCES usuarios(id),
    calificacion INT CHECK (calificacion BETWEEN 1 AND 5),
    comentario TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. HISTORIAL DE ESTADOS
CREATE TABLE IF NOT EXISTS historial_estados (
    id BIGSERIAL PRIMARY KEY,
    comentario_id BIGINT REFERENCES comentarios(id) ON DELETE CASCADE,
    estado VARCHAR(20) NOT NULL,
    cambiado_por BIGINT REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. FAQ
CREATE TABLE IF NOT EXISTS faq (
    id BIGSERIAL PRIMARY KEY,
    pregunta TEXT NOT NULL,
    respuesta TEXT NOT NULL,
    categoria TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. NOTIFICACIONES
CREATE TABLE IF NOT EXISTS notificaciones (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(30) DEFAULT 'sistema',
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    enlace VARCHAR(200),
    leida BOOLEAN DEFAULT false,
    usuario_email VARCHAR(200),
    destinatario VARCHAR(200),
    eliminada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. HISTORIAL CLIENTES
CREATE TABLE IF NOT EXISTS historial_clientes (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(200),
    telefono VARCHAR(50),
    empresa VARCHAR(200),
    accion VARCHAR(50) NOT NULL,
    fecha TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PARTE 3: INDICES PARA RENDIMIENTO
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);
CREATE INDEX IF NOT EXISTS idx_comentarios_cliente ON comentarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_estado ON comentarios(estado);
CREATE INDEX IF NOT EXISTS idx_comentarios_fecha ON comentarios(fecha);
CREATE INDEX IF NOT EXISTS idx_comentarios_tipo ON comentarios(tipo);
CREATE INDEX IF NOT EXISTS idx_analisis_comentario ON analisis_nlp(comentario_id);
CREATE INDEX IF NOT EXISTS idx_tiempos_cliente ON tiempos_atencion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tiempos_fecha ON tiempos_atencion(fecha);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(created_at);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_rostros_usuario ON rostros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_rostros_created ON rostros(created_at);
CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatario ON notificaciones(destinatario);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_historial_clientes_usuario ON historial_clientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_historial_clientes_fecha ON historial_clientes(fecha);

-- ============================================================
-- PARTE 4: FUNCIONES Y TRIGGERS
-- ============================================================

-- Funcion para actualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rostros_updated_at ON rostros;
CREATE TRIGGER update_rostros_updated_at BEFORE UPDATE ON rostros
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PARTE 5: sincronizacion auth.users <-> usuarios
-- ============================================================

-- Funcion para crear perfil al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, nombre, email, password_hash, rol, activo)
  VALUES (
    NEW.id::bigint,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    NEW.email,
    'auth_managed',
    COALESCE(NEW.raw_user_meta_data->>'rol', 'USUARIO'),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Funcion para sincronizar cambios de email
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE public.usuarios
    SET email = NEW.email, updated_at = NOW()
    WHERE id = NEW.id::bigint;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para sincronizar actualizaciones
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Funcion para eliminar perfil cuando se elimina usuario
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.usuarios WHERE id = OLD.id::bigint;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para eliminar perfil
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- ============================================================
-- PARTE 6: DESHABILITAR RLS (configuracion actual)
-- ============================================================

ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE categorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE analisis_nlp DISABLE ROW LEVEL SECURITY;
ALTER TABLE tiempos_atencion DISABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_estadisticas DISABLE ROW LEVEL SECURITY;
ALTER TABLE optimizaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria DISABLE ROW LEVEL SECURITY;
ALTER TABLE rostros DISABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaccion DISABLE ROW LEVEL SECURITY;
ALTER TABLE historial_estados DISABLE ROW LEVEL SECURITY;
ALTER TABLE faq DISABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE historial_clientes DISABLE ROW LEVEL SECURITY;

-- Otorgar permisos
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================
-- PARTE 7: HABILITAR REALTIME
-- ============================================================

-- Verificar si las tablas ya estan en la publicacion
DO $$
BEGIN
    -- Agregar tablas a realtime si no estan
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'comentarios') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE comentarios;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'clientes') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE clientes;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tiempos_atencion') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE tiempos_atencion;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'analisis_nlp') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE analisis_nlp;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'categorias') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE categorias;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'usuarios') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'rostros') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE rostros;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notificaciones') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;
    END IF;
END $$;

-- ============================================================
-- PARTE 8: DATOS INICIALES
-- ============================================================

-- Categorias por defecto
INSERT INTO categorias (nombre, descripcion, activo) VALUES
    ('SOPORTE TECNICO', 'Problemas tecnicos, errores, fallas del sistema', true),
    ('FACTURACION', 'Consultas sobre cobros, pagos, facturas', true),
    ('SERVICIO AL CLIENTE', 'Atencion general, quejas, sugerencias', true),
    ('VENTAS', 'Consultas sobre productos, precios, disponibilidad', true),
    ('DEVOLUCIONES', 'Solicitudes de devolucion o cambio de productos', true),
    ('ENTREGAS', 'Estado de envios, tiempos de entrega', true),
    ('GARANTIA', 'Reclamaciones de garantia de productos', true),
    ('SUGERENCIA', 'Ideas y mejoras propuestas por clientes', true),
    ('CONSULTAS GENERALES', 'Preguntas generales sobre productos o servicios', true),
    ('FEEDBACK', 'Comentarios y retroalimentacion de clientes', true),
    ('EMERGENCIA', 'Situaciones criticas que requieren atencion inmediata', true)
ON CONFLICT (nombre) DO NOTHING;

-- Clientes de ejemplo
INSERT INTO clientes (nombre, email, telefono, empresa, activo) VALUES
    ('Carlos Mendoza', 'carlos.mendoza@techcorp.com', '999111222', 'TechCorp Solutions', true),
    ('Maria Garcia', 'maria.garcia@innovaweb.com', '999222333', 'InnovaWeb SAC', true),
    ('Juan Rodriguez', 'juan.rodriguez@datapro.com', '999333444', 'DataPro Analytics', true),
    ('Ana Lopez', 'ana.lopez@cloudsys.com', '999444555', 'CloudSys Peru', true),
    ('Pedro Martinez', 'pedro.martinez@fintech.com', '999555666', 'FinTech Global', true),
    ('Laura Sanchez', 'laura.sanchez@digital.co', '999666777', 'Digital Marketing Co', true),
    ('Roberto Flores', 'roberto.flores@redes.com', '999777888', 'Redes y Telecom', true),
    ('Sofia Torres', 'sofia.torres@ecoenergy.com', '999888999', 'EcoEnergy Solutions', true),
    ('Diego Ramirez', 'diego.ramirez@medtech.com', '999000111', 'MedTech Salud', true),
    ('Camila Vargas', 'camila.vargas@eduonline.com', '999111000', 'EduOnline Academy', true)
ON CONFLICT (email) DO NOTHING;

-- FAQ de ejemplo
INSERT INTO faq (pregunta, respuesta, categoria) VALUES
    ('Como creo una solicitud?', 'Dirigete a la seccion de Solicitudes y presiona el boton "Nueva Solicitud". Escribe tu consulta y presiona Enviar.', 'Solicitudes'),
    ('Puedo cambiar el estado de mi solicitud?', 'No, solo el administrador puede cambiar el estado. Tu podras ver el progreso en tiempo real.', 'Solicitudes'),
    ('Como contacto soporte?', 'Puedes crear una solicitud o comentario desde el menu Atencion. Nuestro equipo te respondera lo antes posible.', 'Soporte'),
    ('Que es el analisis NLP?', 'Es un sistema inteligente que analiza automaticamente tus comentarios para detectar la categoria y sentimiento de tu consulta.', 'Plataforma'),
    ('Como veo mis notificaciones?', 'Haz clic en la campanita en la esquina superior derecha. Ahi veras todas tus notificaciones personalizadas.', 'Plataforma')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PARTE 9: VERIFICACION FINAL
-- ============================================================

-- Listar todas las tablas creadas
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Contar registros en tablas principales
SELECT 'usuarios' as tabla, COUNT(*) as registros FROM usuarios
UNION ALL
SELECT 'clientes', COUNT(*) FROM clientes
UNION ALL
SELECT 'comentarios', COUNT(*) FROM comentarios
UNION ALL
SELECT 'categorias', COUNT(*) FROM categorias
UNION ALL
SELECT 'analisis_nlp', COUNT(*) FROM analisis_nlp
UNION ALL
SELECT 'tiempos_atencion', COUNT(*) FROM tiempos_atencion
UNION ALL
SELECT 'rostros', COUNT(*) FROM rostros
UNION ALL
SELECT 'faq', COUNT(*) FROM faq
UNION ALL
SELECT 'notificaciones', COUNT(*) FROM notificaciones
UNION ALL
SELECT 'historial_clientes', COUNT(*) FROM historial_clientes;

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
