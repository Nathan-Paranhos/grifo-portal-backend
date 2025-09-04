-- Verificar se existe usuário com o email fornecido
SELECT 
  id,
  email,
  nome,
  role,
  ativo,
  first_login_completed,
  created_at
FROM portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar também na tabela users
SELECT 
  id,
  email,
  nome,
  role,
  is_active,
  user_type,
  first_login_completed,
  created_at
FROM users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar na tabela auth.users do Supabase
SELECT 
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';