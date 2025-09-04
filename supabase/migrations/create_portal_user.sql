-- Criar usuário de teste na tabela portal_users
-- Email: paranhoscontato.n@gmail.com
-- Senha: 123456789

-- Primeiro, verificar se o usuário já existe na tabela auth.users
DO $$
DECLARE
    auth_user_uuid uuid;
    portal_user_uuid uuid;
    hashed_password text;
BEGIN
    -- Gerar hash da senha usando crypt
    hashed_password := crypt('123456789', gen_salt('bf'));
    
    -- Verificar se o usuário já existe na tabela auth.users
    SELECT id INTO auth_user_uuid 
    FROM auth.users 
    WHERE email = 'paranhoscontato.n@gmail.com';
    
    -- Se não existir, criar na tabela auth.users
    IF auth_user_uuid IS NULL THEN
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
            role,
            aud
        ) VALUES (
            gen_random_uuid(),
            '00000000-0000-0000-0000-000000000000',
            'paranhoscontato.n@gmail.com',
            hashed_password,
            now(),
            now(),
            now(),
            '{"provider": "email", "providers": ["email"]}',
            '{}',
            false,
            'authenticated',
            'authenticated'
        ) RETURNING id INTO auth_user_uuid;
        
        RAISE NOTICE 'Usuário criado na tabela auth.users com ID: %', auth_user_uuid;
    ELSE
        -- Atualizar a senha se o usuário já existir
        UPDATE auth.users 
        SET encrypted_password = hashed_password,
            updated_at = now()
        WHERE id = auth_user_uuid;
        
        RAISE NOTICE 'Senha atualizada para usuário existente na auth.users com ID: %', auth_user_uuid;
    END IF;
    
    -- Verificar se o usuário já existe na tabela portal_users
    SELECT id INTO portal_user_uuid 
    FROM portal_users 
    WHERE email = 'paranhoscontato.n@gmail.com';
    
    -- Se não existir, criar na tabela portal_users
    IF portal_user_uuid IS NULL THEN
        INSERT INTO portal_users (
            auth_user_id,
            email,
            nome,
            role,
            permissions,
            can_create_vistorias,
            can_edit_vistorias,
            can_view_all_company_data,
            ativo,
            first_login_completed
        ) VALUES (
            auth_user_uuid,
            'paranhoscontato.n@gmail.com',
            'Usuário Teste',
            'admin',
            '{"admin": true}',
            true,
            true,
            true,
            true,
            true
        ) RETURNING id INTO portal_user_uuid;
        
        RAISE NOTICE 'Usuário criado na tabela portal_users com ID: %', portal_user_uuid;
    ELSE
        -- Atualizar o auth_user_id se necessário
        UPDATE portal_users 
        SET auth_user_id = auth_user_uuid,
            ativo = true,
            updated_at = now()
        WHERE id = portal_user_uuid;
        
        RAISE NOTICE 'Usuário atualizado na portal_users com ID: %', portal_user_uuid;
    END IF;
    
END $$;

-- Conceder permissões necessárias
GRANT SELECT, INSERT, UPDATE ON portal_users TO authenticated;
GRANT SELECT ON portal_users TO anon;

-- Verificar o resultado final
SELECT 
    'Verificação Final' as status,
    au.id as auth_user_id,
    au.email as auth_email,
    au.email_confirmed_at,
    pu.id as portal_user_id,
    pu.email as portal_email,
    pu.nome,
    pu.role,
    pu.ativo
FROM auth.users au
LEFT JOIN portal_users pu ON au.id = pu.auth_user_id
WHERE au.email = 'paranhoscontato.n@gmail.com';