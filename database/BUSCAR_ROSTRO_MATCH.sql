-- ============================================================
-- PASO 1: Crear función buscar_rostro_match
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

CREATE OR REPLACE FUNCTION buscar_rostro_match(
  login_embedding vector(128),
  p_umbral float DEFAULT 0.22,
  p_margen float DEFAULT 0.05
)
RETURNS TABLE (
  usuario_id bigint,
  dist_frontal float,
  dist_izquierda float,
  dist_derecha float,
  dist_promedio float,
  es_match boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  candidatos record;
  mejor_dist float := 999;
  segundo_dist float := 999;
  mejor_uid bigint;
BEGIN
  RETURN QUERY
  WITH distances AS (
    SELECT
      r.usuario_id,
      CASE WHEN r.embedding_frontal IS NOT NULL
        THEN r.embedding_frontal <=> login_embedding
        ELSE NULL
      END AS d_frontal,
      CASE WHEN r.embedding_izquierda IS NOT NULL
        THEN r.embedding_izquierda <=> login_embedding
        ELSE NULL
      END AS d_izquierda,
      CASE WHEN r.embedding_derecha IS NOT NULL
        THEN r.embedding_derecha <=> login_embedding
        ELSE NULL
      END AS d_derecha
    FROM rostros r
  ),
  scored AS (
    SELECT
      d.usuario_id,
      d.d_frontal,
      d.d_izquierda,
      d.d_derecha,
      (
        COALESCE(d.d_frontal, 999) +
        COALESCE(d.d_izquierda, 999) +
        COALESCE(d.d_derecha, 999)
      ) / NULLIF(
        (CASE WHEN d.d_frontal IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN d.d_izquierda IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN d.d_derecha IS NOT NULL THEN 1 ELSE 0 END)
      , 0) AS dist_promedio
    FROM distances d
  ),
  ranked AS (
    SELECT
      s.*,
      ROW_NUMBER() OVER (ORDER BY s.dist_promedio ASC) AS rn
    FROM scored s
    WHERE s.dist_promedio < 900
  )
  SELECT
    r.usuario_id,
    LEAST(COALESCE(r.d_frontal, 999), 999)::float,
    LEAST(COALESCE(r.d_izquierda, 999), 999)::float,
    LEAST(COALESCE(r.d_derecha, 999), 999)::float,
    r.dist_promedio::float,
    CASE
      WHEN r.rn = 1 AND r.dist_promedio <= p_umbral THEN
        NOT EXISTS (
          SELECT 1 FROM ranked r2
          WHERE r2.rn = 2
          AND (r.dist_promedio - r2.dist_promedio) < p_margen
        )
      ELSE false
    END AS es_match
  FROM ranked r
  WHERE r.rn <= 2
  ORDER BY r.dist_promedio ASC;
END; $$;


-- ============================================================
-- PASO 2: Crear índice HNSW para búsqueda eficiente
-- ============================================================

DROP INDEX IF EXISTS idx_rostros_frontal_hnsw;
DROP INDEX IF EXISTS idx_rostros_izq_hnsw;
DROP INDEX IF EXISTS idx_rostros_der_hnsw;

CREATE INDEX idx_rostros_frontal_hnsw
  ON rostros USING hnsw (embedding_frontal vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_rostros_izq_hnsw
  ON rostros USING hnsw (embedding_izquierda vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_rostros_der_hnsw
  ON rostros USING hnsw (embedding_derecha vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);


-- ============================================================
-- PASO 3: Verificar que todo funciona
-- ============================================================

-- Verificar índices
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'rostros';

-- Verificar función
SELECT proname FROM pg_proc WHERE proname = 'buscar_rostro_match';
