-- Create user in app_users table for visionariaev@gmail.com
-- This is needed because the auth.js code looks for users in app_users table after Supabase Auth

DO $$
DECLARE
    auth_user_id UUID;
    default_empresa_id UUID;
BEGIN
    -- Get the auth user ID
    SELECT id INTO auth_user_id 
    FROM auth.users 
    WHERE email = 'visionariaev@gmail.com';
    
    IF auth_user_id IS NULL THEN
        RAISE EXCEPTION 'Auth user not found for email: visionariaev@gmail.com';
    END IF;
    
    -- Try to get an existing empresa_id, or use NULL
    SELECT id INTO default_empresa_id 
    FROM empresas 
    LIMIT 1;
    
    -- Delete existing app_user if exists to avoid conflicts
    DELETE FROM app_users WHERE email = 'visionariaev@gmail.com';
    
    -- Insert into app_users table
    INSERT INTO app_users (
        id,
        nome,
        email,
        auth_user_id,
        empresa_id,
        role,
        ativo,
        first_login_completed,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        'Visionaria Admin',
        'visionariaev@gmail.com',
        auth_user_id,
        default_empresa_id, -- Use existing empresa_id or NULL
        'admin',
        true,
        true, -- Set to true to avoid first password flow
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'User created in app_users table with auth_user_id: % and empresa_id: %', auth_user_id, default_empresa_id;
END $$;

-- Verify the user was created in app_users
SELECT 
    'APP_USER VERIFICATION:' as status,
    au.id,
    au.nome,
    au.email,
    au.auth_user_id,
    au.empresa_id,
    au.role,
    au.ativo,
    au.first_login_completed
FROM app_users au
WHERE au.email = 'visionariaev@gmail.com';

-- Also verify auth user exists
SELECT 
    'AUTH_USER VERIFICATION:' as status,
    u.id,
    u.email,
    u.email_confirmed_at IS NOT NULL as email_confirmed,
    u.encrypted_password IS NOT NULL as has_password
FROM auth.users u
WHERE u.email = 'visionariaev@gmail.com';