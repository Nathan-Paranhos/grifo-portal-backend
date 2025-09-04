-- Create admin user properly in auth.users and portal_users
-- This script creates the user using Supabase's auth system

DO $$
DECLARE
    new_user_id uuid;
    empresa_default_id uuid;
BEGIN
    -- First, check if user already exists in auth.users
    SELECT id INTO new_user_id FROM auth.users WHERE email = 'admin@grifo.com';
    
    IF new_user_id IS NULL THEN
        -- Create user in auth.users table directly
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            'admin@grifo.com',
            crypt('admin123', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        ) RETURNING id INTO new_user_id;
        
        RAISE NOTICE 'Created auth user with ID: %', new_user_id;
    ELSE
        RAISE NOTICE 'Auth user already exists with ID: %', new_user_id;
    END IF;
    
    -- Get or create default empresa
    SELECT id INTO empresa_default_id FROM empresas WHERE nome = 'Grifo Admin' LIMIT 1;
    
    IF empresa_default_id IS NULL THEN
        INSERT INTO empresas (nome, cnpj, telefone, email, endereco, ativo)
        VALUES ('Grifo Admin', '00000000000100', '(11) 99999-9999', 'admin@grifo.com', 'Endereço Admin', true)
        RETURNING id INTO empresa_default_id;
        
        RAISE NOTICE 'Created default empresa with ID: %', empresa_default_id;
    END IF;
    
    -- Update or create portal_users entry
    INSERT INTO portal_users (
        auth_user_id,
        email,
        nome,
        empresa_id,
        role,
        permissions,
        ativo,
        first_login_completed,
        password_changed_at
    ) VALUES (
        new_user_id,
        'admin@grifo.com',
        'Administrador',
        empresa_default_id,
        'admin',
        '{}',
        true,
        true,
        NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        empresa_id = EXCLUDED.empresa_id,
        first_login_completed = true,
        password_changed_at = NOW();
    
    RAISE NOTICE 'Updated portal_users for admin@grifo.com';
    
END $$;

-- Verify the creation
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    au.email_confirmed_at,
    pu.id as portal_id,
    pu.email as portal_email,
    pu.nome,
    pu.auth_user_id,
    pu.ativo,
    pu.first_login_completed
FROM auth.users au
FULL OUTER JOIN portal_users pu ON au.id = pu.auth_user_id
WHERE au.email = 'admin@grifo.com' OR pu.email = 'admin@grifo.com';