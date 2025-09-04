-- Criar usuário diretamente no Supabase Auth
-- Email: paranhoscontato.n@gmail.com
-- Senha: Teste@2025

DO $$
DECLARE
    new_user_id UUID;
    user_exists BOOLEAN := FALSE;
BEGIN
    -- Verificar se o usuário já existe
    SELECT EXISTS(
        SELECT 1 FROM auth.users 
        WHERE email = 'paranhoscontato.n@gmail.com'
    ) INTO user_exists;
    
    IF user_exists THEN
        RAISE NOTICE 'Usuário já existe no auth.users';
        -- Buscar o ID do usuário existente
        SELECT id INTO new_user_id FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';
    ELSE
        -- Gerar novo UUID
        new_user_id := gen_random_uuid();
        
        RAISE NOTICE 'Criando usuário no auth.users com ID: %', new_user_id;
        
        -- Inserir usuário no auth.users
        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            new_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'paranhoscontato.n@gmail.com',
            crypt('Teste@2025', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"nome":"Super Admin"}',
            false,
            '',
            '',
            '',
            ''
        );
        
        -- Criar identidade
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            new_user_id,
            format('{"sub":"%s","email":"%s"}', new_user_id, 'paranhoscontato.n@gmail.com')::jsonb,
            'email',
            NOW(),
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Usuário criado com sucesso no auth.users';
    END IF;
    
    -- Atualizar portal_users com auth_user_id
    UPDATE portal_users 
    SET auth_user_id = new_user_id 
    WHERE email = 'paranhoscontato.n@gmail.com' AND auth_user_id IS NULL;
    
    RAISE NOTICE 'Vinculação atualizada no portal_users';
    
    -- Verificação final
    RAISE NOTICE 'Verificação final:';
    RAISE NOTICE 'Auth User ID: %', new_user_id;
    
END $$;

-- Verificar resultado
SELECT 
    'auth.users' as tabela,
    id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

SELECT 
    'portal_users' as tabela,
    id,
    email,
    nome,
    role,
    auth_user_id,
    ativo
FROM portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';