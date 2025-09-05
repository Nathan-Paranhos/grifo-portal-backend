-- Verificar se o usuário foi criado corretamente no Supabase Auth

-- Verificar usuário na tabela auth.users
SELECT 
    'auth.users' as tabela,
    id,
    email,
    encrypted_password IS NOT NULL as has_password,
    email_confirmed_at IS NOT NULL as email_confirmed,
    created_at,
    updated_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar usuário na tabela portal_users
SELECT 
    'portal_users' as tabela,
    id,
    auth_user_id,
    email,
    nome,
    role,
    ativo,
    first_login_completed,
    created_at
FROM portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar se há correspondência entre as tabelas
SELECT 
    'correspondencia' as status,
    au.id as auth_user_id,
    au.email as auth_email,
    pu.id as portal_user_id,
    pu.email as portal_email,
    pu.auth_user_id as linked_auth_id,
    CASE 
        WHEN au.id = pu.auth_user_id THEN 'CORRETO'
        ELSE 'INCORRETO'
    END as vinculacao
FROM auth.users au
FULL OUTER JOIN portal_users pu ON au.email = pu.email
WHERE au.email = 'paranhoscontato.n@gmail.com' OR pu.email = 'paranhoscontato.n@gmail.com';

-- Testar se a senha está correta
SELECT 
    'teste_senha' as status,
    email,
    crypt('123456789', encrypted_password) = encrypted_password as senha_correta
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar permissões da tabela portal_users
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND table_name = 'portal_users'
    AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;