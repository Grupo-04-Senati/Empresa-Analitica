-- LINK_CLIENTS_TO_USERS.sql
-- Agrega usuario_id a clientes para enlazar con usuarios

-- 1. Agregar columna usuario_id
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL;

-- 2. Crear indice para busquedas rapidas
CREATE INDEX IF NOT EXISTS idx_clientes_usuario ON clientes(usuario_id);

-- 3. Sincronizar: enlazar clientes existentes con usuarios por email
UPDATE clientes c
SET usuario_id = u.id
FROM usuarios u
WHERE c.email = u.email
  AND c.usuario_id IS NULL;

-- 4. Eliminar clientes duplicados (misimo usuario_id)
DELETE FROM clientes
WHERE id NOT IN (
  SELECT MIN(id)
  FROM clientes
  WHERE usuario_id IS NOT NULL
  GROUP BY usuario_id
);

-- 5. Verificar resultado
SELECT 
  c.id,
  c.nombre,
  c.email,
  c.usuario_id,
  u.rol,
  c.activo
FROM clientes c
LEFT JOIN usuarios u ON c.usuario_id = u.id
ORDER BY c.created_at DESC;
