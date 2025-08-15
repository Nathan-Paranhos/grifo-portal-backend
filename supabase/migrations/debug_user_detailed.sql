-- Debug detalhado do usuário grifo.admin@teste.com

-- 1. Verificar se existe no Supabase Auth
SELECT 'AUTH USERS' as table_name, id, email, created_at, email_confirmed_at
FROM auth.users 
WHERE email = 'grifo.admin@teste.com';

-- 2. Verificar se existe na tabela portal_users
SELECT 'PORTAL USERS' as table_name, id, auth_user_id, email, nome, ativo, empresa_id, created_at
FROM portal_users 
WHERE email = 'grifo.admin@teste.com';

-- 3. Verificar se existe na tabela portal_users por auth_user_id
SELECT 'PORTAL USERS BY AUTH_ID' as table_name, pu.id, pu.auth_user_id, pu.email, pu.nome, pu.ativo, pu.empresa_id
FROM portal_users pu
INNER JOIN auth.users au ON pu.auth_user_id = au.id
WHERE au.email = 'grifo.admin@teste.com';

-- 4. Verificar empresa associada
SELECT 'EMPRESA INFO' as table_name, e.id, e.nome, e.created_at
FROM empresas e
INNER JOIN portal_users pu ON e.id = pu.empresa_id
INNER JOIN auth.users au ON pu.auth_user_id = au.id
WHERE au.email = 'grifo.admin@teste.com';

-- 5. Verificar JOIN completo como na consulta da API
SELECT 'FULL JOIN TEST' as table_name, 
       pu.id, pu.nome, pu.email, pu.role, pu.permissions, pu.ativo, pu.empresa_id,
       e.id as empresa_id_join, e.nome as empresa_nome
FROM portal_users pu
INNER JOIN empresas e ON pu.empresa_id = e.id
INNER JOIN auth.users au ON pu.auth_user_id = au.id
WHERE au.email = 'grifo.admin@teste.com' AND pu.ativo = true;