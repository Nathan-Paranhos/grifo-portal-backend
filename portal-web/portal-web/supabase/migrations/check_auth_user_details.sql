-- Verificar detalhes completos do usuário no Supabase Auth
-- Email: paranhoscontato.n@gmail.com

-- 1. Verificar usuário no auth.users com todos os detalhes
SELECT 
    'auth.users_details' as info,
    id,
    email,
    encrypted_password IS NOT NULL as has_password,
    email_confirmed_at IS NOT NULL as email_confirmed,
    phone_confirmed_at IS NOT NULL as phone_confirmed,
    created_at,
    updated_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 2. Verificar identidades do usuário
SELECT 
    'auth.identities' as info,
    i.id,
    i.user_id,
    i.identity_data,
    i.provider,
    i.provider_id,
    i.created_at,
    i.updated_at
FROM auth.identities i
INNER JOIN auth.users u ON i.user_id = u.id
WHERE u.email = 'paranhoscontato.n@gmail.com';

-- 3. Verificar vinculação com portal_users
SELECT 
    'VINCULACAO_ATUAL' as info,
    au.id as auth_user_id,
    au.email as auth_email,
    au.encrypted_password IS NOT NULL as has_password,
    au.email_confirmed_at IS NOT NULL as email_confirmed,
    pu.id as portal_user_id,
    pu.email as portal_email,
    pu.nome,
    pu.role,
    pu.ativo,
    pu.auth_user_id as linked_auth_id,
    CASE 
        WHEN pu.auth_user_id = au.id THEN 'VINCULADO_CORRETO'
        WHEN pu.auth_user_id IS NULL THEN 'NAO_VINCULADO'
        ELSE 'VINCULACAO_INCORRETA'
    END as status_vinculacao,
    CASE 
        WHEN au.encrypted_password IS NULL THEN 'SEM_SENHA'
        WHEN au.email_confirmed_at IS NULL THEN 'EMAIL_NAO_CONFIRMADO'
        WHEN pu.ativo = false THEN 'USUARIO_INATIVO'
        WHEN pu.auth_user_id = au.id AND au.encrypted_password IS NOT NULL AND au.email_confirmed_at IS NOT NULL AND pu.ativo = true THEN 'PRONTO_PARA_LOGIN'
        ELSE 'VERIFICAR_OUTROS_PROBLEMAS'
    END as status_geral
FROM auth.users au
FULL OUTER JOIN portal_users pu ON au.email = pu.email
WHERE au.email = 'paranhoscontato.n@gmail.com' OR pu.email = 'paranhoscontato.n@gmail.com';

-- 4. Tentar corrigir problemas básicos
UPDATE auth.users 
SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE email = 'paranhoscontato.n@gmail.com' AND email_confirmed_at IS NULL;

-- 5. Corrigir vinculação se necessário
UPDATE portal_users 
SET auth_user_id = (
    SELECT id FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com'
)
WHERE email = 'paranhoscontato.n@gmail.com' 
AND (auth_user_id IS NULL OR auth_user_id != (
    SELECT id FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com'
));

-- 6. Verificação final após correções
SELECT 
    'RESULTADO_FINAL' as info,
    au.id as auth_user_id,
    au.email,
    au.encrypted_password IS NOT NULL as has_password,
    au.email_confirmed_at IS NOT NULL as email_confirmed,
    pu.id as portal_user_id,
    pu.nome,
    pu.role,
    pu.ativo,
    pu.auth_user_id,
    CASE 
        WHEN pu.auth_user_id = au.id AND au.encrypted_password IS NOT NULL AND au.email_confirmed_at IS NOT NULL AND pu.ativo = true THEN 'PRONTO_PARA_LOGIN'
        WHEN pu.auth_user_id != au.id THEN 'VINCULACAO_INCORRETA'
        WHEN au.encrypted_password IS NULL THEN 'SEM_SENHA'
        WHEN au.email_confirmed_at IS NULL THEN 'EMAIL_NAO_CONFIRMADO'
        WHEN pu.ativo = false THEN 'USUARIO_INATIVO'
        ELSE 'OUTRO_PROBLEMA'
    END as status
FROM auth.users au
JOIN portal_users pu ON au.email = pu.email
WHERE au.email = 'paranhoscontato.n@gmail.com';