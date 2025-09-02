-- Verificar se o usuário existe na tabela portal_users
SELECT 
    id,
    email,
    nome,
    ativo,
    first_login_completed,
    auth_user_id
FROM portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar se existe na tabela auth.users
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';