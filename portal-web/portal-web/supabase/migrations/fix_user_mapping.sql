-- Verificar e corrigir mapeamento entre auth.users e public.users

-- 1. Primeiro, vamos ver todos os usuários auth.users
SELECT 'auth.users existentes:' as info;
SELECT id, email, created_at FROM auth.users ORDER BY created_at;

-- 2. Ver todos os usuários public.users
SELECT 'public.users existentes:' as info;
SELECT id, auth_user_id, email, name, role, is_active FROM public.users ORDER BY created_at;

-- 3. Verificar se há mapeamento correto
SELECT 'Mapeamento auth -> public:' as info;
SELECT 
    au.email as auth_email,
    au.id as auth_id,
    pu.email as public_email,
    pu.auth_user_id as public_auth_id,
    pu.role,
    pu.is_active
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.auth_user_id
WHERE au.email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com')
ORDER BY au.email;

-- 4. Corrigir mapeamento se necessário
DO $$
DECLARE
    admin_auth_id uuid;
    client_auth_id uuid;
    admin_public_exists boolean := false;
    client_public_exists boolean := false;
BEGIN
    -- Buscar IDs dos usuários auth
    SELECT id INTO admin_auth_id FROM auth.users WHERE email = 'visionariaev@gmail.com';
    SELECT id INTO client_auth_id FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';
    
    RAISE NOTICE 'Admin auth ID: %', admin_auth_id;
    RAISE NOTICE 'Client auth ID: %', client_auth_id;
    
    -- Verificar se já existem na tabela public.users
    SELECT EXISTS(SELECT 1 FROM public.users WHERE auth_user_id = admin_auth_id) INTO admin_public_exists;
    SELECT EXISTS(SELECT 1 FROM public.users WHERE auth_user_id = client_auth_id) INTO client_public_exists;
    
    -- Criar usuário admin na tabela public se não existir
    IF admin_auth_id IS NOT NULL AND NOT admin_public_exists THEN
        INSERT INTO public.users (
            id, auth_user_id, name, email, role, user_type, is_active, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            admin_auth_id,
            'Visionaria Admin',
            'visionariaev@gmail.com',
            'admin',
            'admin',
            true,
            NOW(), NOW()
        );
        RAISE NOTICE 'Usuário admin criado na tabela public.users';
    ELSE
        RAISE NOTICE 'Usuário admin já existe na tabela public.users ou auth_id não encontrado';
    END IF;
    
    -- Criar usuário client na tabela public se não existir
    IF client_auth_id IS NOT NULL AND NOT client_public_exists THEN
        INSERT INTO public.users (
            id, auth_user_id, name, email, role, user_type, is_active, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            client_auth_id,
            'Paranhos User',
            'paranhoscontato.n@gmail.com',
            'client',
            'client',
            true,
            NOW(), NOW()
        );
        RAISE NOTICE 'Usuário client criado na tabela public.users';
    ELSE
        RAISE NOTICE 'Usuário client já existe na tabela public.users ou auth_id não encontrado';
    END IF;
END $$;

-- 5. Verificar resultado final
SELECT 'Resultado final - Mapeamento:' as info;
SELECT 
    au.email as auth_email,
    au.id as auth_id,
    pu.email as public_email,
    pu.auth_user_id as public_auth_id,
    pu.role,
    pu.is_active
FROM auth.users au
JOIN public.users pu ON au.id = pu.auth_user_id
WHERE au.email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com')
ORDER BY au.email;