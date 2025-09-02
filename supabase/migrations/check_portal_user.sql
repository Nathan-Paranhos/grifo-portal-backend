-- Script para verificar se o usuário existe na tabela portal_users
-- e testar conectividade com Supabase

-- 1. Verificar se o usuário existe na tabela portal_users
SELECT 
    id,
    email,
    nome,
    empresa_id,
    role,
    ativo,
    first_login_completed,
    auth_user_id,
    created_at,
    last_login
FROM portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 2. Verificar se existe usuário correspondente na tabela auth.users
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 3. Verificar se há relação entre as tabelas
SELECT 
    pu.id as portal_user_id,
    pu.email as portal_email,
    pu.nome,
    pu.ativo,
    au.id as auth_user_id,
    au.email as auth_email,
    au.email_confirmed_at,
    au.last_sign_in_at
FROM portal_users pu
LEFT JOIN auth.users au ON pu.auth_user_id = au.id
WHERE pu.email = 'paranhoscontato.n@gmail.com';

-- 4. Verificar total de usuários na tabela portal_users
SELECT COUNT(*) as total_portal_users FROM portal_users;

-- 5. Verificar total de usuários na tabela auth.users
SELECT COUNT(*) as total_auth_users FROM auth.users;