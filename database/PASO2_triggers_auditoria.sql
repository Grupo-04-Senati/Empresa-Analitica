-- ============================================================
-- PASO 2: Triggers genericos de auditoria
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

-- 2a. Funcion reutilizable de auditoria
CREATE OR REPLACE FUNCTION registrar_auditoria_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id BIGINT;
  v_usuario_email TEXT;
  v_tabla TEXT;
  v_accion TEXT;
  v_registro_id BIGINT;
  v_datos_anteriores JSONB;
  v_datos_nuevos JSONB;
  v_usuario_sistema TEXT;
BEGIN
  -- Determinar tabla
  v_tabla := TG_TABLE_NAME;

  -- Determinar accion
  IF TG_OP = 'INSERT' THEN
    v_accion := 'INSERT';
    v_registro_id := NEW.id;
    v_datos_nuevos := to_jsonb(NEW);
    v_datos_anteriores := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_accion := 'UPDATE';
    v_registro_id := NEW.id;
    v_datos_anteriores := to_jsonb(OLD);
    v_datos_nuevos := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'DELETE';
    v_registro_id := OLD.id;
    v_datos_anteriores := to_jsonb(OLD);
    v_datos_nuevos := NULL;
  END IF;

  -- Intentar obtener el usuario del JWT de Supabase
  BEGIN
    v_usuario_id := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub';
    v_usuario_email := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'email';
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
    v_usuario_email := NULL;
  END;

  -- Si no hay usuario (accion del sistema), marcar como tal
  IF v_usuario_id IS NULL THEN
    v_usuario_sistema := 'sistema';
  ELSE
    v_usuario_sistema := 'usuario';
  END IF;

  INSERT INTO auditoria (
    usuario_id,
    usuario_email,
    accion,
    tabla,
    registro_id,
    datos_anteriores,
    datos_nuevos,
    usuario_o_sistema,
    created_at
  ) VALUES (
    v_usuario_id,
    v_usuario_email,
    v_accion,
    v_tabla,
    v_registro_id,
    v_datos_anteriores,
    v_datos_nuevos,
    v_usuario_sistema,
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2b. Triggers en solicitudes
DROP TRIGGER IF EXISTS trg_auditoria_solicitudes ON solicitudes;
CREATE TRIGGER trg_auditoria_solicitudes
  AFTER INSERT OR UPDATE OR DELETE ON solicitudes
  FOR EACH ROW
  EXECUTE FUNCTION registrar_auditoria_trigger();

-- 2c. Triggers en comentarios
DROP TRIGGER IF EXISTS trg_auditoria_comentarios ON comentarios;
CREATE TRIGGER trg_auditoria_comentarios
  AFTER INSERT OR UPDATE OR DELETE ON comentarios
  FOR EACH ROW
  EXECUTE FUNCTION registrar_auditoria_trigger();

-- 2d. Triggers en tiempos_atencion
DROP TRIGGER IF EXISTS trg_auditoria_tiempos ON tiempos_atencion;
CREATE TRIGGER trg_auditoria_tiempos
  AFTER INSERT OR UPDATE OR DELETE ON tiempos_atencion
  FOR EACH ROW
  EXECUTE FUNCTION registrar_auditoria_trigger();

-- 2e. Triggers en categorias
DROP TRIGGER IF EXISTS trg_auditoria_categorias ON categorias;
CREATE TRIGGER trg_auditoria_categorias
  AFTER INSERT OR UPDATE OR DELETE ON categorias
  FOR EACH ROW
  EXECUTE FUNCTION registrar_auditoria_trigger();

-- 2f. Triggers en analisis_nlp
DROP TRIGGER IF EXISTS trg_auditoria_analisis ON analisis_nlp;
CREATE TRIGGER trg_auditoria_analisis
  AFTER INSERT OR UPDATE OR DELETE ON analisis_nlp
  FOR EACH ROW
  EXECUTE FUNCTION registrar_auditoria_trigger();
