-- Corrigir o auth_user_id do usuário portal
UPDATE portal_users 
SET auth_user_id = '5fdf40c0-c145-4423-9c8f-5e82cfcfffcf'
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar se a correção foi aplicada
SELECT 
  id,
  auth_user_id,
  email,
  nome,
  role,
  empresa_id
FROM portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';