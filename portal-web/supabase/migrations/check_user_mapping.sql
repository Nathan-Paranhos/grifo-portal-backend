-- Verificar mapeamento entre auth.users e public.users

-- 1. Usuários em auth.users
SELECT 'Usuários em auth.users:' as info;
SELECT id, email, created_at, email_confirmed_at FROM auth.users 
WHERE email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com')
ORDER BY email;

-- 2. Usuários em public.users
SELECT 'Usuários em public.users:' as info;
SELECT id, auth_user_id, email, name, role, user_type, is_active FROM public.users 
WHERE email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com')
ORDER BY email;

-- 3. Verificar mapeamento completo
SELECT 'Mapeamento completo:' as info;
SELECT 
    au.email as auth_email,
    au.id as auth_user_id,
    au.email_confirmed_at,
    pu.id as public_user_id,
    pu.auth_user_id as mapped_auth_id,
    pu.email as public_email,
    pu.role,
    pu.user_type,
    pu.is_active,
    CASE 
        WHEN au.id = pu.auth_user_id THEN 'CORRETO'
        ELSE 'INCORRETO'
    END as mapeamento_status
FROM auth.users au
FULL OUTER JOIN public.users pu ON au.email = pu.email
WHERE au.email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com')
   OR pu.email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com')
ORDER BY COALESCE(au.email, pu.email);

-- 4. Verificar se há usuários órfãos
SELECT 'Usuários public.users sem auth correspondente:' as info;
SELECT pu.email, pu.auth_user_id, pu.role
FROM public.users pu
LEFT JOIN auth.users au ON pu.auth_user_id = au.id
WHERE au.id IS NULL
AND pu.email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com');

-- 5. Verificar se há usuários auth sem public correspondente
SELECT 'Usuários auth.users sem public correspondente:' as info;
SELECT au.email, au.id
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_user_id
WHERE pu.auth_user_id IS NULL
AND au.email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com');