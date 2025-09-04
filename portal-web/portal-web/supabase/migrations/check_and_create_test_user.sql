-- Verificar usuários existentes
SELECT 'Portal Users Count:' as info, COUNT(*) as count FROM portal_users;
SELECT 'Auth Users Count:' as info, COUNT(*) as count FROM auth.users;

-- Mostrar usuários existentes
SELECT 'Existing Portal Users:' as info;
SELECT id, email, nome, role, ativo, first_login_completed, auth_user_id FROM portal_users;

SELECT 'Existing Auth Users:' as info;
SELECT id, email, created_at FROM auth.users;

-- Limpar usuários existentes se necessário
DELETE FROM portal_users WHERE email IN ('admin@grifo.com', 'paranhoscontato.n@gmail.com');
DELETE FROM auth.users WHERE email IN ('admin@grifo.com', 'paranhoscontato.n@gmail.com');

-- Criar empresa padrão se não existir
INSERT INTO empresas (id, nome, cnpj, telefone, email, endereco, ativo)
SELECT 
    gen_random_uuid(),
    'Grifo Admin',
    '00000000000100',
    '(11) 99999-9999',
    'admin@grifo.com',
    'Endereço Admin',
    true
WHERE NOT EXISTS (SELECT 1 FROM empresas WHERE nome = 'Grifo Admin');

-- Criar usuário de teste na tabela auth.users
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
    recovery_token,
    aud,
    role
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'teste@grifo.com',
    crypt('123456', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    'authenticated',
    'authenticated'
);

-- Obter o ID do usuário criado
DO $$
DECLARE
    user_id uuid;
    empresa_id uuid;
BEGIN
    -- Obter o ID do usuário criado
    SELECT id INTO user_id FROM auth.users WHERE email = 'teste@grifo.com';
    
    -- Obter o ID da empresa
    SELECT id INTO empresa_id FROM empresas WHERE nome = 'Grifo Admin';
    
    -- Criar usuário do portal
    INSERT INTO portal_users (
        id,
        auth_user_id,
        email,
        nome,
        empresa_id,
        role,
        permissions,
        can_create_vistorias,
        can_edit_vistorias,
        can_view_all_company_data,
        ativo,
        first_login_completed,
        password_changed_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        user_id,
        'teste@grifo.com',
        'Usuário Teste',
        empresa_id,
        'admin',
        '{}',
        true,
        true,
        true,
        true,
        true,
        NOW(),
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Usuário teste criado com sucesso! Email: teste@grifo.com, Senha: 123456';
END $$;

-- Verificar criação
SELECT 'Final Check - Portal Users:' as info;
SELECT id, email, nome, role, ativo, first_login_completed FROM portal_users;

SELECT 'Final Check - Auth Users:' as info;
SELECT id, email FROM auth.users;