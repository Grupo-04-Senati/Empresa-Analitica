-- ============================================================
-- PASO 3: Notificaciones automaticas por evento
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

-- ============================================================
-- 3a. Nueva solicitud creada -> notificacion "Sistema"
-- ============================================================
CREATE OR REPLACE FUNCTION notificar_nueva_solicitud()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notificaciones (
    tipo, titulo, mensaje, enlace, destinatario,
    origen_tabla, origen_id, generado_por, leida, eliminada, created_at
  ) VALUES (
    'sistema',
    'Nueva solicitud #' || NEW.id,
    'El cliente ha creado una nueva solicitud: ' || COALESCE(NEW.asunto, NEW.descripcion, 'Sin asunto'),
    '/dashboard/solicitudes',
    '__all__',
    'solicitudes',
    NEW.id,
    'sistema',
    false,
    false,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notificar_solicitud ON solicitudes;
CREATE TRIGGER trg_notificar_solicitud
  AFTER INSERT ON solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION notificar_nueva_solicitud();

-- ============================================================
-- 3b. Solicitud excede SLA (>30 min) -> notificacion "Alerta"
-- ============================================================
CREATE OR REPLACE FUNCTION notificar_sla_excedido()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tiempo_minutos > 30 THEN
    INSERT INTO notificaciones (
      tipo, titulo, mensaje, enlace, destinatario,
      origen_tabla, origen_id, generado_por, leida, eliminada, created_at
    ) VALUES (
      'alerta',
      'SLA excedido - Solicitud #' || COALESCE(NEW.solicitud_id::text, 'N/A'),
      'El tiempo de atencion fue de ' || NEW.tiempo_minutos || ' minutos (limite: 30 min).',
      '/dashboard/tiempo-atencion',
      '__admins__',
      'tiempos_atencion',
      NEW.id,
      'sistema',
      false,
      false,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notificar_sla ON tiempos_atencion;
CREATE TRIGGER trg_notificar_sla
  AFTER INSERT ON tiempos_atencion
  FOR EACH ROW
  EXECUTE FUNCTION notificar_sla_excedido();

-- ============================================================
-- 3c. Comentarios sin procesar cada 5 minutos (pg_cron)
-- ============================================================
-- Requiere la extension pg_cron. Si no esta habilitada:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION notificar_comentarios_pendientes()
RETURNS void AS $$
BEGIN
  INSERT INTO notificaciones (
    tipo, titulo, mensaje, enlace, destinatario,
    origen_tabla, origen_id, generado_por, leida, eliminada, created_at
  )
  SELECT
    'alerta',
    'Comentario pendiente #' || c.id,
    'El comentario de "' || COALESCE(c.cliente_id::text, 'Cliente desconocido') || '" lleva mas de 5 minutos sin procesar: "' || LEFT(c.contenido, 80) || '..."',
    '/dashboard/analizar-comentario?comentario=' || c.id,
    '__admins__',
    'comentarios',
    c.id,
    'sistema',
    false,
    false,
    NOW()
  FROM comentarios c
  WHERE c.procesado = false
    AND c.created_at < NOW() - INTERVAL '5 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM notificaciones n
      WHERE n.origen_tabla = 'comentarios'
        AND n.origen_id = c.id
        AND n.generado_por = 'sistema'
        AND n.created_at > NOW() - INTERVAL '1 hour'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Programar cada 5 minutos (requiere pg_cron habilitado en Supabase)
-- Si pg_cron no esta disponible, ejecutar manualmente o usar Edge Function
SELECT cron.schedule(
  'notificar-comentarios-pendientes',
  '*/5 * * * *',
  $$SELECT notificar_comentarios_pendientes()$$
);

-- ============================================================
-- 3d. Clasificacion de emergencia -> notificacion "Alerta"
-- (Este INSERT lo hace el endpoint de Vercel, no un trigger de Postgres)
-- ============================================================
-- Cuando el clasificador NLP detecta EMERGENCIA o FEEDBACK negativo,
-- el endpoint de Vercel debe ejecutar:
--
-- INSERT INTO notificaciones (
--   tipo, titulo, mensaje, enlace, destinatario,
--   origen_tabla, origen_id, generado_por, leida, eliminada, created_at
-- ) VALUES (
--   'alerta',
--   'Clasificacion critica - Comentario #' || comentario_id,
--   'Se detecto una clasificacion "' || categoria || '" con confianza ' || confianza || '%',
--   '/dashboard/analizar-comentario',
--   '__admins__',
--   'analisis_nlp',
--   analisis_id,
--   'sistema',
--   false,
--   false,
--   NOW()
-- );
