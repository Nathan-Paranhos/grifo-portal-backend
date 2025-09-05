-- Verificar dados do usuário super admin criado
-- Email: paranhoscontato.n@gmail.com

-- 1. Verificar na tabela auth.users
SELECT 
    'auth.users' as tabela,
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 2. Verificar na tabela public.users
SELECT 
    'public.users' as tabela,
    id,
    email,
    nome,
    role,
    user_type,
    auth_user_id,
    first_login_completed,
    is_active,
    status,
    created_at
FROM public.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 3. Verificar na tabela public.portal_users
SELECT 
    'public.portal_users' as tabela,
    id,
    email,
    nome,
    role,
    auth_user_id,
    first_login_completed,
    ativo,
    created_at
FROM public.portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 4. Verificar se há correspondência entre as tabelas
SELECT 
    'Correspondência entre tabelas' as verificacao,
    au.email as auth_email,
    pu.email as public_users_email,
    ppu.email as portal_users_email,
    au.id as auth_id,
    pu.auth_user_id as public_auth_id,
    ppu.auth_user_id as portal_auth_id
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_user_id
LEFT JOIN public.portal_users ppu ON au.id = ppu.auth_user_id
WHERE au.email = 'paranhoscontato.n@gmail.com';

-- 5. Verificar identities (método de autenticação)
SELECT 
    'auth.identities' as tabela,
    id,
    user_id,
    provider,
    identity_data,
    created_at
FROM auth.identities 
WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com'
);