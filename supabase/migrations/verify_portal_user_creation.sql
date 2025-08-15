-- Verificar se o usuário foi criado corretamente na tabela portal_users

-- Verificar usuário por auth_user_id
SELECT 'USER BY AUTH_ID' as check_type, 
       id, auth_user_id, email, nome, ativo, empresa_id, role
FROM portal_users 
WHERE auth_user_id = '424e8e60-5b18-46d4-91e2-80baa090f523';

-- Verificar usuário por email
SELECT 'USER BY EMAIL' as check_type,
       id, auth_user_id, email, nome, ativo, empresa_id, role
FROM portal_users 
WHERE email = 'grifo.admin@teste.com';

-- Verificar todos os usuários na tabela
SELECT 'ALL USERS' as check_type,
       id, auth_user_id, email, nome, ativo, empresa_id, role
FROM portal_users 
ORDER BY created_at DESC
LIMIT 10;

-- Verificar se existe na tabela auth.users do Supabase
SELECT 'AUTH USERS' as check_type,
       id, email, email_confirmed_at, created_at
FROM auth.users 
WHERE email = 'grifo.admin@teste.com';

-- Verificar empresas disponíveis
SELECT 'COMPANIES' as check_type,
       id, nome, cnpj
FROM empresas
LIMIT 5;