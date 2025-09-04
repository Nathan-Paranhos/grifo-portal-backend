-- Criar usuário de teste no Supabase Auth e portal_users
-- IMPORTANTE: Execute este script apenas se não existir o usuário

-- Primeiro, verificar se o usuário já existe
DO $$
DECLARE
    user_exists boolean := false;
    auth_user_id uuid;
BEGIN
    -- Verificar se já existe na tabela portal_users
    SELECT EXISTS(
        SELECT 1 FROM portal_users 
        WHERE email = 'paranhoscontato.n@gmail.com'
    ) INTO user_exists;
    
    IF NOT user_exists THEN
        -- Verificar se existe na tabela auth.users
        SELECT id INTO auth_user_id
        FROM auth.users 
        WHERE email = 'paranhoscontato.n@gmail.com'
        LIMIT 1;
        
        -- Se não existe em auth.users, criar
        IF auth_user_id IS NULL THEN
            INSERT INTO auth.users (
                instance_id,
                id,
                aud,
                role,
                email,
                encrypted_password,
                email_confirmed_at,
                recovery_sent_at,
                last_sign_in_at,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at,
                updated_at,
                confirmation_token,
                email_change,
                email_change_token_new,
                recovery_token
            ) VALUES (
                '00000000-0000-0000-0000-000000000000',
                gen_random_uuid(),
                'authenticated',
                'authenticated',
                'paranhoscontato.n@gmail.com',
                crypt('123456789', gen_salt('bf')), -- Senha: 123456789
                now(),
                null,
                null,
                '{"provider": "email", "providers": ["email"]}',
                '{}',
                now(),
                now(),
                '',
                '',
                '',
                ''
            ) RETURNING id INTO auth_user_id;
        END IF;
        
        -- Criar usuário na tabela portal_users
        INSERT INTO portal_users (
            auth_user_id,
            email,
            nome,
            role,
            ativo,
            can_create_vistorias,
            can_edit_vistorias,
            can_view_all_company_data,
            first_login_completed
        ) VALUES (
            auth_user_id,
            'paranhoscontato.n@gmail.com',
            'Usuário Teste',
            'admin',
            true,
            true,
            true,
            true,
            true
        );
        
        RAISE NOTICE 'Usuário de teste criado com sucesso!';
    ELSE
        RAISE NOTICE 'Usuário já existe na tabela portal_users';
    END IF;
END $$;

-- Garantir permissões para as tabelas
GRANT SELECT, INSERT, UPDATE, DELETE ON portal_users TO authenticated;
GRANT SELECT ON portal_users TO anon;

-- Verificar o usuário criado
SELECT 
    pu.id,
    pu.email,
    pu.nome,
    pu.role,
    pu.ativo,
    pu.auth_user_id,
    au.email as auth_email
FROM portal_users pu
LEFT JOIN auth.users au ON pu.auth_user_id = au.id
WHERE pu.email = 'paranhoscontato.n@gmail.com';