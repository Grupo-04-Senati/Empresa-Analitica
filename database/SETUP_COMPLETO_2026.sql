-- ============================================================
--  empresa-inteligente — PUESTA A PUNTO COMPLETA DE LA BASE
--  Supabase Dashboard  ->  SQL Editor  ->  New Query  ->  pegar  ->  Run
-- ============================================================
--
--  QUE ES ESTO
--  Un unico archivo con todo lo que el codigo del frontend necesita y que hoy
--  esta repartido entre 25 archivos .sql de database/, algunos con esquemas que
--  se contradicen entre si. Se relevo leyendo cada .from('tabla') del frontend
--  y de las Edge Functions, y comparandolo con el DDL existente.
--
--  ES SEGURO CORRERLO SOBRE UNA BASE CON DATOS:
--    * Solo AGREGA: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
--    * No hace DROP TABLE ni DELETE de ninguna fila.
--    * Es idempotente: correrlo dos veces no cambia nada la segunda vez.
--    * Las dos unicas cosas que REEMPLAZA se avisan en su seccion:
--        - los triggers de auth.users (seccion 9), porque la version vieja
--          esta rota y bloquea el registro de usuarios;
--        - el tipo de las columnas de firma facial (seccion 8), de vector(128)
--          a jsonb, preservando los datos.
--
--  DESPUES DE CORRERLO: al final hay dos consultas de verificacion.
-- ============================================================


-- ============================================================
--  1. FUNCION AUXILIAR (la usan varios triggers de updated_at)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
--  2. USUARIOS — columnas que el login necesita
--
--  AuthContext.tsx:86-98 selecciona auth_user_id, telefono y empresa. Si
--  falta cualquiera, el login falla entero. Ningun CREATE TABLE usuarios del
--  repo las incluye: solo aparecen en FIX_DATABASE_COMPLETE.sql.
-- ============================================================
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE
  REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS telefono   varchar(30);
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS empresa    varchar(150);
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON public.usuarios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email        ON public.usuarios(email);


-- ============================================================
--  3. CLIENTES
-- ============================================================
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS usuario_id bigint
  REFERENCES public.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_usuario ON public.clientes(usuario_id);


-- ============================================================
--  4. COMENTARIOS / SOLICITUDES — el nucleo del callcenter
--
--  Solicitudes.tsx:123-127,175,188-190 y Comentarios.tsx:112-115 usan estas
--  columnas. Solo estan en MIGRATION_COMPLETA.sql.
-- ============================================================
ALTER TABLE public.comentarios ADD COLUMN IF NOT EXISTS tipo              varchar(30) DEFAULT 'comentario';
ALTER TABLE public.comentarios ADD COLUMN IF NOT EXISTS usuario_id        bigint REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.comentarios ADD COLUMN IF NOT EXISTS prioridad         varchar(20) DEFAULT 'media';
ALTER TABLE public.comentarios ADD COLUMN IF NOT EXISTS respuesta         text;
ALTER TABLE public.comentarios ADD COLUMN IF NOT EXISTS respuesta_admin_id bigint REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.comentarios ADD COLUMN IF NOT EXISTS respuesta_fecha   timestamptz;
ALTER TABLE public.comentarios ADD COLUMN IF NOT EXISTS asignado_a        bigint REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.comentarios ADD COLUMN IF NOT EXISTS visto             boolean DEFAULT false;
ALTER TABLE public.comentarios ADD COLUMN IF NOT EXISTS visto_fecha       timestamptz;

-- Faltaba: Comentarios.tsx y Solicitudes.tsx filtran por usuario en cada carga.
CREATE INDEX IF NOT EXISTS idx_comentarios_usuario   ON public.comentarios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_asignado  ON public.comentarios(asignado_a);
CREATE INDEX IF NOT EXISTS idx_comentarios_tipo_est  ON public.comentarios(tipo, estado);


-- ============================================================
--  5. ANALISIS NLP
-- ============================================================
ALTER TABLE public.analisis_nlp ADD COLUMN IF NOT EXISTS sentimiento varchar(30);

-- Faltaba: ReportesNLP.tsx:27 ordena por esta columna.
CREATE INDEX IF NOT EXISTS idx_analisis_nlp_fecha ON public.analisis_nlp(fecha_analisis DESC);


-- ============================================================
--  6. TABLAS QUE EL CODIGO USA Y SOLO EXISTEN EN SCRIPTS SUELTOS
-- ============================================================

-- dashboard.tsx:77-91, Notificaciones.tsx, AuthContext.tsx:325
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id            bigserial PRIMARY KEY,
  tipo          varchar(50)  NOT NULL,
  titulo        varchar(200) NOT NULL,
  mensaje       text,
  enlace        varchar(300),
  leida         boolean DEFAULT false,
  usuario_email varchar(150),
  created_at    timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_email ON public.notificaciones(usuario_email);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON public.notificaciones(leida, created_at DESC);

-- ClientesHistorial.tsx:33,115-117
CREATE TABLE IF NOT EXISTS public.historial_clientes (
  id          bigserial PRIMARY KEY,
  cliente_id  bigint REFERENCES public.clientes(id) ON DELETE CASCADE,
  accion      varchar(100) NOT NULL,
  detalles    text,
  usuario_id  bigint REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_historial_clientes_cliente ON public.historial_clientes(cliente_id);

-- Solicitudes.tsx:99,210-212 — encuesta CSAT de 1 a 5
CREATE TABLE IF NOT EXISTS public.satisfaccion (
  id             bigserial PRIMARY KEY,
  comentario_id  bigint REFERENCES public.comentarios(id) ON DELETE CASCADE,
  calificacion   smallint CHECK (calificacion BETWEEN 1 AND 5),
  observacion    text,
  created_at     timestamptz DEFAULT NOW()
);
-- Faltaba: la tabla se creaba sin ningun indice.
CREATE INDEX IF NOT EXISTS idx_satisfaccion_comentario ON public.satisfaccion(comentario_id);

-- Solicitudes.tsx:106,135,165 — linea de tiempo del ticket
CREATE TABLE IF NOT EXISTS public.historial_estados (
  id             bigserial PRIMARY KEY,
  comentario_id  bigint REFERENCES public.comentarios(id) ON DELETE CASCADE,
  estado_anterior varchar(30),
  estado_nuevo   varchar(30) NOT NULL,
  usuario_id     bigint REFERENCES public.usuarios(id) ON DELETE SET NULL,
  nota           text,
  created_at     timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_historial_estados_comentario ON public.historial_estados(comentario_id, created_at);

-- FAQ.tsx:15
CREATE TABLE IF NOT EXISTS public.faq (
  id         bigserial PRIMARY KEY,
  pregunta   text NOT NULL,
  respuesta  text NOT NULL,
  categoria  varchar(80),
  orden      integer DEFAULT 0,
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW()
);


-- ============================================================
--  7. OPTIMIZACIONES Y AUDITORIA — reconciliar esquemas en conflicto
--
--  Habia DOS formas incompatibles de `optimizaciones` en el repo:
--    001_schema.sql:94    -> nombre + parametros_entrada + costo_inicial/optimizado
--    SUPABASE_SETUP_COMPLETO -> tipo + resultado + usuario_id
--  El frontend (Optimizacion.tsx:69-76) usa la PRIMERA. Aqui se agregan las
--  columnas de ambas y se relajan los NOT NULL, para que funcione sobre
--  cualquiera de las dos formas que tengas instalada.
-- ============================================================
ALTER TABLE public.optimizaciones ADD COLUMN IF NOT EXISTS nombre             varchar(150);
ALTER TABLE public.optimizaciones ADD COLUMN IF NOT EXISTS descripcion        text;
ALTER TABLE public.optimizaciones ADD COLUMN IF NOT EXISTS parametros_entrada jsonb;
ALTER TABLE public.optimizaciones ADD COLUMN IF NOT EXISTS resultado          jsonb;
ALTER TABLE public.optimizaciones ADD COLUMN IF NOT EXISTS costo_inicial      numeric(14,4);
ALTER TABLE public.optimizaciones ADD COLUMN IF NOT EXISTS costo_optimizado   numeric(14,4);
ALTER TABLE public.optimizaciones ADD COLUMN IF NOT EXISTS estado             varchar(30) DEFAULT 'pendiente';
-- Perfil.tsx:188 y Usuarios.tsx borran por usuario; sin esta columna no llegan.
ALTER TABLE public.optimizaciones ADD COLUMN IF NOT EXISTS usuario_id         bigint REFERENCES public.usuarios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_optimizaciones_usuario ON public.optimizaciones(usuario_id);

-- Relajar NOT NULL de las columnas de la forma vieja: si la tabla tiene
-- `tipo NOT NULL`, el insert de Optimizacion.tsx falla con error 23502.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='optimizaciones'
      AND is_nullable='NO' AND column_default IS NULL
      AND column_name NOT IN ('id')
  LOOP
    EXECUTE format('ALTER TABLE public.optimizaciones ALTER COLUMN %I DROP NOT NULL', c.column_name);
    RAISE NOTICE 'optimizaciones.% ya admite NULL', c.column_name;
  END LOOP;
END $$;

-- services/audit.ts:19-28 escribe estas columnas desde TODAS las paginas.
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS usuario_email    varchar(150);
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS datos_anteriores jsonb;
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS datos_nuevos     jsonb;
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS modulo           varchar(80);
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS ip               varchar(60);
ALTER TABLE public.auditoria ADD COLUMN IF NOT EXISTS registro_id      bigint;

CREATE INDEX IF NOT EXISTS idx_auditoria_created ON public.auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria(usuario_id);


-- ============================================================
--  8. ROSTROS — escaner facial de 478 puntos
--
--  ESTA ES LA SECCION QUE ARREGLA "expected 128 dimensions, not 339".
--
--  FIX_DATABASE_COMPLETE.sql:23 creo embedding_frontal/izquierda/derecha como
--  vector(128), porque el sistema anterior usaba los descriptores de 128
--  numeros de face-api.js. El sistema de 478 puntos guarda 339 valores, asi que
--  Postgres rechaza el INSERT.
--
--  Un "ADD COLUMN IF NOT EXISTS ... jsonb" NO lo arregla: la columna ya existe,
--  solo con el tipo equivocado, y la orden se salta en silencio.
--
--  LOS DATOS NO SE PIERDEN: el texto de un vector de pgvector es "[1,2,3]", que
--  ya es JSON valido. Pero NO son comparables con el sistema nuevo (128 valores
--  vs 339, y otra normalizacion): el login los detecta por longitud y avisa de
--  que hay que volver a registrar el rostro. No hay falsos positivos.
-- ============================================================

-- 8a. Convertir a jsonb lo que tenga otro tipo
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rostros'
      AND column_name IN (
        'embedding_frontal','embedding_izquierda','embedding_derecha',
        'face_signature','landmarks_478','landmarks_68','blendshapes',
        'medidas_3d','metadata','embedding')
  LOOP
    IF r.data_type = 'jsonb' THEN
      CONTINUE;
    ELSIF r.udt_name = 'vector' THEN
      EXECUTE format('ALTER TABLE public.rostros ALTER COLUMN %I TYPE jsonb USING %I::text::jsonb',
                     r.column_name, r.column_name);
      RAISE NOTICE 'rostros.% convertida de vector a jsonb', r.column_name;
    ELSIF r.data_type = 'ARRAY' THEN
      EXECUTE format('ALTER TABLE public.rostros ALTER COLUMN %I TYPE jsonb USING to_jsonb(%I)',
                     r.column_name, r.column_name);
      RAISE NOTICE 'rostros.% convertida de array a jsonb', r.column_name;
    ELSIF r.data_type IN ('text','character varying','json') THEN
      EXECUTE format('ALTER TABLE public.rostros ALTER COLUMN %I TYPE jsonb USING NULLIF(%I::text, '''')::jsonb',
                     r.column_name, r.column_name);
      RAISE NOTICE 'rostros.% convertida de % a jsonb', r.column_name, r.data_type;
    ELSE
      RAISE WARNING 'rostros.% tiene tipo % y no se convirtio', r.column_name, r.data_type;
    END IF;
  END LOOP;
END $$;

-- 8b. Crear lo que falte, ya como jsonb
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS embedding_frontal   jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS embedding_izquierda jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS embedding_derecha   jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS face_signature      jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS landmarks_478       jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS blendshapes         jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS medidas_3d          jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS metadata            jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS landmarks_68        jsonb;
ALTER TABLE public.rostros ADD COLUMN IF NOT EXISTS forma_rostro        varchar(50);

-- 8c. `embedding` era NOT NULL en migraciones antiguas y bloquea el insert
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='rostros'
               AND column_name='embedding' AND is_nullable='NO') THEN
    ALTER TABLE public.rostros ALTER COLUMN embedding DROP NOT NULL;
    RAISE NOTICE 'rostros.embedding ya admite NULL';
  END IF;
END $$;

-- 8d. Retirar la funcion de busqueda del sistema de 128 dimensiones.
--     Usaba el operador <=> de pgvector sobre columnas que ahora son jsonb, asi
--     que fallaria en ejecucion. El emparejamiento del sistema de 478 puntos se
--     hace en el navegador (comparePoseSets en services/mediaPipeFace.ts).
--     Se busca en el catalogo para no nombrar el tipo `vector`, que abortaria
--     todo el script si pgvector no estuviera instalado.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT oid::regprocedure AS firma FROM pg_proc
           WHERE proname='buscar_rostro_match' AND pronamespace='public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION ' || f.firma;
    RAISE NOTICE 'Funcion % eliminada (era del sistema de 128 dimensiones)', f.firma;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_rostros_usuario ON public.rostros(usuario_id);

COMMENT ON COLUMN public.rostros.embedding_frontal IS
  'Firma facial de la pose frontal: 339 valores (113 landmarks x 3) normalizados';
COMMENT ON COLUMN public.rostros.landmarks_478 IS
  '478 landmarks normalizados [x,y,z,...] = 1434 valores — MediaPipe Face Mesh';
COMMENT ON COLUMN public.rostros.medidas_3d IS
  'Medidas 3D en unidades interoculares: ancho y relieve de pomulos, hueco de '
  'mejillas, proyeccion de nariz, profundidad de cuencas, etc.';


-- ============================================================
--  9. TRIGGERS DE auth.users  ***LA UNICA SECCION QUE REEMPLAZA ALGO***
--
--  La version de SUPABASE_SETUP_COMPLETO.sql:278 hace NEW.id::bigint sobre el
--  UUID de auth.users. Eso revienta y BLOQUEA EL REGISTRO DE USUARIOS.
--  Esta es la version correcta (de 006_auth_fk_fix.sql), que usa auth_user_id.
--
--  Si tu registro de usuarios YA funciona, puedes saltarte esta seccion.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

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
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
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
    UPDATE public.usuarios SET email = NEW.email, updated_at = NOW()
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

-- FK de rostros -> usuarios
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name='rostros_usuario_id_fkey' AND table_name='rostros') THEN
    ALTER TABLE public.rostros ADD CONSTRAINT rostros_usuario_id_fkey
      FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ============================================================
--  10. MACHINE LEARNING — tabla para guardar modelos entrenados
--
--  Hoy no existe en ningun .sql. Hace falta para que una Edge Function entrene
--  un clasificador con las filas reales de `comentarios` y guarde los pesos,
--  en vez de reentrenar en cada invocacion.
--
--  El clasificador Naive Bayes ya esta escrito en
--  supabase/functions/nltk-clasificar/index.ts:63-99, pero entrena con 61
--  frases fijas en el codigo y NADIE LO LLAMA. Esta tabla es el paso para
--  convertirlo en un modelo de verdad, entrenado con sus propios datos.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.modelos_ml (
  id           bigserial PRIMARY KEY,
  tipo         varchar(60) NOT NULL,   -- 'clasificador-tickets', 'eta-atencion', 'riesgo-sla'
  version      integer     NOT NULL DEFAULT 1,
  pesos        jsonb       NOT NULL,   -- parametros aprendidos
  metricas     jsonb,                  -- exactitud, precision, recall, matriz de confusion
  n_ejemplos   integer,                -- con cuantas filas se entreno
  entrenado_en timestamptz DEFAULT NOW(),
  activo       boolean     DEFAULT true,
  UNIQUE (tipo, version)
);
CREATE INDEX IF NOT EXISTS idx_modelos_ml_activo ON public.modelos_ml(tipo, activo, version DESC);

COMMENT ON TABLE public.modelos_ml IS
  'Pesos y metricas de los modelos entrenados con los datos del propio sistema. '
  'metricas debe guardar resultados de un split train/test real, no constantes.';


-- ============================================================
--  11. TIEMPO REAL (guardado en vivo)
--
--  Repetir ALTER PUBLICATION sobre una tabla ya publicada da error, asi que se
--  comprueba antes tabla por tabla.
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rostros','comentarios','notificaciones','solicitudes',
                           'satisfaccion','historial_estados','analisis_nlp']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t)
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                       WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t)
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'tabla % anadida a supabase_realtime', t;
    END IF;
  END LOOP;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'La publicacion supabase_realtime no existe; se omite el tiempo real';
END $$;


-- ============================================================
--  12. VERIFICACION — revisa la salida de estas dos consultas
-- ============================================================

-- 12a. Las columnas de firma facial DEBEN salir todas 'jsonb'.
--      Si alguna dice 'USER-DEFINED' o 'vector', la seccion 8 no se aplico.
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='rostros'
  AND column_name IN ('embedding_frontal','embedding_izquierda','embedding_derecha',
                      'face_signature','landmarks_478','medidas_3d','metadata')
ORDER BY column_name;

-- 12b. Todas estas tablas deben existir (existe = true).
SELECT t.tabla,
       EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t.tabla) AS existe
FROM (VALUES ('usuarios'),('clientes'),('comentarios'),('analisis_nlp'),('categorias'),
             ('rostros'),('auditoria'),('notificaciones'),('historial_clientes'),
             ('satisfaccion'),('historial_estados'),('faq'),('optimizaciones'),
             ('tiempos_atencion'),('modelos_ml')) AS t(tabla)
ORDER BY existe, t.tabla;


-- ============================================================
--  PENDIENTE DE SEGURIDAD — NO LO HACE ESTE SCRIPT
--
--  RLS (row level security) esta DESHABILITADO en todas las tablas
--  (database/003_rls_policies.sql:7-15). Con la clave anon, que es publica por
--  diseno y viaja en el JavaScript, cualquiera puede leer y escribir todo,
--  incluidas las plantillas faciales de la tabla `rostros`.
--
--  No se habilita aqui a proposito: activar RLS sin escribir antes las
--  politicas dejaria la aplicacion sin acceso a nada y todo dejaria de
--  funcionar de golpe. Es un trabajo aparte, tabla por tabla.
-- ============================================================
