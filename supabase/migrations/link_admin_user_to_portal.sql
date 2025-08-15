-- Vincular usuário criado via API Admin à tabela portal_users
-- ID do usuário: 424e8e60-5b18-46d4-91e2-80baa090f523

DO $$
DECLARE
    empresa_id_var UUID;
BEGIN
    -- Obter empresa existente ou criar uma
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
        '424e8e60-5b18-46d4-91e2-80baa090f523'::UUID,
        'grifo.admin@teste.com',
        'Administrador Grifo',
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
    'Usuário vinculado ao portal!' as status,
    au.email,
    au.email_confirmed_at IS NOT NULL as email_confirmed,
    pu.nome,
    pu.role,
    pu.ativo,
    e.nome as empresa
FROM auth.users au
JOIN portal_users pu ON au.id = pu.auth_user_id
JOIN empresas e ON pu.empresa_id = e.id
WHERE au.email = 'grifo.admin@teste.com';