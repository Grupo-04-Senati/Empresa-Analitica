-- ============================================================
-- MIGRACIÓN: Agregar metadatos faltantes y enlazar tablas
-- Base de datos: Supabase (NEXUS Corp)
-- Fecha: 2026-09-09
-- ============================================================

-- 1. Agregar usuario_id a optimizaciones (para enlazar con usuarios)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'optimizaciones' AND column_name = 'usuario_id'
  ) THEN
    ALTER TABLE optimizaciones ADD COLUMN usuario_id BIGINT;
    ALTER TABLE optimizaciones
      ADD CONSTRAINT optimizaciones_usuario_id_fk
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
    CREATE INDEX idx_optimizaciones_usuario_id ON optimizaciones(usuario_id);
    RAISE NOTICE '✅ Columna usuario_id agregada a optimizaciones';
  ELSE
    RAISE NOTICE 'ℹ️ optimizaciones.usuario_id ya existe';
  END IF;
END $$;

-- 2. Agregar created_at a optimizaciones si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'optimizaciones' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE optimizaciones ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    RAISE NOTICE '✅ Columna created_at agregada a optimizaciones';
  END IF;
END $$;

-- 3. Verificar y agregar updated_at a usuarios si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    RAISE NOTICE '✅ Columna updated_at agregada a usuarios';
  END IF;
END $$;

-- 4. Verificar y agregar avatar_url a usuarios si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN avatar_url TEXT;
    RAISE NOTICE '✅ Columna avatar_url agregada a usuarios';
  END IF;
END $$;

-- 5. Agregar foto_preview a rostros si no existe (para almacenar preview)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rostros' AND column_name = 'foto_preview'
  ) THEN
    ALTER TABLE rostros ADD COLUMN foto_preview TEXT;
    RAISE NOTICE '✅ Columna foto_preview agregada a rostros';
  END IF;
END $$;

-- 6. Crear tabla de metadatos de sesiones faciales (opcional, para auditoría)
CREATE TABLE IF NOT EXISTS face_sessions (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
  accion VARCHAR(20) NOT NULL, -- 'register' o 'login'
  exitoso BOOLEAN DEFAULT false,
  distancia NUMERIC(5,4),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_face_sessions_usuario_id ON face_sessions(usuario_id);
CREATE INDEX IF NOT EXISTS idx_face_sessions_created_at ON face_sessions(created_at);

-- 7. Agregar trigger para updated_at en usuarios
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 8. Habilitar RLS en face_sessions (pero sin restricciones por ahora)
ALTER TABLE face_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on face_sessions" ON face_sessions FOR ALL USING (true);

-- 9. Verificar estructura final de todas las tablas
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('usuarios', 'rostros', 'clientes', 'comentarios', 'categorias',
                      'optimizaciones', 'tiempos_atencion', 'notificaciones',
                      'auditoria', 'metricas_estadisticas', 'analisis_nlp', 'face_sessions')
ORDER BY table_name, ordinal_position;

-- 10. Verificar foreign keys
SELECT
  tc.table_name AS tabla_origen,
  kcu.column_name AS columna_origen,
  ccu.table_name AS tabla_destino,
  ccu.column_name AS columna_destino
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
