-- Criar registros na tabela portal_users para os usuários de teste
-- Usar empresa existente ou criar nova com CNPJ único

-- Obter o ID da primeira empresa disponível ou criar uma nova
DO $$
DECLARE
    empresa_teste_id UUID;
    vistoriador_uid UUID;
    gestor_uid UUID;
BEGIN
    -- Tentar obter ID da primeira empresa ativa
    SELECT id INTO empresa_teste_id FROM empresas LIMIT 1;
    
    -- Se não houver empresa, criar uma nova com CNPJ único
    IF empresa_teste_id IS NULL THEN
        INSERT INTO empresas (id, nome, cnpj, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'Empresa Teste Grifo',
            '98.765.432/0001-10',
            now(),
            now()
        )
        RETURNING id INTO empresa_teste_id;
    END IF;
    
    -- Obter UIDs dos usuários criados no Supabase Auth
    SELECT id INTO vistoriador_uid FROM auth.users WHERE email = 'vistoriador.teste@grifo.com';
    SELECT id INTO gestor_uid FROM auth.users WHERE email = 'gestor.teste@grifo.com';
    
    -- Inserir usuário vistoriador no portal_users
    INSERT INTO portal_users (
        id,
        auth_user_id,
        nome,
        email,
        role,
        permissions,
        empresa_id,
        can_create_vistorias,
        can_edit_vistorias,
        can_view_all_company_data,
        ativo,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        vistoriador_uid,
        'Vistoriador Teste',
        'vistoriador.teste@grifo.com',
        'vistoriador',
        '["vistorias.read", "vistorias.create", "vistorias.update"]'::jsonb,
        empresa_teste_id,
        true,
        true,
        false,
        true,
        now(),
        now()
    )
    ON CONFLICT (email) DO NOTHING;
    
    -- Inserir usuário gestor no portal_users
    INSERT INTO portal_users (
        id,
        auth_user_id,
        nome,
        email,
        role,
        permissions,
        empresa_id,
        can_create_vistorias,
        can_edit_vistorias,
        can_view_all_company_data,
        ativo,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        gestor_uid,
        'Gestor Teste',
        'gestor.teste@grifo.com',
        'gestor',
        '["vistorias.read", "vistorias.create", "vistorias.update", "vistorias.delete", "users.read", "users.create", "users.update", "reports.read"]'::jsonb,
        empresa_teste_id,
        true,
        true,
        true,
        true,
        now(),
        now()
    )
    ON CONFLICT (email) DO NOTHING;
END $$;