-- Corrigir senha do usuário super admin
-- Email: paranhoscontato.n@gmail.com
-- Senha: Teste@2025

-- 1. Primeiro, vamos verificar se o usuário existe
DO $$
DECLARE
    user_id_var uuid;
    user_exists boolean := false;
BEGIN
    -- Verificar se o usuário existe
    SELECT id INTO user_id_var 
    FROM auth.users 
    WHERE email = 'paranhoscontato.n@gmail.com';
    
    IF user_id_var IS NOT NULL THEN
        user_exists := true;
        RAISE NOTICE 'Usuário encontrado com ID: %', user_id_var;
    ELSE
        RAISE NOTICE 'Usuário NÃO encontrado!';
    END IF;
    
    -- Se o usuário existe, vamos atualizar a senha
    IF user_exists THEN
        -- Atualizar a senha usando crypt do PostgreSQL
        -- A senha 'Teste@2025' será criptografada
        UPDATE auth.users 
        SET 
            encrypted_password = crypt('Teste@2025', gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = user_id_var;
        
        RAISE NOTICE 'Senha atualizada para o usuário: %', 'paranhoscontato.n@gmail.com';
        
        -- Verificar se a atualização foi bem-sucedida
        IF FOUND THEN
            RAISE NOTICE 'Atualização de senha bem-sucedida!';
        ELSE
            RAISE NOTICE 'Falha na atualização da senha!';
        END IF;
        
        -- Atualizar também o first_login_completed nas tabelas relacionadas
        UPDATE public.users 
        SET first_login_completed = true,
            password_changed_at = NOW()
        WHERE auth_user_id = user_id_var;
        
        UPDATE public.portal_users 
        SET first_login_completed = true,
            password_changed_at = NOW()
        WHERE auth_user_id = user_id_var;
        
        RAISE NOTICE 'Flags de primeiro login atualizadas!';
    END IF;
END $$;

-- 2. Verificar o resultado final
SELECT 
    'Verificação final' as status,
    email,
    CASE 
        WHEN encrypted_password IS NOT NULL AND encrypted_password != '' THEN 'Senha definida'
        ELSE 'Senha NÃO definida'
    END as status_senha,
    email_confirmed_at IS NOT NULL as email_confirmado,
    created_at,
    updated_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 3. Verificar as tabelas relacionadas
SELECT 
    'public.users' as tabela,
    email,
    first_login_completed,
    password_changed_at
FROM public.users 
WHERE email = 'paranhoscontato.n@gmail.com';

SELECT 
    'public.portal_users' as tabela,
    email,
    first_login_completed,
    password_changed_at
FROM public.portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';