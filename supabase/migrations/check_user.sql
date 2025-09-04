-- Verificar se o usuário existe na tabela portal_users
SELECT 
  email, 
  nome, 
  ativo, 
  first_login_completed,
  role,
  empresa_id
FROM portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar se o usuário existe na tabela auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';