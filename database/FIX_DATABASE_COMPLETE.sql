-- ============================================================
-- FIX COMPLETO BD: Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. USUARIOS: Columnas faltantes (si no existen)
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS telefono VARCHAR(50);

ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS empresa VARCHAR(200);

-- 2. CLIENTES: FK a usuarios
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS usuario_id BIGINT REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- 3. ROSTROS: Asegurar schema correcto
-- La tabla ya debe tener estas columnas, pero por si acaso:
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rostros' AND column_name='embedding_frontal') THEN
    ALTER TABLE public.rostros ADD COLUMN embedding_frontal vector(128);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rostros' AND column_name='embedding_izquierda') THEN
    ALTER TABLE public.rostros ADD COLUMN embedding_izquierda vector(128);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rostros' AND column_name='embedding_derecha') THEN
    ALTER TABLE public.rostros ADD COLUMN embedding_derecha vector(128);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rostros' AND column_name='proporciones') THEN
    ALTER TABLE public.rostros ADD COLUMN proporciones JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rostros' AND column_name='landmarks_68') THEN
    ALTER TABLE public.rostros ADD COLUMN landmarks_68 JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rostros' AND column_name='metadata') THEN
    ALTER TABLE public.rostros ADD COLUMN metadata JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rostros' AND column_name='foto_preview') THEN
    ALTER TABLE public.rostros ADD COLUMN foto_preview TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rostros' AND column_name='forma_rostro') THEN
    ALTER TABLE public.rostros ADD COLUMN forma_rostro VARCHAR(50);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rostros' AND column_name='updated_at') THEN
    ALTER TABLE public.rostros ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- 4. Triggers para auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_update();
DROP FUNCTION IF EXISTS public.handle_user_delete();

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

-- 5. RLS: Deshabilitar en tablas problemáticas
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rostros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios DISABLE ROW LEVEL SECURITY;

-- 6. Sync auth.users existentes con usuarios
INSERT INTO public.usuarios (auth_user_id, nombre, email, password_hash, rol, activo)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'nombre', split_part(au.email, '@', 1)),
  au.email,
  'auth_managed',
  COALESCE(au.raw_user_meta_data->>'rol', 'USUARIO'),
  true
FROM auth.users au
LEFT JOIN public.usuarios u ON u.auth_user_id = au.id
WHERE u.id IS NULL;

-- 7. Actualizar usuarios existentes con auth_user_id si lo tienen null
UPDATE public.usuarios u
SET auth_user_id = au.id
FROM auth.users au
WHERE u.email = au.email AND u.auth_user_id IS NULL;

-- 8. ANALISIS_NLP: Columna sentimiento
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analisis_nlp' AND column_name='sentimiento') THEN
    ALTER TABLE public.analisis_nlp ADD COLUMN sentimiento VARCHAR(20) DEFAULT 'neutro';
  END IF;
END $$;

-- 9. Verificar
SELECT 'MIGRATION COMPLETADA' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rostros' AND table_schema = 'public'
ORDER BY ordinal_position;
