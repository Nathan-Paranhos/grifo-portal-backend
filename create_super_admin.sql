-- Criar usuário super admin único
-- Email: paranhoscontato.n@gmail.com
-- Senha: Teste@2025
-- Role: super_admin

DO $$
DECLARE
    auth_user_id uuid;
    empresa_id_var uuid;
    existing_user_count integer;
BEGIN
    -- Verificar quantos usuários existem atualmente
    SELECT COUNT(*) INTO existing_user_count FROM auth.users;
    RAISE NOTICE 'Total de usuários existentes: %', existing_user_count;
    
    -- Limpar todos os usuários existentes primeiro
    IF existing_user_count > 0 THEN
        RAISE NOTICE 'Removendo usuários existentes...';
        DELETE FROM portal_users;
        DELETE FROM app_users;
        DELETE FROM auth.users;
        RAISE NOTICE 'Usuários removidos com sucesso';
    END IF;
    
    -- Verificar se existe pelo menos uma empresa
    SELECT id INTO empresa_id_var FROM empresas LIMIT 1;
    
    -- Se não existir empresa, criar uma empresa padrão
    IF empresa_id_var IS NULL THEN
        RAISE NOTICE 'Criando empresa padrão...';
        INSERT INTO empresas (nome, cnpj, endereco, telefone, email, created_at, updated_at)
        VALUES (
            'Grifo Vistorias',
            '00.000.000/0001-00',
            'Endereço Padrão',
            '(00) 00000-0000',
            'contato@grifo.com',
            NOW(),
            NOW()
        ) RETURNING id INTO empresa_id_var;
        RAISE NOTICE 'Empresa criada com ID: %', empresa_id_var;
    END IF;
    
    -- Gerar UUID para o novo usuário super admin
    auth_user_id := gen_random_uuid();
    RAISE NOTICE 'Criando usuário super admin com ID: %', auth_user_id;
    
    -- Inserir usuário no auth.users (Supabase Auth)
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
        confirmed_at
    ) VALUES (
        auth_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'paranhoscontato.n@gmail.com',
        crypt('Teste@2025', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"name": "Super Admin"}',
        true,
        NOW()
    );
    
    -- Criar identidade para o usuário
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
        auth_user_id,
        jsonb_build_object(
            'email', 'paranhoscontato.n@gmail.com',
            'sub', auth_user_id::text
        ),
        'email',
        NOW(),
        NOW(),
        NOW()
    );
    
    -- Inserir usuário no portal_users
    INSERT INTO portal_users (
        id,
        auth_user_id,
        email,
        name,
        empresa_id,
        role,
        permissions,
        status,
        first_login_completed,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        auth_user_id,
        'paranhoscontato.n@gmail.com',
        'Super Admin',
        empresa_id_var,
        'super_admin',
        '["all"]',
        'active',
        true,
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Super admin criado com sucesso!';
    RAISE NOTICE 'Email: paranhoscontato.n@gmail.com';
    RAISE NOTICE 'Senha: Teste@2025';
    RAISE NOTICE 'Role: super_admin';
    
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao criar super admin: %', SQLERRM;
        RAISE;
END $$;

-- Verificar se o usuário foi criado corretamente
SELECT 
    'VERIFICAÇÃO FINAL' as status,
    au.email,
    au.id as auth_id,
    au.is_super_admin,
    pu.id as portal_id,
    pu.role,
    pu.status,
    e.nome as empresa_nome
FROM auth.users au
JOIN portal_users pu ON au.id = pu.auth_user_id
JOIN empresas e ON pu.empresa_id = e.id
WHERE au.email = 'paranhoscontato.n@gmail.com';

-- Mostrar contagem final de usuários
SELECT 
    'CONTAGEM FINAL' as info,
    (SELECT COUNT(*) FROM auth.users) as total_auth_users,
    (SELECT COUNT(*) FROM portal_users) as total_portal_users,
    (SELECT COUNT(*) FROM app_users) as total_app_users;