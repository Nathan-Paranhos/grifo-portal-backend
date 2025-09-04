-- Verificar se o usuário foi criado corretamente

-- 1. Verificar usuário no auth.users
SELECT 
    'auth.users' as tabela,
    id::text,
    email,
    (encrypted_password IS NOT NULL)::text as has_password,
    (email_confirmed_at IS NOT NULL)::text as email_confirmed,
    created_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com'

UNION ALL

-- 2. Verificar usuário no public.users
SELECT 
    'public.users' as tabela,
    id::text,
    email,
    (password_hash IS NOT NULL)::text as has_password,
    is_active::text as email_confirmed,
    created_at
FROM public.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 3. Verificar correspondência entre as tabelas
SELECT 
    'Correspondência' as info,
    au.email as auth_email,
    pu.email as public_email,
    au.id::text as auth_id,
    pu.auth_user_id::text as linked_auth_id,
    (au.id = pu.auth_user_id) as ids_match,
    pu.is_active,
    pu.status,
    pu.user_type
FROM auth.users au
FULL OUTER JOIN public.users pu ON au.id = pu.auth_user_id
WHERE au.email = 'paranhoscontato.n@gmail.com' OR pu.email = 'paranhoscontato.n@gmail.com';

-- 4. Testar hash da senha
SELECT 
    'Teste de senha' as info,
    email,
    (password_hash = crypt('123456789', password_hash)) as senha_correta
FROM public.users 
WHERE email = 'paranhoscontato.n@gmail.com'