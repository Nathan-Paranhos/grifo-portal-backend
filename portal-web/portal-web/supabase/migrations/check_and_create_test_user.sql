-- Verificar se existe usuário com o email fornecido
SELECT 
    pu.id,
    pu.email,
    pu.nome,
    pu.role,
    pu.ativo,
    pu.auth_user_id,
    au.email as auth_email,
    au.created_at as auth_created_at
FROM portal_users pu
LEFT JOIN auth.users au ON pu.auth_user_id = au.id
WHERE pu.email = 'paranhoscontato.n@gmail.com';

-- Verificar usuários na tabela auth.users
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Se não existir, criar um usuário de teste (comentado por segurança)
/*
-- Primeiro, criar o usuário na tabela auth.users (isso normalmente é feito via Supabase Auth)
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
-- VALUES (
--     gen_random_uuid(),
--     'paranhoscontato.n@gmail.com',
--     crypt('sua_senha_aqui', gen_salt('bf')),
--     now(),
--     now(),
--     now()
-- );

-- Depois, criar o usuário na tabela portal_users
-- INSERT INTO portal_users (email, nome, role, ativo)
-- VALUES (
--     'paranhoscontato.n@gmail.com',
--     'Usuário Teste',
--     'admin',
--     true
-- );
*/

-- Verificar permissões da tabela portal_users
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'portal_users'
AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;