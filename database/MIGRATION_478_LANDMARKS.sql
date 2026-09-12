-- ============================================================
-- Sistema facial MediaPipe de 478 puntos — migracion de la tabla `rostros`
-- Ejecutar en Supabase Dashboard > SQL Editor
--
-- Es idempotente: se puede correr varias veces sin efectos secundarios.
--
-- QUE ARREGLA (el error "expected 128 dimensions, not 339"):
--   FIX_DATABASE_COMPLETE.sql creo embedding_frontal / embedding_izquierda /
--   embedding_derecha como vector(128), porque el sistema anterior usaba los
--   descriptores de 128 numeros de face-api.js. El sistema de 478 puntos guarda
--   una firma de 339 valores, asi que Postgres rechaza el INSERT.
--
--   Un "ADD COLUMN IF NOT EXISTS ... jsonb" NO lo arregla: la columna ya
--   existe, solo con el tipo equivocado, y la orden se salta en silencio.
--   Aqui se convierten a jsonb.
--
-- LOS DATOS ANTIGUOS NO SE PIERDEN: el texto de un vector de pgvector es
-- "[1,2,3]", que ya es JSON valido, asi que la conversion los preserva. Pero
-- NO son comparables con el sistema nuevo (128 valores vs 339, y con otra
-- normalizacion): el login los detecta por longitud y avisa de que hay que
-- volver a registrar el rostro. No hay riesgo de falsos positivos.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Convertir a jsonb las columnas que tengan otro tipo
-- ------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rostros'
      AND column_name IN (
        'embedding_frontal', 'embedding_izquierda', 'embedding_derecha',
        'face_signature', 'landmarks_478', 'landmarks_68', 'blendshapes',
        'medidas_3d', 'metadata', 'embedding'
      )
  LOOP
    IF r.data_type = 'jsonb' THEN
      CONTINUE;                                  -- ya esta bien

    ELSIF r.udt_name = 'vector' THEN
      -- pgvector: su representacion textual "[1,2,3]" ya es JSON valido.
      EXECUTE format(
        'ALTER TABLE public.rostros ALTER COLUMN %I TYPE jsonb USING %I::text::jsonb',
        r.column_name, r.column_name);
      RAISE NOTICE 'Columna % convertida de vector a jsonb', r.column_name;

    ELSIF r.data_type = 'ARRAY' THEN
      EXECUTE format(
        'ALTER TABLE public.rostros ALTER COLUMN %I TYPE jsonb USING to_jsonb(%I)',
        r.column_name, r.column_name);
      RAISE NOTICE 'Columna % convertida de array a jsonb', r.column_name;

    ELSIF r.data_type IN ('text', 'character varying', 'json') THEN
      EXECUTE format(
        'ALTER TABLE public.rostros ALTER COLUMN %I TYPE jsonb USING NULLIF(%I::text, '''')::jsonb',
        r.column_name, r.column_name);
      RAISE NOTICE 'Columna % convertida de % a jsonb', r.column_name, r.data_type;

    ELSE
      RAISE WARNING 'Columna % tiene el tipo % y no se convirtio automaticamente',
        r.column_name, r.data_type;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 2. Crear las columnas que falten (ya como jsonb)
-- ------------------------------------------------------------

-- Una firma por pose del barrido izquierda / frontal / derecha
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS embedding_frontal   jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS embedding_izquierda jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS embedding_derecha   jsonb;

-- Malla completa y datos del sistema de 478 puntos
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS face_signature jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS landmarks_478  jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS blendshapes    jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS medidas_3d     jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS metadata       jsonb DEFAULT '{}'::jsonb;

-- Heredadas del sistema de 68 puntos (compatibilidad)
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS landmarks_68 jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS forma_rostro varchar(50);

-- `embedding` era NOT NULL en migraciones antiguas; el sistema de 478 puntos
-- guarda la firma en embedding_frontal, asi que se relaja.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rostros'
      AND column_name = 'embedding' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.rostros ALTER COLUMN embedding DROP NOT NULL;
    RAISE NOTICE 'embedding ya admite NULL';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Retirar la funcion de busqueda del sistema de 128 dimensiones
--
-- buscar_rostro_match usaba el operador <=> de pgvector sobre las columnas que
-- acabamos de convertir a jsonb: tras esta migracion fallaria en ejecucion.
-- El emparejamiento del sistema de 478 puntos se hace en el navegador
-- (comparePoseSets en frontend/src/services/mediaPipeFace.ts).
--
-- Si prefieres conservarla, comenta este bloque: quedara rota pero presente.
--
-- Se busca en el catalogo en vez de nombrar el tipo `vector` en un DROP
-- FUNCTION: si la extension pgvector no estuviera instalada, nombrar ese tipo
-- abortaria toda la migracion.
-- ------------------------------------------------------------
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT oid::regprocedure AS firma
    FROM pg_proc
    WHERE proname = 'buscar_rostro_match'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION ' || f.firma;
    RAISE NOTICE 'Funcion % eliminada (era del sistema de 128 dimensiones)', f.firma;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 4. Indices y tiempo real
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rostros_usuario ON public.rostros(usuario_id);

-- Guardado en tiempo real: anadir la tabla a la publicacion solo si falta
-- (repetir el ALTER PUBLICATION daria error).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'rostros'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rostros;
    RAISE NOTICE 'rostros anadida a supabase_realtime';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'La publicacion supabase_realtime no existe; se omite';
END $$;

-- ------------------------------------------------------------
-- 5. Documentacion de columnas
-- ------------------------------------------------------------
COMMENT ON COLUMN public.rostros.embedding_frontal IS
  'Firma facial de la pose frontal: 339 valores (113 landmarks x 3) normalizados';
COMMENT ON COLUMN public.rostros.embedding_izquierda IS
  'Firma facial con la cabeza girada a un lado de la imagen';
COMMENT ON COLUMN public.rostros.embedding_derecha IS
  'Firma facial con la cabeza girada al otro lado de la imagen';
COMMENT ON COLUMN public.rostros.face_signature IS
  'Copia de embedding_frontal (misma forma), para el sistema de 478 puntos';
COMMENT ON COLUMN public.rostros.landmarks_478 IS
  '478 landmarks normalizados [x,y,z,...] = 1434 valores — MediaPipe Face Mesh';
COMMENT ON COLUMN public.rostros.medidas_3d IS
  'Medidas antropometricas 3D en unidades interoculares: ancho de pomulos, '
  'ancho de mandibula, proyeccion de la nariz, profundidad de cuencas, etc.';
COMMENT ON COLUMN public.rostros.blendshapes IS
  'Blendshapes de MediaPipe (expresiones faciales) promediados en el escaneo';
COMMENT ON COLUMN public.rostros.metadata IS
  'engine, signature_version, poses capturadas, frames, estabilidad y fecha';

-- ------------------------------------------------------------
-- 6. Comprobacion final: todo debe salir jsonb
-- ------------------------------------------------------------
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'rostros'
ORDER BY ordinal_position;

-- Para borrar los rostros que quedaron de versiones anteriores y empezar
-- limpio, descomenta:
--
-- DELETE FROM public.rostros
--  WHERE COALESCE(metadata->>'signature_version', '') <> 'mediapipe-478-v2';
