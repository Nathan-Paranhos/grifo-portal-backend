-- Verificar se existe usuário com auth_user_id correto
SELECT 
  id,
  auth_user_id,
  email,
  nome,
  role,
  empresa_id
FROM portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar se existe usuário com o auth_user_id do JWT
SELECT 
  id,
  auth_user_id,
  email,
  nome,
  role,
  empresa_id
FROM portal_users 
WHERE auth_user_id = '5fdf40c0-c145-4423-9c8f-5e82cfcfffcf';

-- Atualizar o auth_user_id se necessário
-- UPDATE portal_users 
-- SET auth_user_id = '5fdf40c0-c145-4423-9c8f-5e82cfcfffcf'
-- WHERE email = 'paranhoscontato.n@gmail.com';