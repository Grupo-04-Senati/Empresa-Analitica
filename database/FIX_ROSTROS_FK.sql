-- ============================================================
-- FIX: Foreign Key entre rostros y usuarios
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Verificar que usuarios.id existe y es BIGINT
-- (deberia ser auto-increment integer/bigint)

-- 2. Asegurar que rostros.usuario_id es BIGINT
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rostros' AND column_name = 'usuario_id'
    AND data_type != 'bigint'
  ) THEN
    ALTER TABLE public.rostros
      ALTER COLUMN usuario_id TYPE BIGINT USING usuario_id::BIGINT;
  END IF;
END $$;

-- 3. Eliminar FK existente si la hay (para recrearla limpia)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rostros_usuario_id_fkey'
    AND table_name = 'rostros'
  ) THEN
    ALTER TABLE public.rostros DROP CONSTRAINT rostros_usuario_id_fkey;
  END IF;
END $$;

-- 4. Crear FK: rostros.usuario_id -> usuarios.id
ALTER TABLE public.rostros
  ADD CONSTRAINT rostros_usuario_id_fkey
  FOREIGN KEY (usuario_id)
  REFERENCES public.usuarios(id)
  ON DELETE CASCADE;

-- 5. Agregar indice para busquedas rapidas
CREATE INDEX IF NOT EXISTS idx_rostros_usuario_id ON public.rostros(usuario_id);

-- 6. Verificar que la FK funciona
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'rostros';
