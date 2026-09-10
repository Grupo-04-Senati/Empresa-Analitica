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
BEGIN
  RETURN QUERY
  WITH distancias AS (
    SELECT
      r.usuario_id,
      (login_embedding <=> r.embedding_frontal) AS dist_frontal,
      (login_embedding <=> r.embedding_izquierda) AS dist_izquierda,
      (login_embedding <=> r.embedding_derecha) AS dist_derecha,
      (
        (login_embedding <=> r.embedding_frontal) +
        (login_embedding <=> r.embedding_izquierda) +
        (login_embedding <=> r.embedding_derecha)
      ) / 3.0 AS dist_promedio
    FROM rostros r
  )
  SELECT
    d.usuario_id,
    d.dist_frontal,
    d.dist_izquierda,
    d.dist_derecha,
    d.dist_promedio,
    (
      d.dist_promedio < p_umbral
      AND (
        (SELECT MIN(d2.dist_promedio) FROM distancias d2 WHERE d2.usuario_id != d.usuario_id)
        - d.dist_promedio
      ) > p_margen
    ) AS es_match
  FROM distancias d
  ORDER BY d.dist_promedio ASC
  LIMIT 1;
END;
$$;


-- ============================================================
-- PASO 2: Crear índices HNSW para búsqueda eficiente
-- ============================================================

CREATE INDEX idx_rostros_frontal_hnsw ON rostros USING hnsw (embedding_frontal vector_cosine_ops);
CREATE INDEX idx_rostros_izq_hnsw ON rostros USING hnsw (embedding_izquierda vector_cosine_ops);
CREATE INDEX idx_rostros_der_hnsw ON rostros USING hnsw (embedding_derecha vector_cosine_ops);


-- ============================================================
-- PASO 3: Verificar que todo funciona
-- ============================================================

-- Verificar función
SELECT proname FROM pg_proc WHERE proname = 'buscar_rostro_match';

-- Verificar índices
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'rostros';
