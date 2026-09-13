-- ============================================================
-- NEXUS Corp · Centro Inteligente
-- Migracion: 007 - Avatar de usuario
-- Fecha: 2026-09-05
-- ============================================================

-- Agregar columna avatar_url a la tabla usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;
