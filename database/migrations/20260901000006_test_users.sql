-- ============================================================
-- NEXUS Corp · Centro Inteligente
-- Migracion: 006 - Usuarios de prueba
-- Fecha: 2026-09-01
-- ============================================================
-- Usuarios para testing:
--   Admin:     admin@nexus.com / admin123
--   Usuario:   usuario@nexus.com / usuario123
--   Analista:  analista@nexus.com / analista123
-- ============================================================

-- Funcion para insertar usuario de prueba si no existe
CREATE OR REPLACE FUNCTION insert_test_user(
  p_email TEXT,
  p_password TEXT,
  p_nombre TEXT,
  p_rol TEXT
) RETURNS VOID AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = p_email) INTO v_exists;
  
  IF NOT v_exists THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf')),
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      json_build_object('nombre', p_nombre, 'rol', p_rol),
      NOW(),
      NOW()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Insertar usuarios de prueba
SELECT insert_test_user('admin@nexus.com', 'admin123', 'Admin Principal', 'ADMIN');
SELECT insert_test_user('usuario@nexus.com', 'usuario123', 'Usuario Demo', 'USUARIO');
SELECT insert_test_user('analista@nexus.com', 'analista123', 'Ana Analista', 'ANALISTA');

-- Eliminar funcion auxiliar
DROP FUNCTION insert_test_user;

-- 4. PERFILES EN TABLA usuarios (sync manual por si el trigger no disparo)
INSERT INTO usuarios (id, nombre, email, password_hash, rol, activo)
SELECT 
  au.id::bigint,
  au.raw_user_meta_data->>'nombre',
  au.email,
  'auth_managed',
  COALESCE(au.raw_user_meta_data->>'rol', 'USUARIO'),
  true
FROM auth.users au
WHERE au.email IN ('admin@nexus.com', 'usuario@nexus.com', 'analista@nexus.com')
  AND NOT EXISTS (
    SELECT 1 FROM usuarios u WHERE u.email = au.email
  )
ON CONFLICT (email) DO NOTHING;
