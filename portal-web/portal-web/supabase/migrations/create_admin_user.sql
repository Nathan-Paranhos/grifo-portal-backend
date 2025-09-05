-- Criar usuário admin no Supabase apenas se não existir
-- Primeiro, inserir na tabela auth.users
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin
) 
SELECT 
    gen_random_uuid(),
    'paranhoscontato.n@gmail.com',
    crypt('23362336@Np10', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Admin User"}',
    false
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com'
);

-- Inserir na tabela portal_users vinculando ao auth.users
INSERT INTO portal_users (
    id,
    email,
    nome,
    role,
    auth_user_id,
    first_login_completed,
    created_at,
    updated_at
) 
SELECT 
    gen_random_uuid(),
    'paranhoscontato.n@gmail.com',
    'Administrador',
    'admin',
    au.id,
    true,
    NOW(),
    NOW()
FROM auth.users au
WHERE au.email = 'paranhoscontato.n@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM portal_users pu WHERE pu.email = 'paranhoscontato.n@gmail.com'
);

-- Verificar se o usuário foi criado
SELECT 
    'SUCCESS: Admin user created' as status,
    au.email,
    au.id as auth_id,
    pu.id as portal_id,
    pu.role
FROM auth.users au
JOIN portal_users pu ON au.id = pu.auth_user_id
WHERE au.email = 'paranhoscontato.n@gmail.com';