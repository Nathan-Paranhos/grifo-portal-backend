-- Listar todos os usuários do portal para debug
SELECT 
  'portal_users' as fonte,
  id,
  email,
  nome,
  role,
  ativo,
  first_login_completed,
  auth_user_id,
  created_at
FROM portal_users 
ORDER BY created_at DESC;

-- Verificar usuários na tabela auth.users
SELECT 
  'auth_users' as fonte,
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users 
ORDER BY created_at DESC
LIMIT 10;

-- Contar total de usuários
SELECT 
  'contadores' as info,
  (SELECT COUNT(*) FROM portal_users) as total_portal_users,
  (SELECT COUNT(*) FROM auth.users) as total_auth_users;

-- Verificar se existe o email específico
SELECT 
  'verificacao_email' as info,
  EXISTS(SELECT 1 FROM portal_users WHERE email = 'paranhoscontato.n@gmail.com') as existe_portal,
  EXISTS(SELECT 1 FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com') as existe_auth;