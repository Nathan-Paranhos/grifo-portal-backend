-- Verificar e corrigir usuário duplicado
-- Email: paranhoscontato.n@gmail.com

-- 1. Verificar onde o usuário existe
SELECT 'auth.users' as tabela, id, email, created_at FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';
SELECT 'public.users' as tabela, id, email, created_at FROM public.users WHERE email = 'paranhoscontato.n@gmail.com';
SELECT 'portal_users' as tabela, id, email, auth_user_id, created_at FROM portal_users WHERE email = 'paranhoscontato.n@gmail.com';

-- 2. Limpar registros duplicados se existirem
DO $$
DECLARE
    auth_user_id_var UUID;
    portal_user_id_var UUID;
BEGIN
    -- Buscar IDs existentes
    SELECT id INTO auth_user_id_var FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com' LIMIT 1;
    SELECT id INTO portal_user_id_var FROM portal_users WHERE email = 'paranhoscontato.n@gmail.com' LIMIT 1;
    
    RAISE NOTICE 'Auth User ID encontrado: %', auth_user_id_var;
    RAISE NOTICE 'Portal User ID encontrado: %', portal_user_id_var;
    
    -- Se existe no auth.users, vincular ao portal_users
    IF auth_user_id_var IS NOT NULL AND portal_user_id_var IS NOT NULL THEN
        UPDATE portal_users 
        SET auth_user_id = auth_user_id_var 
        WHERE id = portal_user_id_var AND auth_user_id IS NULL;
        
        RAISE NOTICE 'Vinculação atualizada entre auth.users e portal_users';
    END IF;
    
    -- Se não existe no auth.users mas existe duplicata em public.users, remover
    IF auth_user_id_var IS NULL THEN
        DELETE FROM public.users WHERE email = 'paranhoscontato.n@gmail.com';
        RAISE NOTICE 'Removido registro duplicado de public.users';
        
        -- Agora tentar criar no auth.users
        auth_user_id_var := gen_random_uuid();
        
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
            auth_user_id_var,
            format('{"sub":"%s","email":"%s"}', auth_user_id_var, 'paranhoscontato.n@gmail.com')::jsonb,
            'email',
            NOW(),
            NOW(),
            NOW()
        );
        
        -- Vincular ao portal_users
        IF portal_user_id_var IS NOT NULL THEN
            UPDATE portal_users 
            SET auth_user_id = auth_user_id_var 
            WHERE id = portal_user_id_var;
        END IF;
        
        RAISE NOTICE 'Usuário criado com sucesso no auth.users: %', auth_user_id_var;
    END IF;
    
END $$;

-- 3. Verificação final
SELECT 'RESULTADO FINAL - auth.users' as info, id, email, email_confirmed_at FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';
SELECT 'RESULTADO FINAL - portal_users' as info, id, email, nome, role, auth_user_id, ativo FROM portal_users WHERE email = 'paranhoscontato.n@gmail.com';