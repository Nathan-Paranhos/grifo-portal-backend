-- Criar usuário de teste para resolver problema de autenticação

-- 1. Primeiro, verificar se o usuário já existe no auth.users
DO $$
DECLARE
    auth_user_uuid uuid;
    existing_user_count integer;
BEGIN
    -- Verificar se já existe no auth.users
    SELECT COUNT(*) INTO existing_user_count 
    FROM auth.users 
    WHERE email = 'paranhoscontato.n@gmail.com';
    
    IF existing_user_count = 0 THEN
        -- Inserir no auth.users se não existir
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
            'paranhoscontato.n@gmail.com',
            crypt('123456789', gen_salt('bf')), -- senha: 123456789
            NOW(),
            NOW(),
            NOW(),
            '',
            '',
            '',
            '',
            'authenticated',
            'authenticated'
        ) RETURNING id INTO auth_user_uuid;
        
        RAISE NOTICE 'Usuário criado no auth.users com ID: %', auth_user_uuid;
    ELSE
        -- Pegar o ID do usuário existente
        SELECT id INTO auth_user_uuid 
        FROM auth.users 
        WHERE email = 'paranhoscontato.n@gmail.com';
        
        RAISE NOTICE 'Usuário já existe no auth.users com ID: %', auth_user_uuid;
    END IF;
    
    -- Verificar se já existe no public.users
    SELECT COUNT(*) INTO existing_user_count 
    FROM public.users 
    WHERE email = 'paranhoscontato.n@gmail.com';
    
    IF existing_user_count = 0 THEN
        -- Inserir no public.users se não existir
        INSERT INTO public.users (
            id,
            email,
            nome,
            name,
            user_type,
            role,
            is_active,
            status,
            auth_user_id,
            password_hash,
            first_login_completed,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'paranhoscontato.n@gmail.com',
            'Usuário Teste',
            'Usuário Teste',
            'admin',
            'admin',
            true,
            'active',
            auth_user_uuid,
            crypt('123456789', gen_salt('bf')), -- senha: 123456789
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Usuário criado no public.users';
    ELSE
        -- Atualizar o auth_user_id se necessário
        UPDATE public.users 
        SET 
            auth_user_id = auth_user_uuid,
            is_active = true,
            status = 'active',
            updated_at = NOW()
        WHERE email = 'paranhoscontato.n@gmail.com' 
            AND (auth_user_id IS NULL OR auth_user_id != auth_user_uuid);
        
        RAISE NOTICE 'Usuário atualizado no public.users';
    END IF;
END $$;

-- 2. Garantir permissões para as tabelas
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.users TO anon;

-- 3. Verificar o resultado final
SELECT 
    au.id as auth_id,
    au.email as auth_email,
    au.email_confirmed_at,
    pu.id as user_id,
    pu.email as user_email,
    pu.auth_user_id,
    pu.is_active,
    pu.status,
    pu.user_type,
    pu.role
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_user_id
WHERE au.email = 'paranhoscontato.n@gmail.com';