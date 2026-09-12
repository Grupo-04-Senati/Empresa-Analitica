-- ============================================================
-- NEXUS Corp · Centro Inteligente
-- Migracion: 002 - Datos iniciales (seed)
-- Fecha: 2026-09-01
-- ============================================================

-- CATEGORIAS INICIALES
INSERT INTO categorias (nombre, descripcion) VALUES
    ('SOPORTE', 'Soporte tecnico y atencion al cliente'),
    ('VENTAS', 'Consultas sobre ventas y productos'),
    ('RECLAMO', 'Quejas y reclamaciones'),
    ('CONSULTA', 'Consultas generales'),
    ('FELICITACION', 'Felicitaciones y comentarios positivos'),
    ('OTROS', 'Comentarios que no encajan en otras categorias')
ON CONFLICT (nombre) DO NOTHING;

-- CLIENTES DE EJEMPLO
INSERT INTO clientes (nombre, email, telefono, empresa) VALUES
    ('Maria Garcia', 'maria@empresa.com', '+57 300 123 4567', 'TechCorp S.A.S'),
    ('Carlos Lopez', 'carlos@tienda.com', '+57 310 987 6543', 'MegaTienda S.A'),
    ('Ana Martinez', 'ana@servicios.com', '+57 320 456 7890', 'Servicios Profesionales'),
    ('Pedro Sanchez', 'pedro@constructora.com', '+57 315 321 6549', 'Constructora Delta'),
    ('Laura Rodriguez', 'laura@marketing.com', '+57 301 789 1234', 'Marketing Digital MX')
ON CONFLICT DO NOTHING;

-- COMENTARIOS DE EJEMPLO (usando subqueries para obtener IDs reales)
INSERT INTO comentarios (cliente_id, contenido, canal, estado, categoria, fecha, procesado)
SELECT c.id, 'El servicio ha sido excelente, muy satisfecho con la atencion recibida', 'web', 'procesado', 'FELICITACION', NOW() - INTERVAL '6 days', TRUE
FROM clientes c WHERE c.email = 'maria@empresa.com'
AND NOT EXISTS (SELECT 1 FROM comentarios WHERE contenido = 'El servicio ha sido excelente, muy satisfecho con la atencion recibida');

INSERT INTO comentarios (cliente_id, contenido, canal, estado, categoria, fecha, procesado)
SELECT c.id, 'Tardo demasiado en llegar mi pedido, muy mala experiencia', 'email', 'procesado', 'RECLAMO', NOW() - INTERVAL '5 days', TRUE
FROM clientes c WHERE c.email = 'carlos@tienda.com'
AND NOT EXISTS (SELECT 1 FROM comentarios WHERE contenido = 'Tardo demasiado en llegar mi pedido, muy mala experiencia');

INSERT INTO comentarios (cliente_id, contenido, canal, estado, categoria, fecha, procesado)
SELECT c.id, 'Quisiera informacion sobre los planes empresariales disponibles', 'telefono', 'procesado', 'CONSULTA', NOW() - INTERVAL '4 days', TRUE
FROM clientes c WHERE c.email = 'ana@servicios.com'
AND NOT EXISTS (SELECT 1 FROM comentarios WHERE contenido = 'Quisiera informacion sobre los planes empresariales disponibles');

INSERT INTO comentarios (cliente_id, contenido, canal, estado, categoria, fecha, procesado)
SELECT c.id, 'El producto llego danado, necesito un reemplazo urgente', 'web', 'procesado', 'RECLAMO', NOW() - INTERVAL '3 days', TRUE
FROM clientes c WHERE c.email = 'pedro@constructora.com'
AND NOT EXISTS (SELECT 1 FROM comentarios WHERE contenido = 'El producto llego danado, necesito un reemplazo urgente');

INSERT INTO comentarios (cliente_id, contenido, canal, estado, categoria, fecha, procesado)
SELECT c.id, 'Sus servicios son los mejores del mercado, los recomiendo', 'chat', 'procesado', 'FELICITACION', NOW() - INTERVAL '2 days', TRUE
FROM clientes c WHERE c.email = 'laura@marketing.com'
AND NOT EXISTS (SELECT 1 FROM comentarios WHERE contenido = 'Sus servicios son los mejores del mercado, los recomiendo');

INSERT INTO comentarios (cliente_id, contenido, canal, estado, categoria, fecha, procesado)
SELECT c.id, 'Necesito soporte tecnico para configurar mi cuenta', 'web', 'pendiente', 'SOPORTE', NOW() - INTERVAL '1 day', FALSE
FROM clientes c WHERE c.email = 'maria@empresa.com'
AND NOT EXISTS (SELECT 1 FROM comentarios WHERE contenido = 'Necesito soporte tecnico para configurar mi cuenta');

INSERT INTO comentarios (cliente_id, contenido, canal, estado, categoria, fecha, procesado)
SELECT c.id, 'Quiero cancelar mi suscripcion, los precios son muy altos', 'email', 'pendiente', 'RECLAMO', NOW(), FALSE
FROM clientes c WHERE c.email = 'ana@servicios.com'
AND NOT EXISTS (SELECT 1 FROM comentarios WHERE contenido = 'Quiero cancelar mi suscripcion, los precios son muy altos');

-- TIEMPOS DE ATENCION DE EJEMPLO
INSERT INTO tiempos_atencion (cliente_id, tiempo_minutos, fecha, operador)
SELECT c.id, 12.5, CURRENT_DATE - INTERVAL '6 days', 'Agente Juan'
FROM clientes c WHERE c.email = 'maria@empresa.com'
AND NOT EXISTS (SELECT 1 FROM tiempos_atencion WHERE operador = 'Agente Juan' AND fecha = CURRENT_DATE - INTERVAL '6 days');

INSERT INTO tiempos_atencion (cliente_id, tiempo_minutos, fecha, operador)
SELECT c.id, 8.3, CURRENT_DATE - INTERVAL '5 days', 'Agente Maria'
FROM clientes c WHERE c.email = 'carlos@tienda.com'
AND NOT EXISTS (SELECT 1 FROM tiempos_atencion WHERE operador = 'Agente Maria' AND fecha = CURRENT_DATE - INTERVAL '5 days');

INSERT INTO tiempos_atencion (cliente_id, tiempo_minutos, fecha, operador)
SELECT c.id, 22.1, CURRENT_DATE - INTERVAL '4 days', 'Agente Carlos'
FROM clientes c WHERE c.email = 'ana@servicios.com'
AND NOT EXISTS (SELECT 1 FROM tiempos_atencion WHERE operador = 'Agente Carlos' AND fecha = CURRENT_DATE - INTERVAL '4 days');

INSERT INTO tiempos_atencion (cliente_id, tiempo_minutos, fecha, operador)
SELECT c.id, 5.7, CURRENT_DATE - INTERVAL '3 days', 'Agente Ana'
FROM clientes c WHERE c.email = 'maria@empresa.com'
AND NOT EXISTS (SELECT 1 FROM tiempos_atencion WHERE operador = 'Agente Ana' AND fecha = CURRENT_DATE - INTERVAL '3 days');

INSERT INTO tiempos_atencion (cliente_id, tiempo_minutos, fecha, operador)
SELECT c.id, 15.9, CURRENT_DATE - INTERVAL '2 days', 'Agente Juan'
FROM clientes c WHERE c.email = 'pedro@constructora.com'
AND NOT EXISTS (SELECT 1 FROM tiempos_atencion WHERE operador = 'Agente Juan' AND fecha = CURRENT_DATE - INTERVAL '2 days');

INSERT INTO tiempos_atencion (cliente_id, tiempo_minutos, fecha, operador)
SELECT c.id, 3.2, CURRENT_DATE - INTERVAL '1 day', 'Agente Maria'
FROM clientes c WHERE c.email = 'laura@marketing.com'
AND NOT EXISTS (SELECT 1 FROM tiempos_atencion WHERE operador = 'Agente Maria' AND fecha = CURRENT_DATE - INTERVAL '1 day');

INSERT INTO tiempos_atencion (cliente_id, tiempo_minutos, fecha, operador)
SELECT c.id, 18.4, CURRENT_DATE, 'Agente Carlos'
FROM clientes c WHERE c.email = 'carlos@tienda.com'
AND NOT EXISTS (SELECT 1 FROM tiempos_atencion WHERE operador = 'Agente Carlos' AND fecha = CURRENT_DATE);

INSERT INTO tiempos_atencion (cliente_id, tiempo_minutos, fecha, operador)
SELECT c.id, 9.8, CURRENT_DATE, 'Agente Ana'
FROM clientes c WHERE c.email = 'ana@servicios.com'
AND NOT EXISTS (SELECT 1 FROM tiempos_atencion WHERE operador = 'Agente Ana' AND fecha = CURRENT_DATE);

-- ANALISIS NLP DE EJEMPLO
INSERT INTO analisis_nlp (comentario_id, idioma, cantidad_palabras, palabras_limpias, palabras_frecuentes, categoria_detectada, confianza)
SELECT c.id, 'es', 8, '["servicio","excelente","satisfecho","atencion","recibida"]', '[{"palabra":"servicio","frecuencia":1},{"palabra":"excelente","frecuencia":1},{"palabra":"atencion","frecuencia":1}]', 'FELICITACION', 0.8900
FROM comentarios c WHERE c.contenido = 'El servicio ha sido excelente, muy satisfecho con la atencion recibida'
AND NOT EXISTS (SELECT 1 FROM analisis_nlp WHERE comentario_id = c.id);

INSERT INTO analisis_nlp (comentario_id, idioma, cantidad_palabras, palabras_limpias, palabras_frecuentes, categoria_detectada, confianza)
SELECT c.id, 'es', 9, '["tardo","demasiado","llegar","pedido","mala","experiencia"]', '[{"palabra":"pedido","frecuencia":1},{"palabra":"demasiado","frecuencia":1}]', 'RECLAMO', 0.8200
FROM comentarios c WHERE c.contenido = 'Tardo demasiado en llegar mi pedido, muy mala experiencia'
AND NOT EXISTS (SELECT 1 FROM analisis_nlp WHERE comentario_id = c.id);

INSERT INTO analisis_nlp (comentario_id, idioma, cantidad_palabras, palabras_limpias, palabras_frecuentes, categoria_detectada, confianza)
SELECT c.id, 'es', 8, '["quisiera","informacion","planes","empresariales","disponibles"]', '[{"palabra":"planes","frecuencia":1},{"palabra":"informacion","frecuencia":1}]', 'CONSULTA', 0.6500
FROM comentarios c WHERE c.contenido = 'Quisiera informacion sobre los planes empresariales disponibles'
AND NOT EXISTS (SELECT 1 FROM analisis_nlp WHERE comentario_id = c.id);

INSERT INTO analisis_nlp (comentario_id, idioma, cantidad_palabras, palabras_limpias, palabras_frecuentes, categoria_detectada, confianza)
SELECT c.id, 'es', 8, '["producto","llego","danado","necesito","reemplazo","urgente"]', '[{"palabra":"reemplazo","frecuencia":1},{"palabra":"danado","frecuencia":1}]', 'RECLAMO', 0.9100
FROM comentarios c WHERE c.contenido = 'El producto llego danado, necesito un reemplazo urgente'
AND NOT EXISTS (SELECT 1 FROM analisis_nlp WHERE comentario_id = c.id);

INSERT INTO analisis_nlp (comentario_id, idioma, cantidad_palabras, palabras_limpias, palabras_frecuentes, categoria_detectada, confianza)
SELECT c.id, 'es', 9, '["servicios","mejores","mercado","recomiendo"]', '[{"palabra":"servicios","frecuencia":1},{"palabra":"mejores","frecuencia":1}]', 'FELICITACION', 0.8700
FROM comentarios c WHERE c.contenido = 'Sus servicios son los mejores del mercado, los recomiendo'
AND NOT EXISTS (SELECT 1 FROM analisis_nlp WHERE comentario_id = c.id);
