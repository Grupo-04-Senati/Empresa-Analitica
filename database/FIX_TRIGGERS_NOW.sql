-- ============================================================
-- PASO 1: Crear triggers para conectar auth.users <-> usuarios
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query → RUN
-- ============================================================

-- Eliminar triggers viejos si existen
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_update() CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_delete() CASCADE;

-- Trigger 1: Cuando se crea un usuario en auth.users, crear en usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (auth_user_id, nombre, email, password_hash, rol, activo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    'auth_managed',
    COALESCE(NEW.raw_user_meta_data->>'rol', 'USUARIO'),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger 2: Sincronizar cambios de email
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE public.usuarios
    SET email = NEW.email, updated_at = NOW()
    WHERE auth_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Trigger 3: Eliminar perfil cuando se elimina auth user
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.usuarios WHERE auth_user_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- Verificar que los triggers se crearon
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'usuarios' OR event_object_table = 'auth' OR event_object_schema = 'public'
ORDER BY event_object_table;
