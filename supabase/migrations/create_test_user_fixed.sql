-- Criar usuário de teste com tipos corretos (UUID)

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
  'teste.novo@grifo.com',
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
    empresa_id_var UUID;
BEGIN
    -- Obter o ID do usuário recém-criado
    SELECT id INTO user_id FROM auth.users WHERE email = 'teste.novo@grifo.com';
    
    -- Obter empresa existente ou usar a primeira disponível
    SELECT id INTO empresa_id_var FROM empresas LIMIT 1;
    
    -- Se não houver empresa, criar uma
    IF empresa_id_var IS NULL THEN
        INSERT INTO empresas (nome, cnpj, email, telefone, endereco)
        VALUES (
            'Empresa Teste Novo',
            '22.333.444/0001-55',
            'novo@empresateste.com',
            '(11) 77777-7777',
            'Rua Novo, 789 - São Paulo, SP'
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
        ativo
    ) VALUES (
        user_id,
        'teste.novo@grifo.com',
        'Usuário Teste Novo',
        empresa_id_var,
        'vistoriador',
        '{"vistorias": ["read", "write"], "relatorios": ["read"]}',
        true,
        true,
        false,
        true
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
WHERE au.email = 'teste.novo@grifo.com';