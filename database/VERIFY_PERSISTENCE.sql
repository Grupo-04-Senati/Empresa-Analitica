-- VERIFY_PERSISTENCE.sql
-- Run these queries in Supabase SQL Editor to verify data persistence

-- 1. Check if table is UNLOGGED (should be 'p' for permanent)
SELECT relname, relpersistence 
FROM pg_class 
WHERE relname = 'rostros';

-- 2. Check for any triggers that might delete data
SELECT 
  t.tgname AS trigger_name,
  t.tgenabled AS enabled,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'rostros'::regclass;

-- 3. Check for scheduled cron jobs (requires pg_cron extension)
SELECT * FROM cron.job;

-- 4. Check row count and data integrity
SELECT 
  COUNT(*) as total_rows,
  COUNT(DISTINCT usuario_id) as unique_users,
  COUNT(embedding_frontal) as has_frontal,
  COUNT(embedding_izquierda) as has_izquierda,
  COUNT(embedding_derecha) as has_derecha,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM rostros;

-- 5. Check embedding dimensions (should be 128)
SELECT 
  usuario_id,
  jsonb_array_length(embedding_frontal) as frontal_dims,
  jsonb_array_length(embedding_izquierda) as izq_dims,
  jsonb_array_length(embedding_derecha) as der_dims
FROM rostros
LIMIT 5;

-- 6. Verify embeddings are L2-normalized (norm should be ~1.0)
-- This checks a sample embedding
SELECT 
  usuario_id,
  embedding_frontal,
  -- Calculate L2 norm of embedding_frontal
  sqrt(
    (SELECT sum(v * v) FROM jsonb_array_elements_text(embedding_frontal) AS v)
  ) as frontal_norm
FROM rostros
LIMIT 3;
