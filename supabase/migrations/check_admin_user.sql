-- Verificar se o usuário admin existe na tabela auth.users
SELECT 
    'auth.users' as table_name,
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar se o usuário existe na tabela portal_users
SELECT 
    'portal_users' as table_name,
    pu.id,
    pu.email,
    pu.role,
    pu.created_at,
    au.id as auth_user_id
FROM portal_users pu
LEFT JOIN auth.users au ON pu.auth_user_id = au.id
WHERE pu.email = 'paranhoscontato.n@gmail.com';

-- Verificar se o usuário existe na tabela app_users
SELECT 
    'app_users' as table_name,
    ap.id,
    ap.email,
    ap.role,
    ap.created_at,
    au.id as auth_user_id
FROM app_users ap
LEFT JOIN auth.users au ON ap.auth_user_id = au.id
WHERE ap.email = 'paranhoscontato.n@gmail.com';

-- Verificar se o usuário existe na tabela users (legacy)
SELECT 
    'users' as table_name,
    u.id,
    u.email,
    u.role,
    u.created_at,
    au.id as auth_user_id
FROM users u
LEFT JOIN auth.users au ON u.auth_user_id = au.id
WHERE u.email = 'paranhoscontato.n@gmail.com';