-- Criar usuário administrativo simples sem deletar existentes

-- Usar função administrativa para criar usuário com senha correta
SELECT auth.create_user(
  email => 'portal.admin@grifo.com',
  password => '123456',
  email_confirm => true
);

-- Criar registro na tabela portal_users
DO $$
DECLARE
    user_id UUID;
    empresa_id_var UUID;
BEGIN
    -- Obter o ID do usuário recém-criado
    SELECT id INTO user_id FROM auth.users WHERE email = 'portal.admin@grifo.com';
    
    -- Obter empresa existente
    SELECT id INTO empresa_id_var FROM empresas LIMIT 1;
    
    -- Se não houver empresa, criar uma
    IF empresa_id_var IS NULL THEN
        INSERT INTO empresas (nome, cnpj, email, telefone, endereco)
        VALUES (
            'Grifo Vistorias Ltda',
            '44.555.666/0001-77',
            'contato@grifovistorias.com',
            '(11) 5555-5555',
            'Av. Paulista, 1000 - São Paulo, SP'
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
        'portal.admin@grifo.com',
        'Administrador Portal',
        empresa_id_var,
        'gestor',
        '{"vistorias": ["read", "write"], "relatorios": ["read", "write"], "usuarios": ["read", "write"]}',
        true,
        true,
        true,
        true
    );
END $$;

-- Verificar criação
SELECT 
    'Usuário portal admin criado!' as status,
    au.email,
    au.email_confirmed_at IS NOT NULL as email_confirmed,
    pu.nome,
    pu.role,
    pu.ativo,
    e.nome as empresa
FROM auth.users au
JOIN portal_users pu ON au.id = pu.auth_user_id
JOIN empresas e ON pu.empresa_id = e.id
WHERE au.email = 'portal.admin@grifo.com';