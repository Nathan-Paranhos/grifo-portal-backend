-- Verificar e criar usuário admin se necessário
-- Email: paranhoscontato.n@gmail.com
-- Senha: 23362336@Np10

DO $$
DECLARE
    admin_auth_id UUID;
    admin_exists BOOLEAN := FALSE;
BEGIN
    -- Verificar se o usuário existe na tabela auth.users
    SELECT EXISTS(
        SELECT 1 FROM auth.users 
        WHERE email = 'paranhoscontato.n@gmail.com'
    ) INTO admin_exists;
    
    RAISE NOTICE 'Usuário admin existe em auth.users: %', admin_exists;
    
    -- Se não existir, criar o usuário
    IF NOT admin_exists THEN
        RAISE NOTICE 'Criando usuário admin...';
        
        -- Gerar UUID para o usuário
        admin_auth_id := gen_random_uuid();
        
        -- Inserir na tabela auth.users
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            role
        ) VALUES (
            admin_auth_id,
            '00000000-0000-0000-0000-000000000000',
            'paranhoscontato.n@gmail.com',
            crypt('23362336@Np10', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            '{"name": "Admin User"}',
            false,
            'authenticated'
        );
        
        -- Inserir na tabela public.users se existir
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
            INSERT INTO public.users (
                id,
                email,
                nome,
                role,
                created_at,
                updated_at
            ) VALUES (
                admin_auth_id,
                'paranhoscontato.n@gmail.com',
                'Admin User',
                'admin',
                NOW(),
                NOW()
            );
        END IF;
        
        -- Inserir na tabela portal_users se existir
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_users' AND table_schema = 'public') THEN
            INSERT INTO public.portal_users (
                id,
                email,
                nome,
                role,
                created_at,
                updated_at
            ) VALUES (
                admin_auth_id,
                'paranhoscontato.n@gmail.com',
                'Admin User',
                'admin',
                NOW(),
                NOW()
            );
        END IF;
        
        RAISE NOTICE 'Usuário admin criado com sucesso!';
    ELSE
        RAISE NOTICE 'Usuário admin já existe.';
    END IF;
    
    -- Verificar dados do usuário
    SELECT id INTO admin_auth_id FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';
    
    RAISE NOTICE 'ID do usuário admin: %', admin_auth_id;
    
    -- Mostrar informações do usuário
    RAISE NOTICE 'Dados em auth.users:';
    PERFORM * FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        RAISE NOTICE 'Dados em public.users:';
        PERFORM * FROM public.users WHERE email = 'paranhoscontato.n@gmail.com';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_users' AND table_schema = 'public') THEN
        RAISE NOTICE 'Dados em public.portal_users:';
        PERFORM * FROM public.portal_users WHERE email = 'paranhoscontato.n@gmail.com';
    END IF;
    
END $$;

-- Consultas para verificar o usuário
SELECT 'auth.users' as tabela, id, email, created_at, email_confirmed_at 
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

SELECT 'public.users' as tabela, id, email, nome, role, created_at 
FROM public.users 
WHERE email = 'paranhoscontato.n@gmail.com';

SELECT 'public.portal_users' as tabela, id, email, nome, role, created_at 
FROM public.portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';