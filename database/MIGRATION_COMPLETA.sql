-- =====================================================
-- MIGRACIÓN COMPLETA: BADI Corp
-- Ejecutar en Supabase SQL Editor en orden
-- =====================================================

-- 1. UNIQUE constraint en email (corrige el INSERT que falla)
ALTER TABLE clientes ADD CONSTRAINT IF NOT EXISTS clientes_email_unique UNIQUE (email);

-- 2. Columnas nuevas en comentarios/solicitudes
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'comentario';
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS usuario_id BIGINT REFERENCES usuarios(id);
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS prioridad TEXT DEFAULT 'media';
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS respuesta TEXT;
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS respuesta_admin_id BIGINT REFERENCES usuarios(id);
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS respuesta_fecha TIMESTAMPTZ;
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS asignado_a BIGINT REFERENCES usuarios(id);
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS visto BOOLEAN DEFAULT false;
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS visto_fecha TIMESTAMPTZ;

-- 3. Tabla de satisfacción
CREATE TABLE IF NOT EXISTS satisfaccion (
  id BIGSERIAL PRIMARY KEY,
  comentario_id BIGINT REFERENCES comentarios(id) ON DELETE CASCADE,
  usuario_id BIGINT REFERENCES usuarios(id),
  calificacion INT CHECK (calificacion BETWEEN 1 AND 5),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de historial de estados (timeline)
CREATE TABLE IF NOT EXISTS historial_estados (
  id BIGSERIAL PRIMARY KEY,
  comentario_id BIGINT REFERENCES comentarios(id) ON DELETE CASCADE,
  estado VARCHAR(20) NOT NULL,
  cambiado_por BIGINT REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de auditoría
CREATE TABLE IF NOT EXISTS auditoria (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  detalle TEXT,
  entidad TEXT,
  entidad_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabla de FAQ
CREATE TABLE IF NOT EXISTS faq (
  id BIGSERIAL PRIMARY KEY,
  pregunta TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  categoria TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Migrar solicitudes existentes
UPDATE comentarios SET tipo = 'solicitud' WHERE estado IN ('pendiente', 'en_proceso', 'resuelto') AND tipo = 'comentario';

-- 8. Insertar clientes de ejemplo (sin ON CONFLICT ahora que hay UNIQUE)
INSERT INTO clientes (nombre, email, telefono, empresa, activo, created_at) VALUES
('Carlos Mendoza', 'carlos.mendoza@techcorp.com', '999111222', 'TechCorp Solutions', true, NOW()),
('Maria Garcia', 'maria.garcia@innovaweb.com', '999222333', 'InnovaWeb SAC', true, NOW()),
('Juan Rodriguez', 'juan.rodriguez@datapro.com', '999333444', 'DataPro Analytics', true, NOW()),
('Ana Lopez', 'ana.lopez@cloudsys.com', '999444555', 'CloudSys Peru', true, NOW()),
('Pedro Martinez', 'pedro.martinez@fintech.com', '999555666', 'FinTech Global', true, NOW()),
('Laura Sanchez', 'laura.sanchez@digital.co', '999666777', 'Digital Marketing Co', true, NOW()),
('Roberto Flores', 'roberto.flores@redes.com', '999777888', 'Redes y Telecom', true, NOW()),
('Sofia Torres', 'sofia.torres@ecoenergy.com', '999888999', 'EcoEnergy Solutions', true, NOW()),
('Diego Ramirez', 'diego.ramirez@medtech.com', '999000111', 'MedTech Salud', true, NOW()),
('Camila Vargas', 'camila.vargas@eduonline.com', '999111000', 'EduOnline Academy', true, NOW())
ON CONFLICT (email) DO NOTHING;

-- 9. Insertar FAQ de ejemplo
INSERT INTO faq (pregunta, respuesta, categoria) VALUES
('Como creo una solicitud?', 'Dirigete a la seccion de Solicitudes y presiona el boton "Nueva Solicitud". Escribe tu consulta y presiona Enviar.', 'Solicitudes'),
('Puedo cambiar el estado de mi solicitud?', 'No, solo el administrador puede cambiar el estado. Tu podras ver el progreso en tiempo real.', 'Solicitudes'),
('Como contacto soporte?', 'Puedes crear una solicitud o comentario desde el menu Atencion. Nuestro equipo te respondera lo antes posible.', 'Soporte'),
('Que es el analisis NLP?', 'Es un sistema inteligente que analiza automaticamente tus comentarios para detectar la categoria y sentimiento de tu consulta.', 'Plataforma'),
('Como veo mis notificaciones?', 'Haz clic en la campanita en la esquina superior derecha. Ahi veras todas tus notificaciones personalizadas.', 'Plataforma')
ON CONFLICT DO NOTHING;

-- 10. RLS para satisfaccion
ALTER TABLE satisfaccion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ven su satisfaccion" ON satisfaccion FOR SELECT USING (auth.uid()::text = usuario_id::text);
CREATE POLICY "Usuarios insertan su satisfaccion" ON satisfaccion FOR INSERT WITH CHECK (auth.uid()::text = usuario_id::text);
CREATE POLICY "Admin gestiona satisfaccion" ON satisfaccion FOR ALL USING (EXISTS (SELECT 1 FROM usuarios WHERE id::text = auth.uid()::text AND rol = 'admin'));

-- 11. RLS para historial_estados
ALTER TABLE historial_estados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos ven historial" ON historial_estados FOR SELECT USING (true);
CREATE POLICY "Admin inserta historial" ON historial_estados FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id::text = auth.uid()::text AND rol = 'admin'));

-- 12. RLS para auditoria (solo admin)
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin ve auditoria" ON auditoria FOR SELECT USING (EXISTS (SELECT 1 FROM usuarios WHERE id::text = auth.uid()::text AND rol = 'admin'));
CREATE POLICY "Admin inserta auditoria" ON auditoria FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id::text = auth.uid()::text AND rol = 'admin'));

-- 13. RLS para faq
ALTER TABLE faq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos ven faq" ON faq FOR SELECT USING (activo = true);
CREATE POLICY "Admin gestiona faq" ON faq FOR ALL USING (EXISTS (SELECT 1 FROM usuarios WHERE id::text = auth.uid()::text AND rol = 'admin'));
