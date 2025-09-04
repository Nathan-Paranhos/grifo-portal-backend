-- Corrigir usuário com provider_id correto
-- Email: paranhoscontato.n@gmail.com

-- 1. Verificar estado atual
SELECT 'ESTADO ATUAL - auth.users' as info, id, email, created_at FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';
SELECT 'ESTADO ATUAL - portal_users' as info, id, email, auth_user_id FROM portal_users WHERE email = 'paranhoscontato.n@gmail.com';

-- 2. Corrigir ou criar usuário
DO $$
DECLARE
    auth_user_id_var UUID;
    portal_user_id_var UUID;
    identity_exists BOOLEAN := FALSE;
BEGIN
    -- Buscar IDs existentes
    SELECT id INTO auth_user_id_var FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com' LIMIT 1;
    SELECT id INTO portal_user_id_var FROM portal_users WHERE email = 'paranhoscontato.n@gmail.com' LIMIT 1;
    
    RAISE NOTICE 'Auth User ID: %, Portal User ID: %', auth_user_id_var, portal_user_id_var;
    
    -- Se usuário existe no auth.users
    IF auth_user_id_var IS NOT NULL THEN
        RAISE NOTICE 'Usuário já existe no auth.users';
        
        -- Verificar se identidade existe
        SELECT EXISTS(
            SELECT 1 FROM auth.identities 
            WHERE user_id = auth_user_id_var AND provider = 'email'
        ) INTO identity_exists;
        
        -- Criar identidade se não existir
        IF NOT identity_exists THEN
            INSERT INTO auth.identities (
                id,
                user_id,
                identity_data,
                provider,
                provider_id,
                last_sign_in_at,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                auth_user_id_var,
                format('{"sub":"%s","email":"%s","email_verified":true}', auth_user_id_var, 'paranhoscontato.n@gmail.com')::jsonb,
                'email',
                'paranhoscontato.n@gmail.com',
                NOW(),
                NOW(),
                NOW()
            );
            RAISE NOTICE 'Identidade criada para usuário existente';
        END IF;
        
    ELSE
        -- Criar novo usuário
        auth_user_id_var := gen_random_uuid();
        RAISE NOTICE 'Criando novo usuário: %', auth_user_id_var;
        
        -- Remover possível duplicata em public.users
        DELETE FROM public.users WHERE email = 'paranhoscontato.n@gmail.com';
        
        -- Criar no auth.users
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
            is_super_admin
        ) VALUES (
            auth_user_id_var,
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
            false
        );
        
        -- Criar identidade com provider_id
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            auth_user_id_var,
            format('{"sub":"%s","email":"%s","email_verified":true}', auth_user_id_var, 'paranhoscontato.n@gmail.com')::jsonb,
            'email',
            'paranhoscontato.n@gmail.com',
            NOW(),
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Usuário e identidade criados com sucesso';
    END IF;
    
    -- Vincular ao portal_users
    IF portal_user_id_var IS NOT NULL AND auth_user_id_var IS NOT NULL THEN
        UPDATE portal_users 
        SET auth_user_id = auth_user_id_var 
        WHERE id = portal_user_id_var;
        RAISE NOTICE 'Vinculação atualizada no portal_users';
    END IF;
    
END $$;

-- 3. Verificação final completa
SELECT 'FINAL - auth.users' as tabela, id, email, email_confirmed_at, created_at FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';
SELECT 'FINAL - identities' as tabela, id, user_id, provider, provider_id FROM auth.identities WHERE provider_id = 'paranhoscontato.n@gmail.com';
SELECT 'FINAL - portal_users' as tabela, id, email, nome, role, auth_user_id, ativo FROM portal_users WHERE email = 'paranhoscontato.n@gmail.com';