-- Update password for existing user visionariaev@gmail.com
-- This will set the password to 123456 using proper bcrypt hashing

-- Update the password in auth.users
UPDATE auth.users 
SET 
    encrypted_password = crypt('123456', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE email = 'visionariaev@gmail.com';

-- Ensure the user exists in auth.identities
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    au.id,
    json_build_object(
        'email', au.email,
        'sub', au.id::text
    ),
    'email',
    au.id::text,
    NOW(),
    NOW()
FROM auth.users au
WHERE au.email = 'visionariaev@gmail.com'
  AND NOT EXISTS (
      SELECT 1 
      FROM auth.identities ai 
      WHERE ai.user_id = au.id AND ai.provider = 'email'
  );

-- Ensure the user is active in public.users
UPDATE public.users 
SET 
    is_active = true,
    status = 'active',
    user_type = COALESCE(user_type, 'admin'),
    updated_at = NOW()
WHERE email = 'visionariaev@gmail.com';

-- Verify the update
SELECT 
    'PASSWORD UPDATE VERIFICATION:' as status,
    au.email,
    au.email_confirmed_at IS NOT NULL as email_confirmed,
    au.encrypted_password IS NOT NULL as has_password,
    LENGTH(au.encrypted_password) as password_length,
    pu.nome,
    pu.user_type,
    pu.is_active,
    pu.status
FROM auth.users au
JOIN public.users pu ON pu.auth_user_id = au.id
WHERE au.email = 'visionariaev@gmail.com';