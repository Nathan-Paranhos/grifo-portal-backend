-- Reset completo do usuário super admin
-- Trabalha com triggers existentes e usa UUIDs diferentes

DO $$
DECLARE
    target_email TEXT := 'paranhoscontato.n@gmail.com';
    new_user_id UUID;
    existing_auth_id UUID;
BEGIN
    -- Log início
    RAISE NOTICE 'Iniciando reset do usuário: %', target_email;
    
    -- 1. Buscar e remover usuário existente
    SELECT id INTO existing_auth_id FROM auth.users WHERE email = target_email;
    
    IF existing_auth_id IS NOT NULL THEN
        RAISE NOTICE 'Usuário encontrado em auth.users com ID: %', existing_auth_id;
        
        -- Remover de portal_users primeiro
        DELETE FROM public.portal_users WHERE auth_user_id = existing_auth_id OR email = target_email;
        RAISE NOTICE 'Removido usuário de portal_users';
        
        -- Remover de public.users
        DELETE FROM public.users WHERE auth_user_id = existing_auth_id OR email = target_email;
        RAISE NOTICE 'Removido usuário de public.users';
        
        -- Remover identidades
        DELETE FROM auth.identities WHERE user_id = existing_auth_id;
        RAISE NOTICE 'Removidas identidades do auth.identities';
        
        -- Remover de auth.users por último
        DELETE FROM auth.users WHERE id = existing_auth_id;
        RAISE NOTICE 'Removido usuário de auth.users';
    ELSE
        -- Limpar registros órfãos
        DELETE FROM public.portal_users WHERE email = target_email;
        DELETE FROM public.users WHERE email = target_email;
        RAISE NOTICE 'Removidos registros órfãos';
    END IF;
    
    -- 2. Gerar novo UUID
    new_user_id := gen_random_uuid();
    RAISE NOTICE 'Novo UUID gerado: %', new_user_id;
    
    -- 3. Criar novo usuário em auth.users (trigger criará automaticamente em public.users)
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
        role,
        is_super_admin,
        raw_app_meta_data,
        raw_user_meta_data
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        target_email,
        crypt('Teste@2025', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '',
        '',
        '',
        '',
        'authenticated',
        'authenticated',
        false,
        '{}',
        json_build_object('nome', 'Super Admin')
    );
    
    RAISE NOTICE 'Criado novo usuário em auth.users';
    
    -- 4. Aguardar para que o trigger processe
    PERFORM pg_sleep(1);
    
    -- 5. Atualizar o usuário criado pelo trigger em public.users
    UPDATE public.users SET
        nome = 'Super Admin',
        name = 'Super Admin',
        role = 'super_admin',
        user_type = 'super_admin',
        can_create_vistorias = true,
        can_edit_vistorias = true,
        can_view_all_company_data = true,
        is_active = true,
        status = 'active',
        first_login_completed = true,
        password_changed_at = NOW(),
        updated_at = NOW()
    WHERE auth_user_id = new_user_id;
    
    IF FOUND THEN
        RAISE NOTICE 'Atualizado usuário em public.users criado pelo trigger';
    ELSE
        RAISE NOTICE 'AVISO: Usuário não encontrado em public.users para atualização';
    END IF;
    
    -- 6. Criar identidade em auth.identities
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        new_user_id,
        json_build_object('sub', new_user_id::text, 'email', target_email),
        'email',
        new_user_id::text,
        NOW(),
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Criada identidade em auth.identities';
    
    -- 7. Criar usuário em portal_users (com UUID diferente)
    INSERT INTO public.portal_users (
        id,
        auth_user_id,
        email,
        nome,
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
        new_user_id,
        target_email,
        'Super Admin',
        'super_admin',
        '{"all": true}',
        true,
        true,
        true,
        true,
        true,
        NOW(),
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Criado usuário em portal_users';
    
    -- 8. Verificação final
    PERFORM 1 FROM auth.users WHERE id = new_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Erro: Usuário não encontrado em auth.users após criação';
    END IF;
    
    PERFORM 1 FROM public.users WHERE auth_user_id = new_user_id;
    IF NOT FOUND THEN
        RAISE NOTICE 'AVISO: Usuário não encontrado em public.users - trigger pode não ter funcionado';
    END IF;
    
    PERFORM 1 FROM public.portal_users WHERE auth_user_id = new_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Erro: Usuário não encontrado em portal_users após criação';
    END IF;
    
    PERFORM 1 FROM auth.identities WHERE user_id = new_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Erro: Identidade não encontrada em auth.identities após criação';
    END IF;
    
    RAISE NOTICE 'Reset do usuário concluído com sucesso!';
    RAISE NOTICE 'Email: %', target_email;
    RAISE NOTICE 'Senha: Teste@2025';
    RAISE NOTICE 'Auth User ID: %', new_user_id;
    
END $$;