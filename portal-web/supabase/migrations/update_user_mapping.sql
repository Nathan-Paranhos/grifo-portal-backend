-- Corrigir mapeamento entre auth.users e public.users
-- Atualizar auth_user_id na tabela public.users

DO $$
DECLARE
    admin_auth_id uuid;
    client_auth_id uuid;
    admin_updated boolean := false;
    client_updated boolean := false;
BEGIN
    -- Buscar IDs dos usuários auth
    SELECT id INTO admin_auth_id FROM auth.users WHERE email = 'visionariaev@gmail.com';
    SELECT id INTO client_auth_id FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';
    
    RAISE NOTICE 'Admin auth ID encontrado: %', admin_auth_id;
    RAISE NOTICE 'Client auth ID encontrado: %', client_auth_id;
    
    -- Atualizar usuário admin
    IF admin_auth_id IS NOT NULL THEN
        UPDATE public.users 
        SET auth_user_id = admin_auth_id,
            updated_at = NOW()
        WHERE email = 'visionariaev@gmail.com'
        AND (auth_user_id IS NULL OR auth_user_id != admin_auth_id);
        
        GET DIAGNOSTICS admin_updated = FOUND;
        
        IF admin_updated THEN
            RAISE NOTICE 'Usuário admin atualizado com sucesso';
        ELSE
            RAISE NOTICE 'Usuário admin já estava correto ou não foi encontrado';
        END IF;
    END IF;
    
    -- Atualizar usuário client
    IF client_auth_id IS NOT NULL THEN
        UPDATE public.users 
        SET auth_user_id = client_auth_id,
            updated_at = NOW()
        WHERE email = 'paranhoscontato.n@gmail.com'
        AND (auth_user_id IS NULL OR auth_user_id != client_auth_id);
        
        GET DIAGNOSTICS client_updated = FOUND;
        
        IF client_updated THEN
            RAISE NOTICE 'Usuário client atualizado com sucesso';
        ELSE
            RAISE NOTICE 'Usuário client já estava correto ou não foi encontrado';
        END IF;
    END IF;
    
    -- Garantir que os usuários estão ativos
    UPDATE public.users 
    SET is_active = true,
        updated_at = NOW()
    WHERE email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com')
    AND is_active = false;
    
END $$;

-- Verificar resultado final
SELECT 'Resultado final após correção:' as info;
SELECT 
    au.email as auth_email,
    au.id as auth_user_id,
    pu.id as public_user_id,
    pu.auth_user_id as mapped_auth_id,
    pu.email as public_email,
    pu.role,
    pu.user_type,
    pu.is_active,
    CASE 
        WHEN au.id = pu.auth_user_id THEN 'CORRETO ✓'
        ELSE 'INCORRETO ✗'
    END as mapeamento_status
FROM auth.users au
JOIN public.users pu ON au.email = pu.email
WHERE au.email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com')
ORDER BY au.email;