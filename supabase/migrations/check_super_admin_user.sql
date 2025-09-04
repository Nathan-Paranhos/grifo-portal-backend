-- Verificar se o super admin existe no sistema
SELECT 
  'portal_users' as tabela,
  id,
  email,
  nome,
  role,
  ativo,
  first_login_completed,
  created_at
FROM portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar também na tabela auth.users
SELECT 
  'auth.users' as tabela,
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Listar todos os usuários do portal para debug
SELECT 
  'todos_portal_users' as info,
  COUNT(*) as total_usuarios
FROM portal_users;

SELECT 
  'usuarios_portal_detalhes' as info,
  email,
  nome,
  role,
  ativo
FROM portal_users 
ORDER BY created_at DESC
LIMIT 10;