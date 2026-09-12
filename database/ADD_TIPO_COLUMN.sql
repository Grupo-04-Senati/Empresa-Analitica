-- Agregar columna tipo a comentarios para separar solicitudes de comentarios
ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'comentario';

-- Migrar datos existentes: todo lo que tiene estado pendiente/en_proceso/resuelto es solicitud
UPDATE comentarios SET tipo = 'solicitud' WHERE estado IN ('pendiente', 'en_proceso', 'resuelto') AND tipo = 'comentario';

-- Los que no tienen estado claro se mantienen como comentario
UPDATE comentarios SET tipo = 'comentario' WHERE tipo IS NULL;

-- Verificar
SELECT tipo, COUNT(*) FROM comentarios GROUP BY tipo;
