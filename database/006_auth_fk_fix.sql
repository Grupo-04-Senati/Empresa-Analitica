-- ============================================================
-- FIX: Relacion auth.users -> usuarios -> rostros
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

-- 1. Agregar columna auth_user_id a usuarios (UUID FK -> auth.users.id)
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Eliminar triggers viejos que fallan (UUID -> bigint no funciona)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_update();
DROP FUNCTION IF EXISTS public.handle_user_delete();

-- 3. Trigger: crear usuario en 'usuarios' cuando se crea en auth.users
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

-- 4. Trigger: sincronizar cambios de email
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

-- 5. Trigger: eliminar usuario de 'usuarios' cuando se elimina de auth.users
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

-- 6. Asegurar que rostros tiene la FK correcta a usuarios
-- (usuario_id en rostros -> id en usuarios)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'rostros_usuario_id_fkey' 
    AND table_name = 'rostros'
  ) THEN
    ALTER TABLE public.rostros 
    ADD CONSTRAINT rostros_usuario_id_fkey 
    FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7. Verificar
SELECT 'MIGRATION 006 COMPLETADA' as status;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'usuarios' AND column_name IN ('id', 'auth_user_id', 'email')
ORDER BY ordinal_position;
