-- Verificar usuários na tabela auth.users
SELECT 
  id,
  email,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar todos os usuários auth para debug
SELECT 
  id,
  email,
  created_at
FROM auth.users 
ORDER BY created_at DESC
LIMIT 5;