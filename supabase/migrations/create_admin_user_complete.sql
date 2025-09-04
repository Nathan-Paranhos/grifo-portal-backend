-- Criar usuário administrador completo no Supabase Auth e Portal
-- Este script cria o tenant, empresa, usuário no auth.users e portal_users

-- 1. Criar tenant Grifo (se não existir)
INSERT INTO tenants (slug, name, is_active, created_at, updated_at)
VALUES ('grifo', 'Grifo', true, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- 2. Criar empresa Grifo (se não existir)
INSERT INTO empresas (nome, cnpj, endereco, telefone, email, created_at, updated_at)
VALUES (
  'Grifo Vistorias Ltda',
  '11.222.333/0001-44',
  'Rua das Vistorias, 123 - Centro',
  '(11) 99999-9999',
  'contato@grifo.com',
  NOW(),
  NOW()
)
ON CONFLICT (cnpj) DO NOTHING;

-- 3. Criar usuário no auth.users (Supabase Auth)
-- Nota: A senha 'admin123' será hasheada pelo Supabase
DO $$
DECLARE
    auth_user_id uuid;
    empresa_id_var uuid;
BEGIN
    -- Verificar se o usuário já existe no auth.users
    SELECT id INTO auth_user_id 
    FROM auth.users 
    WHERE email = 'admin@grifo.com';
    
    -- Se não existir, criar o usuário
    IF auth_user_id IS NULL THEN
        -- Gerar um UUID para o usuário
        auth_user_id := gen_random_uuid();
        
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
            is_super_admin
        ) VALUES (
            auth_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'admin@grifo.com',
            crypt('admin123', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            '{"nome": "Administrador Grifo"}',
            false
        );
    END IF;
    
    -- Obter ID da empresa
    SELECT id INTO empresa_id_var 
    FROM empresas 
    WHERE cnpj = '11.222.333/0001-44';
    
    -- 4. Criar usuário no portal_users (se não existir)
    INSERT INTO portal_users (
        auth_user_id,
        email,
        nome,
        empresa_id,
        role,
        permissions,
        ativo,
        first_login_completed,
        created_at,
        updated_at
    ) VALUES (
        auth_user_id,
        'admin@grifo.com',
        'Administrador Grifo',
        empresa_id_var,
        'admin',
        '["all"]',
        true,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        ativo = true,
        updated_at = NOW();
        
END $$;