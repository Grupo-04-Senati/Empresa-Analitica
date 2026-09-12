-- CLEANUP_TEST_DATA.sql
-- Run this in Supabase SQL Editor to remove test data

-- 1. Delete all test data from clientes (keep only real registered users)
DELETE FROM clientes;

-- 2. Re-insert real users from usuarios table as clientes
INSERT INTO clientes (nombre, email, telefono, empresa, activo, created_at)
SELECT 
  nombre, 
  email, 
  telefono, 
  empresa, 
  activo,
  created_at
FROM usuarios 
WHERE rol IN ('USUARIO', 'usuario')
ON CONFLICT (email) DO NOTHING;

-- 3. Verify the result
SELECT COUNT(*) as total_clientes FROM clientes;
SELECT nombre, email, activo FROM clientes ORDER BY created_at DESC;
