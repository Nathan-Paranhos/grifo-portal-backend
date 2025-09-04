-- Verificar se o usuário tem senha definida no Supabase Auth
-- Email: paranhoscontato.n@gmail.com

-- 1. Verificar dados completos do usuário na tabela auth.users
SELECT 
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    phone_confirmed_at,
    confirmation_sent_at,
    recovery_sent_at,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_change,
    email_change,
    email_change_confirm_status,
    banned_until,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 2. Verificar se há senha criptografada (não nula)
SELECT 
    email,
    CASE 
        WHEN encrypted_password IS NOT NULL AND encrypted_password != '' THEN 'Senha definida'
        ELSE 'Senha NÃO definida'
    END as status_senha,
    email_confirmed_at IS NOT NULL as email_confirmado,
    created_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 3. Verificar identities para este usuário
SELECT 
    ai.provider,
    ai.provider_id,
    ai.identity_data,
    ai.created_at,
    ai.updated_at
FROM auth.identities ai
JOIN auth.users au ON ai.user_id = au.id
WHERE au.email = 'paranhoscontato.n@gmail.com';

-- 4. Contar total de usuários na auth.users para debug
SELECT COUNT(*) as total_auth_users FROM auth.users;

-- 5. Listar todos os emails na auth.users para debug
SELECT email, created_at FROM auth.users ORDER BY created_at DESC