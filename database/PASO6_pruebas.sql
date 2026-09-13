-- ============================================================
-- PASO 6: Script de pruebas
-- Ejecutar DESPUES de PASO1, PASO2 y PASO3
-- ============================================================

-- ============================================================
-- 6a. Insertar una solicitud de prueba
-- ============================================================
INSERT INTO solicitudes (
  titulo,
  descripcion,
  estado,
  prioridad,
  cliente_email,
  created_at
) VALUES (
  'Prueba SLA - Solicitud automatica',
  'Esta solicitud es para probar que el trigger de notificacion funciona correctamente.',
  'pendiente',
  'alta',
  'test@prueba.com',
  NOW()
);

-- ============================================================
-- 6b. Insertar un comentario sin procesar
-- ============================================================
INSERT INTO comentarios (
  contenido,
  canal,
  tipo,
  estado,
  procesado,
  fecha,
  created_at
) VALUES (
  'Es un servicio horrible, no me ayudaron en nada y tardaron muchisimo. Quiero un reembolso.',
  'web',
  'comentario',
  'pendiente',
  false,
  NOW(),
  NOW()
);

-- ============================================================
-- 6c. Insertar un tiempo de atencion que excede el SLA (>30 min)
-- ============================================================
INSERT INTO tiempos_atencion (
  solicitud_id,
  tiempo_minutos,
  operador,
  fecha,
  created_at
) VALUES (
  1,
  45,
  'operador@test.com',
  NOW(),
  NOW()
);

-- ============================================================
-- VERIFICACION (6d)
-- ============================================================

-- Verificar auditoria: debe haber al menos 3 registros nuevos
-- (1 solicitud + 1 comentario + 1 tiempo_atencion)
SELECT
  id,
  accion,
  tabla,
  usuario_o_sistema,
  created_at,
  COALESCE(datos_nuevos->>'titulo', datos_nuevos->>'contenido', 'N/A') AS detalle
FROM auditoria
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

-- Verificar notificaciones: debe haber al menos 2 nuevas
-- (1 nueva solicitud + 1 SLA excedido)
SELECT
  id,
  tipo,
  titulo,
  mensaje,
  generado_por,
  origen_tabla,
  origen_id,
  created_at
FROM notificaciones
WHERE created_at > NOW() - INTERVAL '5 minutes'
  AND generado_por = 'sistema'
ORDER BY created_at DESC;

-- Verificar que la notificacion de SLA tiene los campos correctos
SELECT
  tipo,
  titulo,
  mensaje,
  redirigir_a,
  generado_por,
  origen_tabla,
  origen_id
FROM notificaciones
WHERE origen_tabla = 'tiempos_atencion'
  AND creado_at > NOW() - INTERVAL '5 minutes'
LIMIT 1;

-- Verificar el conteo por tipo de accion en auditoria
SELECT
  usuario_o_sistema,
  accion,
  COUNT(*) AS total
FROM auditoria
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY usuario_o_sistema, accion
ORDER BY total DESC;
