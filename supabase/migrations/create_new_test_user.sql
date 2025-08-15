-- Criar novo usuário de teste diretamente no Supabase Auth
-- Primeiro, vamos limpar usuários de teste existentes
DELETE FROM portal_users WHERE email IN ('vistoriador.teste@grifo.com', 'gestor.teste@grifo.com');
DELETE FROM auth.users WHERE email IN ('vistoriador.teste@grifo.com', 'gestor.teste@grifo.com');

-- Criar usuário diretamente na tabela auth.users com senha hash correta
-- Senha: 123456 (hash bcrypt)
INSERT INTO auth.users (
  id,
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
  gen_random_uuid(),
  'vistoriador.teste@grifo.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- senha: password
  NOW(),
  NOW(),
  NOW(),
  '{}',
  '{}',
  false,
  'authenticated'
);

-- Obter o ID do usuário recém-criado
DO $$
DECLARE
    user_id UUID;
    empresa_id_var INTEGER;
BEGIN
    -- Obter o ID do usuário
    SELECT id INTO user_id FROM auth.users WHERE email = 'vistoriador.teste@grifo.com';
    
    -- Obter ou criar empresa de teste
    SELECT id INTO empresa_id_var FROM empresas WHERE cnpj = '98.765.432/0001-10';
    
    IF empresa_id_var IS NULL THEN
        INSERT INTO empresas (nome, cnpj, email, telefone, endereco, created_at, updated_at)
        VALUES (
            'Empresa Teste Grifo',
            '98.765.432/0001-10',
            'contato@empresateste.com',
            '(11) 99999-9999',
            'Rua Teste, 123 - São Paulo, SP',
            NOW(),
            NOW()
        ) RETURNING id INTO empresa_id_var;
    END IF;
    
    -- Criar usuário na tabela portal_users
    INSERT INTO portal_users (
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
        created_at,
        updated_at
    ) VALUES (
        user_id,
        'vistoriador.teste@grifo.com',
        'Vistoriador Teste',
        empresa_id_var,
        'vistoriador',
        '{"vistorias": ["read", "write"], "relatorios": ["read"]}',
        true,
        true,
        false,
        true,
        NOW(),
        NOW()
    );
END $$;

-- Verificar se foi criado corretamente
SELECT 
    au.id as auth_id,
    au.email,
    au.email_confirmed_at,
    pu.id as portal_id,
    pu.nome,
    pu.ativo,
    e.nome as empresa_nome
FROM auth.users au
JOIN portal_users pu ON au.id = pu.auth_user_id
JOIN empresas e ON pu.empresa_id = e.id
WHERE au.email = 'vistoriador.teste@grifo.com';