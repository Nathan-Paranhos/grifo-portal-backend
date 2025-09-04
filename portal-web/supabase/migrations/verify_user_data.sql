-- Verification: Check user data in both auth.users and public.users

-- Check auth.users table for our test user
SELECT 
    'AUTH.USERS DATA:' as table_info,
    id,
    email,
    email_confirmed_at,
    encrypted_password IS NOT NULL as has_password,
    created_at,
    deleted_at IS NULL as is_active
FROM auth.users 
WHERE email = 'visionariaev@gmail.com';

-- Check public.users table for our test user
SELECT 
    'PUBLIC.USERS DATA:' as table_info,
    id,
    email,
    nome,
    auth_user_id,
    role,
    user_type,
    is_active,
    status
FROM public.users 
WHERE email = 'visionariaev@gmail.com';

-- Check the mapping between auth.users and public.users
SELECT 
    'USER MAPPING:' as info,
    au.email,
    au.id as auth_id,
    pu.id as public_id,
    pu.auth_user_id,
    au.id = pu.auth_user_id as mapping_correct
FROM auth.users au
LEFT JOIN public.users pu ON pu.auth_user_id = au.id
WHERE au.email = 'visionariaev@gmail.com';

-- Check if there are any users in auth.identities
SELECT 
    'AUTH.IDENTITIES DATA:' as table_info,
    user_id,
    provider,
    provider_id,
    identity_data
FROM auth.identities 
WHERE identity_data->>'email' = 'visionariaev@gmail.com';

-- Count total users in each table
SELECT 
    'TOTAL COUNTS:' as info,
    (
        SELECT COUNT(*) 
        FROM auth.users 
        WHERE deleted_at IS NULL AND email_confirmed_at IS NOT NULL
    ) as confirmed_auth_users,
    (
        SELECT COUNT(*) 
        FROM public.users 
        WHERE is_active = true
    ) as active_public_users;