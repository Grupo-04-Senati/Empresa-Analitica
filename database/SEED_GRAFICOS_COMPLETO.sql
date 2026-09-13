-- =====================================================
-- SEED COMPLETO v3: BADI Corp
-- Ejecutar en Supabase SQL Editor - UNA SOLA VEZ
-- =====================================================

-- 0. Deshabilitar RLS
ALTER TABLE tiempos_atencion DISABLE ROW LEVEL SECURITY;
ALTER TABLE optimizaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE analisis_nlp DISABLE ROW LEVEL SECURITY;
ALTER TABLE categorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE faq DISABLE ROW LEVEL SECURITY;

-- 1. Columnas necesarias en comentarios
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'comentario';
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS usuario_id BIGINT;
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente';

-- 2. Insertar 10 clientes seed (email unico para no chocar con existentes)
INSERT INTO clientes (nombre, email, telefono, empresa, activo, created_at) VALUES
('Carlos Mendoza', 'carlos.mendoza@seed.badi', '999111222', 'TechCorp', true, NOW()),
('Maria Garcia', 'maria.garcia@seed.badi', '999222333', 'InnovaWeb', true, NOW()),
('Juan Rodriguez', 'juan.rodriguez@seed.badi', '999333444', 'DataPro', true, NOW()),
('Ana Lopez', 'ana.lopez@seed.badi', '999444555', 'CloudSys', true, NOW()),
('Pedro Martinez', 'pedro.martinez@seed.badi', '999555666', 'FinTech', true, NOW()),
('Laura Sanchez', 'laura.sanchez@seed.badi', '999666777', 'DigitalCo', true, NOW()),
('Roberto Flores', 'roberto.flores@seed.badi', '999777888', 'RedesTel', true, NOW()),
('Sofia Torres', 'sofia.torres@seed.badi', '999888999', 'EcoEnergy', true, NOW()),
('Diego Ramirez', 'diego.ramirez@seed.badi', '999000111', 'MedTech', true, NOW()),
('Camila Vargas', 'camila.vargas@seed.badi', '999111000', 'EduOnline', true, NOW())
ON CONFLICT (email) DO NOTHING;

-- 3. Tiempos de atencion (30 registros) - cliente_id sacado con subquery
DO $$DECLARE
  c_ids BIGINT[];
BEGIN
  SELECT ARRAY_AGG(id ORDER BY id) INTO c_ids FROM clientes WHERE email LIKE '%@seed.badi';
  IF c_ids IS NULL OR array_length(c_ids, 1) < 10 THEN
    RAISE NOTICE 'No se encontraron 10 clientes seed';
    RETURN;
  END IF;

  INSERT INTO tiempos_atencion (cliente_id, tiempo_minutos, fecha, operador) VALUES
  (c_ids[1], 12, NOW() - INTERVAL '29 days', 'Admin Principal'),
  (c_ids[2], 25, NOW() - INTERVAL '28 days', 'Ana Analista'),
  (c_ids[3], 8, NOW() - INTERVAL '27 days', 'Carlos Soporte'),
  (c_ids[4], 35, NOW() - INTERVAL '26 days', 'Admin Principal'),
  (c_ids[5], 15, NOW() - INTERVAL '25 days', 'Ana Analista'),
  (c_ids[1], 22, NOW() - INTERVAL '24 days', 'Carlos Soporte'),
  (c_ids[6], 18, NOW() - INTERVAL '23 days', 'Admin Principal'),
  (c_ids[7], 42, NOW() - INTERVAL '22 days', 'Ana Analista'),
  (c_ids[8], 10, NOW() - INTERVAL '21 days', 'Carlos Soporte'),
  (c_ids[2], 28, NOW() - INTERVAL '20 days', 'Admin Principal'),
  (c_ids[9], 14, NOW() - INTERVAL '19 days', 'Ana Analista'),
  (c_ids[10], 30, NOW() - INTERVAL '18 days', 'Carlos Soporte'),
  (c_ids[3], 7, NOW() - INTERVAL '17 days', 'Admin Principal'),
  (c_ids[4], 20, NOW() - INTERVAL '16 days', 'Ana Analista'),
  (c_ids[5], 38, NOW() - INTERVAL '15 days', 'Carlos Soporte'),
  (c_ids[1], 11, NOW() - INTERVAL '14 days', 'Admin Principal'),
  (c_ids[6], 24, NOW() - INTERVAL '13 days', 'Ana Analista'),
  (c_ids[7], 16, NOW() - INTERVAL '12 days', 'Carlos Soporte'),
  (c_ids[8], 33, NOW() - INTERVAL '11 days', 'Admin Principal'),
  (c_ids[9], 9, NOW() - INTERVAL '10 days', 'Ana Analista'),
  (c_ids[10], 27, NOW() - INTERVAL '9 days', 'Carlos Soporte'),
  (c_ids[2], 19, NOW() - INTERVAL '8 days', 'Admin Principal'),
  (c_ids[3], 45, NOW() - INTERVAL '7 days', 'Ana Analista'),
  (c_ids[4], 13, NOW() - INTERVAL '6 days', 'Carlos Soporte'),
  (c_ids[5], 21, NOW() - INTERVAL '5 days', 'Admin Principal'),
  (c_ids[6], 31, NOW() - INTERVAL '4 days', 'Ana Analista'),
  (c_ids[7], 6, NOW() - INTERVAL '3 days', 'Carlos Soporte'),
  (c_ids[8], 26, NOW() - INTERVAL '2 days', 'Admin Principal'),
  (c_ids[9], 17, NOW() - INTERVAL '1 day', 'Ana Analista'),
  (c_ids[10], 23, NOW(), 'Carlos Soporte');
END$$;

-- 4. Optimizaciones (5 registros, usuario_id=157 es el admin)
INSERT INTO optimizaciones (usuario_id, nombre, descripcion, parametros_entrada, resultado, costo_inicial, costo_optimizado, estado, created_at) VALUES
(157, 'Reduccion Tiempo Respuesta', 'Reduccion del tiempo de respuesta promedio', '{"metodo":"automatizacion"}', '{"tiempo_antes":25,"tiempo_despues":15,"mejora":"40%"}', 5000, 3200, 'completada', NOW() - INTERVAL '25 days'),
(157, 'Categorias Automaticas NLP', 'Implementacion de categorias NLP', '{"modelo":"NLP_v2"}', '{"precision":0.87,"recall":0.82,"f1":0.84}', 8000, 8000, 'completada', NOW() - INTERVAL '18 days'),
(157, 'Indices Base de Datos', 'Optimizacion con indices', '{"tablas":["comentarios","analisis_nlp"]}', '{"antes":"450ms","despues":"120ms"}', 2000, 1500, 'en_proceso', NOW() - INTERVAL '10 days'),
(157, 'Dashboard Metricas Realtime', 'Dashboard de metricas en tiempo real', '{"sla":"30min"}', '{}', 6000, 0, 'en_proceso', NOW() - INTERVAL '5 days'),
(157, 'Notificaciones Push', 'Sistema de notificaciones push', '{"canales":["email","web"]}', '{}', 4000, 0, 'pendiente', NOW() - INTERVAL '2 days');

-- 5. Categorias NLP
INSERT INTO categorias (nombre, descripcion, activo) VALUES
('SOPORTE', 'Problemas tecnicos', true),
('VENTAS', 'Consultas sobre productos', true),
('RECLAMO', 'Quejas y problemas', true),
('CONSULTA', 'Preguntas generales', true),
('FELICITACION', 'Comentarios positivos', true)
ON CONFLICT DO NOTHING;

-- 6. Analisis NLP
DO $$ BEGIN
  ALTER TABLE analisis_nlp ALTER COLUMN comentario_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

INSERT INTO analisis_nlp (idioma, cantidad_palabras, palabras_limpias, palabras_frecuentes, categoria_detectada, confianza, fecha_analisis) VALUES
('es', 12, '["servicio","rapido","excelente","atencion","calidad"]', '["rapido","servicio","excelente"]', 'FELICITACION', 0.89, NOW() - INTERVAL '28 days'),
('es', 8, '["problema","conexion","internet","falla","lento"]', '["problema","conexion","falla"]', 'SOPORTE', 0.82, NOW() - INTERVAL '27 days'),
('es', 15, '["producto","precio","compra","tienda","descuento"]', '["producto","precio","compra"]', 'VENTAS', 0.75, NOW() - INTERVAL '25 days'),
('es', 10, '["reclamo","malo","pesimo","servicio","espera"]', '["reclamo","malo","pesimo"]', 'RECLAMO', 0.91, NOW() - INTERVAL '23 days'),
('es', 6, '["consulta","informacion","horario","atencion"]', '["consulta","informacion"]', 'CONSULTA', 0.70, NOW() - INTERVAL '21 days'),
('es', 14, '["agradecido","ayuda","rapido","solucion","equipo"]', '["agradecido","ayuda","rapido"]', 'FELICITACION', 0.87, NOW() - INTERVAL '19 days'),
('es', 9, '["compra","producto","llego","damage","caja"]', '["compra","producto","damage"]', 'RECLAMO', 0.78, NOW() - INTERVAL '17 days'),
('es', 11, '["soporte","tecnico","error","pantalla","ayuda"]', '["soporte","tecnico","error"]', 'SOPORTE', 0.85, NOW() - INTERVAL '15 days'),
('es', 10, '["excelente","servicio","rapido","profesional"]', '["excelente","servicio","rapido"]', 'FELICITACION', 0.92, NOW() - INTERVAL '13 days'),
('es', 13, '["precio","alto","caro","comparable","competencia"]', '["precio","alto","caro"]', 'VENTAS', 0.73, NOW() - INTERVAL '11 days'),
('es', 5, '["duda","consulta","envio","plazo"]', '["duda","consulta","envio"]', 'CONSULTA', 0.68, NOW() - INTERVAL '9 days'),
('es', 16, '["deficiente","lento","malo","espera","tiempo"]', '["deficiente","lento","malo"]', 'RECLAMO', 0.88, NOW() - INTERVAL '7 days'),
('es', 10, '["genial","increible","recomendado","perfecto"]', '["genial","increible","recomendado"]', 'FELICITACION', 0.94, NOW() - INTERVAL '5 days'),
('es', 8, '["instalacion","error","falla","no funciona"]', '["instalacion","error","falla"]', 'SOPORTE', 0.80, NOW() - INTERVAL '3 days'),
('es', 12, '["satisfecho","buen","servicio","rapido","calidad"]', '["satisfecho","buen","rapido"]', 'FELICITACION', 0.86, NOW() - INTERVAL '1 day');

-- 7. FAQ
INSERT INTO faq (pregunta, respuesta, categoria) VALUES
('Como creo una solicitud?', 'Dirigete a la seccion de Solicitudes y presiona "Nueva Solicitud".', 'Solicitudes'),
('Puedo cambiar el estado de mi solicitud?', 'No, solo el administrador puede cambiar el estado.', 'Solicitudes'),
('Como contacto soporte?', 'Crea una solicitud o comentario desde el menu Atencion.', 'Soporte'),
('Que es el analisis NLP?', 'Sistema inteligente que analiza comentarios automaticamente.', 'Plataforma'),
('Como veo mis notificaciones?', 'Haz clic en la campanita en la esquina superior derecha.', 'Plataforma')
ON CONFLICT DO NOTHING;

-- 8. Verificar
SELECT 'tiempos_atencion' as tabla, COUNT(*) as total FROM tiempos_atencion
UNION ALL SELECT 'optimizaciones', COUNT(*) FROM optimizaciones
UNION ALL SELECT 'analisis_nlp', COUNT(*) FROM analisis_nlp
UNION ALL SELECT 'categorias', COUNT(*) FROM categorias
UNION ALL SELECT 'faq', COUNT(*) FROM faq
UNION ALL SELECT 'clientes_seed', COUNT(*) FROM clientes WHERE email LIKE '%@seed.badi';
