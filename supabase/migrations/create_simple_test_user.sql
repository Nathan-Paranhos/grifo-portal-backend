-- Criar novo usuário de teste sem deletar existentes
-- Usar email diferente para evitar conflitos

-- Criar usuário diretamente na tabela auth.users
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
  'teste.portal@grifo.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- senha: password
  NOW(),
  NOW(),
  NOW(),
  '{}',
  '{}',
  false,
  'authenticated'
);

-- Criar usuário na tabela portal_users
DO $$
DECLARE
    user_id UUID;
    empresa_id_var INTEGER;
BEGIN
    -- Obter o ID do usuário recém-criado
    SELECT id INTO user_id FROM auth.users WHERE email = 'teste.portal@grifo.com';
    
    -- Obter empresa existente ou usar a primeira disponível
    SELECT id INTO empresa_id_var FROM empresas LIMIT 1;
    
    -- Se não houver empresa, criar uma
    IF empresa_id_var IS NULL THEN
        INSERT INTO empresas (nome, cnpj, email, telefone, endereco, created_at, updated_at)
        VALUES (
            'Empresa Portal Teste',
            '11.222.333/0001-44',
            'portal@empresateste.com',
            '(11) 88888-8888',
            'Rua Portal, 456 - São Paulo, SP',
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
        'teste.portal@grifo.com',
        'Usuário Portal Teste',
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

-- Verificar criação
SELECT 
    'Usuário criado com sucesso!' as status,
    au.email,
    pu.nome,
    e.nome as empresa
FROM auth.users au
JOIN portal_users pu ON au.id = pu.auth_user_id
JOIN empresas e ON pu.empresa_id = e.id
WHERE au.email = 'teste.portal@grifo.com';