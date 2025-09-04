-- Verificar usuários existentes e criar se necessário
-- Usando uma abordagem mais simples

-- Primeiro, vamos verificar quantos usuários existem
SELECT 'Usuários existentes:' as info, count(*) as total FROM auth.users;
SELECT 'Emails existentes:' as info, email FROM auth.users WHERE email IS NOT NULL;

-- Criar usuários usando INSERT direto (método mais simples)
DO $$
DECLARE
    admin_user_id uuid;
    client_user_id uuid;
    admin_exists boolean := false;
    client_exists boolean := false;
BEGIN
    -- Verificar se usuários já existem
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'visionariaev@gmail.com') INTO admin_exists;
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com') INTO client_exists;
    
    -- Criar usuário admin se não existir
    IF NOT admin_exists THEN
        admin_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at, confirmed_at,
            raw_app_meta_data, raw_user_meta_data, is_super_admin
        ) VALUES (
            admin_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated', 
            'visionariaev@gmail.com',
            crypt('123456', gen_salt('bf')),
            NOW(), NOW(), NOW(), NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"name":"Visionaria Admin"}',
            false
        );
        
        -- Criar identidade
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            admin_user_id,
            jsonb_build_object('sub', admin_user_id::text, 'email', 'visionariaev@gmail.com', 'email_verified', true),
            'email',
            NOW(), NOW()
        );
        
        -- Criar registro na tabela public.users
        INSERT INTO public.users (
            id, auth_user_id, name, email, role, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            admin_user_id,
            'Visionaria Admin',
            'visionariaev@gmail.com',
            'admin',
            NOW(), NOW()
        );
        
        RAISE NOTICE 'Usuário admin criado: visionariaev@gmail.com';
    ELSE
        RAISE NOTICE 'Usuário admin já existe: visionariaev@gmail.com';
    END IF;
    
    -- Criar usuário client se não existir
    IF NOT client_exists THEN
        client_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at, confirmed_at,
            raw_app_meta_data, raw_user_meta_data, is_super_admin
        ) VALUES (
            client_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'paranhoscontato.n@gmail.com',
            crypt('123456', gen_salt('bf')),
            NOW(), NOW(), NOW(), NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"name":"Paranhos User"}',
            false
        );
        
        -- Criar identidade
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            client_user_id,
            jsonb_build_object('sub', client_user_id::text, 'email', 'paranhoscontato.n@gmail.com', 'email_verified', true),
            'email',
            NOW(), NOW()
        );
        
        -- Criar registro na tabela public.users
        INSERT INTO public.users (
            id, auth_user_id, name, email, role, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            client_user_id,
            'Paranhos User',
            'paranhoscontato.n@gmail.com',
            'client',
            NOW(), NOW()
        );
        
        RAISE NOTICE 'Usuário client criado: paranhoscontato.n@gmail.com';
    ELSE
        RAISE NOTICE 'Usuário client já existe: paranhoscontato.n@gmail.com';
    END IF;
END $$;

-- Verificar resultado final
SELECT 'Resultado final:' as info, count(*) as total FROM auth.users;
SELECT 'Usuários criados:' as info, email, created_at FROM auth.users WHERE email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com');
SELECT 'Registros public.users:' as info, email, role FROM public.users WHERE email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com');