-- Check if user exists in app_users and clients tables
-- This will help us understand why the login is failing after Supabase Auth succeeds

-- Check auth.users
SELECT 
    'AUTH.USERS:' as table_name,
    id,
    email,
    email_confirmed_at IS NOT NULL as email_confirmed,
    encrypted_password IS NOT NULL as has_password
FROM auth.users 
WHERE email = 'visionariaev@gmail.com';

-- Check app_users table
SELECT 
    'APP_USERS:' as table_name,
    id,
    nome,
    email,
    auth_user_id,
    role,
    ativo,
    first_login_completed
FROM app_users 
WHERE email = 'visionariaev@gmail.com';

-- Check clients table
SELECT 
    'CLIENTS:' as table_name,
    id,
    name,
    email,
    tenant,
    is_active
FROM clients 
WHERE email = 'visionariaev@gmail.com';

-- Check public.users table
SELECT 
    'PUBLIC.USERS:' as table_name,
    id,
    nome,
    email,
    auth_user_id,
    user_type,
    is_active,
    status
FROM public.users 
WHERE email = 'visionariaev@gmail.com';

-- Show all tables that might contain user data
SELECT 
    'TABLE COUNTS:' as info,
    (
        SELECT COUNT(*) FROM app_users WHERE email = 'visionariaev@gmail.com'
    ) as app_users_count,
    (
        SELECT COUNT(*) FROM clients WHERE email = 'visionariaev@gmail.com'
    ) as clients_count,
    (
        SELECT COUNT(*) FROM public.users WHERE email = 'visionariaev@gmail.com'
    ) as public_users_count,
    (
        SELECT COUNT(*) FROM auth.users WHERE email = 'visionariaev@gmail.com'
    ) as auth_users_count;