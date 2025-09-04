-- Verificar se o usuário de teste existe e está configurado corretamente

-- 1. Verificar usuário no Supabase Auth
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 2. Verificar usuário na tabela users
SELECT 
    id,
    email,
    nome,
    name,
    user_type,
    role,
    is_active,
    status,
    auth_user_id,
    tenant_slug,
    created_at
FROM public.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 3. Verificar se há correspondência entre auth.users e public.users
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    pu.id as user_id,
    pu.email as user_email,
    pu.auth_user_id,
    pu.is_active,
    pu.status,
    pu.user_type,
    pu.role
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_user_id
WHERE au.email = 'paranhoscontato.n@gmail.com';

-- 4. Verificar permissões da tabela users
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'users'
    AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee