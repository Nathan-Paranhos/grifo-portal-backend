-- Criar usuário usando função administrativa do Supabase
-- Primeiro, vamos deletar o usuário de teste anterior se existir
DELETE FROM portal_users WHERE email = 'teste.novo@grifo.com';
DELETE FROM auth.users WHERE email = 'teste.novo@grifo.com';

-- Usar função administrativa para criar usuário com senha correta
SELECT auth.create_user(
  email => 'admin.teste@grifo.com',
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
    SELECT id INTO user_id FROM auth.users WHERE email = 'admin.teste@grifo.com';
    
    -- Obter empresa existente
    SELECT id INTO empresa_id_var FROM empresas LIMIT 1;
    
    -- Se não houver empresa, criar uma
    IF empresa_id_var IS NULL THEN
        INSERT INTO empresas (nome, cnpj, email, telefone, endereco)
        VALUES (
            'Empresa Admin Teste',
            '33.444.555/0001-66',
            'admin@empresateste.com',
            '(11) 66666-6666',
            'Rua Admin, 123 - São Paulo, SP'
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
        'admin.teste@grifo.com',
        'Admin Teste',
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
    'Usuário admin criado com sucesso!' as status,
    au.email,
    au.email_confirmed_at IS NOT NULL as email_confirmed,
    pu.nome,
    pu.role,
    e.nome as empresa
FROM auth.users au
JOIN portal_users pu ON au.id = pu.auth_user_id
JOIN empresas e ON pu.empresa_id = e.id
WHERE au.email = 'admin.teste@grifo.com';