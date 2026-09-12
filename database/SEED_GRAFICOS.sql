-- =====================================================
-- SEED COMPLETO: Todos los graficos
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 0. Asegurar que las tablas existan con las columnas correctas

CREATE TABLE IF NOT EXISTS tiempos_atencion (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT REFERENCES clientes(id),
  tiempo_minutos INT NOT NULL,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  operador TEXT
);

CREATE TABLE IF NOT EXISTS optimizaciones (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  parametros_entrada JSONB DEFAULT '{}',
  resultado JSONB DEFAULT '{}',
  costo_inicial NUMERIC,
  costo_optimizado NUMERIC,
  estado TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Tiempos de atencion (30 registros, ultimos 30 dias)
INSERT INTO tiempos_atencion (cliente_id, tiempo_minutos, fecha, operador) VALUES
(1, 12, NOW() - INTERVAL '29 days', 'Admin Principal'),
(2, 25, NOW() - INTERVAL '28 days', 'Ana Analista'),
(3, 8, NOW() - INTERVAL '27 days', 'Carlos Soporte'),
(4, 35, NOW() - INTERVAL '26 days', 'Admin Principal'),
(5, 15, NOW() - INTERVAL '25 days', 'Ana Analista'),
(1, 22, NOW() - INTERVAL '24 days', 'Carlos Soporte'),
(6, 18, NOW() - INTERVAL '23 days', 'Admin Principal'),
(7, 42, NOW() - INTERVAL '22 days', 'Ana Analista'),
(8, 10, NOW() - INTERVAL '21 days', 'Carlos Soporte'),
(2, 28, NOW() - INTERVAL '20 days', 'Admin Principal'),
(9, 14, NOW() - INTERVAL '19 days', 'Ana Analista'),
(10, 30, NOW() - INTERVAL '18 days', 'Carlos Soporte'),
(3, 7, NOW() - INTERVAL '17 days', 'Admin Principal'),
(4, 20, NOW() - INTERVAL '16 days', 'Ana Analista'),
(5, 38, NOW() - INTERVAL '15 days', 'Carlos Soporte'),
(1, 11, NOW() - INTERVAL '14 days', 'Admin Principal'),
(6, 24, NOW() - INTERVAL '13 days', 'Ana Analista'),
(7, 16, NOW() - INTERVAL '12 days', 'Carlos Soporte'),
(8, 33, NOW() - INTERVAL '11 days', 'Admin Principal'),
(9, 9, NOW() - INTERVAL '10 days', 'Ana Analista'),
(10, 27, NOW() - INTERVAL '9 days', 'Carlos Soporte'),
(2, 19, NOW() - INTERVAL '8 days', 'Admin Principal'),
(3, 45, NOW() - INTERVAL '7 days', 'Ana Analista'),
(4, 13, NOW() - INTERVAL '6 days', 'Carlos Soporte'),
(5, 21, NOW() - INTERVAL '5 days', 'Admin Principal'),
(6, 31, NOW() - INTERVAL '4 days', 'Ana Analista'),
(7, 6, NOW() - INTERVAL '3 days', 'Carlos Soporte'),
(8, 26, NOW() - INTERVAL '2 days', 'Admin Principal'),
(9, 17, NOW() - INTERVAL '1 day', 'Ana Analista'),
(10, 23, NOW(), 'Carlos Soporte');

-- 2. Optimizaciones (5 registros)
INSERT INTO optimizaciones (usuario_id, nombre, descripcion, parametros_entrada, resultado, costo_inicial, costo_optimizado, estado, created_at) VALUES
(1, 'Reduccion Tiempo Respuesta', 'Reduccion del tiempo de respuesta promedio de 25 a 15 minutos mediante automatizacion de respuestas frecuentes', '{"metodo":"automatizacion","umbral":"25min"}', '{"tiempo_antes":25,"tiempo_despues":15,"mejora":"40%"}', 5000, 3200, 'completada', NOW() - INTERVAL '25 days'),
(1, 'Categorias Automaticas NLP', 'Implementacion de categorias automaticas NLP para clasificar comentarios sin intervencion manual', '{"modelo":"NLP_v2","categorias":5}', '{"precision":0.87,"recall":0.82,"f1":0.84}', 8000, 8000, 'completada', NOW() - INTERVAL '18 days'),
(1, 'Indices Base de Datos', 'Optimizacion de base de datos: indices en tablas de comentarios y analisis_nlp para consultas mas rapidas', '{"tablas":["comentarios","analisis_nlp"]}', '{"tiempoconsulta_antes":"450ms","tiempoconsulta_despues":"120ms"}', 2000, 1500, 'en_proceso', NOW() - INTERVAL '10 days'),
(1, 'Dashboard Metricas Realtime', 'Dashboard de metricas en tiempo real con alertas automaticas cuando el tiempo de respuesta supera el SLA', '{"sla":"30min","alertas":true}', '{}', 6000, 0, 'en_proceso', NOW() - INTERVAL '5 days'),
(1, 'Notificaciones Push', 'Sistema de notificaciones push para clientes cuando su solicitud cambia de estado', '{"canales":["email","web","push"]}', '{}', 4000, 0, 'pendiente', NOW() - INTERVAL '2 days');

-- 3. Categorias NLP (si vacias)
INSERT INTO categorias (nombre, descripcion, activo) VALUES
('SOPORTE', 'Problemas tecnicos, fallas y solicitudes de ayuda', true),
('VENTAS', 'Consultas sobre productos, precios y compras', true),
('RECLAMO', 'Quejas, insatisfaccion y problemas con el servicio', true),
('CONSULTA', 'Preguntas generales e informacion', true),
('FELICITACION', 'Comentarios positivos y feedback favorable', true)
ON CONFLICT DO NOTHING;

-- 4. Analisis NLP (15 registros)
INSERT INTO analisis_nlp (comentario_id, idioma, cantidad_palabras, palabras_limpias, palabras_frecuentes, categoria_detectada, confianza, fecha_analisis) VALUES
(1, 'es', 12, '["servicio","rapido","excelente","atencion","calidad"]', '["rapido","servicio","excelente"]', 'FELICITACION', 0.89, NOW() - INTERVAL '28 days'),
(2, 'es', 8, '["problema","conexion","internet","falla","lento"]', '["problema","conexion","falla"]', 'SOPORTE', 0.82, NOW() - INTERVAL '27 days'),
(3, 'es', 15, '["producto","precio","compra","tienda","descuento"]', '["producto","precio","compra"]', 'VENTAS', 0.75, NOW() - INTERVAL '25 days'),
(4, 'es', 10, '["reclamo","malo","pesimo","servicio","espera"]', '["reclamo","malo","pesimo"]', 'RECLAMO', 0.91, NOW() - INTERVAL '23 days'),
(5, 'es', 6, '["consulta","informacion","horario","atencion"]', '["consulta","informacion"]', 'CONSULTA', 0.70, NOW() - INTERVAL '21 days'),
(6, 'es', 14, '["agradecido","ayuda","rapido","solucion","equipo"]', '["agradecido","ayuda","rapido"]', 'FELICITACION', 0.87, NOW() - INTERVAL '19 days'),
(7, 'es', 9, '["compra","producto","llego","damage","caja"]', '["compra","producto","damage"]', 'RECLAMO', 0.78, NOW() - INTERVAL '17 days'),
(8, 'es', 11, '["soporte","tecnico","error","pantalla","ayuda"]', '["soporte","tecnico","error"]', 'SOPORTE', 0.85, NOW() - INTERVAL '15 days'),
(9, 'es', 10, '["excelente","servicio","rapido","profesional"]', '["excelente","servicio","rapido"]', 'FELICITACION', 0.92, NOW() - INTERVAL '13 days'),
(10, 'es', 13, '["precio","alto","caro","comparable","competencia"]', '["precio","alto","caro"]', 'VENTAS', 0.73, NOW() - INTERVAL '11 days'),
(11, 'es', 5, '["duda","consulta","envio","plazo"]', '["duda","consulta","envio"]', 'CONSULTA', 0.68, NOW() - INTERVAL '9 days'),
(12, 'es', 16, '["deficiente","lento","malo","espera","tiempo"]', '["deficiente","lento","malo"]', 'RECLAMO', 0.88, NOW() - INTERVAL '7 days'),
(13, 'es', 10, '["genial","increible","recomendado","perfecto"]', '["genial","increible","recomendado"]', 'FELICITACION', 0.94, NOW() - INTERVAL '5 days'),
(14, 'es', 8, '["instalacion","error","falla","no funciona"]', '["instalacion","error","falla"]', 'SOPORTE', 0.80, NOW() - INTERVAL '3 days'),
(15, 'es', 12, '["satisfecho","buen","servicio","rapido","calidad"]', '["satisfecho","buen","rapido"]', 'FELICITACION', 0.86, NOW() - INTERVAL '1 day');

-- 5. Actualizar comentarios existentes con estado y categoria
UPDATE comentarios SET estado = 'resuelto', categoria = 'FELICITACION' WHERE id = 1;
UPDATE comentarios SET estado = 'en_proceso', categoria = 'SOPORTE' WHERE id = 2;
UPDATE comentarios SET estado = 'resuelto', categoria = 'VENTAS' WHERE id = 3;
UPDATE comentarios SET estado = 'pendiente', categoria = 'RECLAMO' WHERE id = 4;
UPDATE comentarios SET estado = 'resuelto', categoria = 'CONSULTA' WHERE id = 5;
UPDATE comentarios SET estado = 'resuelto', categoria = 'FELICITACION' WHERE id = 6;
UPDATE comentarios SET estado = 'en_proceso', categoria = 'RECLAMO' WHERE id = 7;
UPDATE comentarios SET estado = 'resuelto', categoria = 'SOPORTE' WHERE id = 8;
UPDATE comentarios SET estado = 'resuelto', categoria = 'FELICITACION' WHERE id = 9;
UPDATE comentarios SET estado = 'pendiente', categoria = 'VENTAS' WHERE id = 10;
UPDATE comentarios SET estado = 'resuelto', categoria = 'CONSULTA' WHERE id = 11;
UPDATE comentarios SET estado = 'en_proceso', categoria = 'RECLAMO' WHERE id = 12;
UPDATE comentarios SET estado = 'resuelto', categoria = 'FELICITACION' WHERE id = 13;
UPDATE comentarios SET estado = 'pendiente', categoria = 'SOPORTE' WHERE id = 14;
UPDATE comentarios SET estado = 'resuelto', categoria = 'FELICITACION' WHERE id = 15;

-- 6. RLS: Asegurar que todos puedan leer estos datos
ALTER TABLE tiempos_atencion ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Todos leen tiempos" ON tiempos_atencion FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admin gestiona tiempos" ON tiempos_atencion FOR ALL USING (EXISTS (SELECT 1 FROM usuarios WHERE id::text = auth.uid()::text AND rol = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE optimizaciones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Todos leen optimizaciones" ON optimizaciones FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admin gestiona optimizaciones" ON optimizaciones FOR ALL USING (EXISTS (SELECT 1 FROM usuarios WHERE id::text = auth.uid()::text AND rol = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE analisis_nlp ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Todos leen analisis_nlp" ON analisis_nlp FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admin gestiona analisis_nlp" ON analisis_nlp FOR ALL USING (EXISTS (SELECT 1 FROM usuarios WHERE id::text = auth.uid()::text AND rol = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
