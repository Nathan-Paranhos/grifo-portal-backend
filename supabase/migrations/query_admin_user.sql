-- Verificar se usuário existe em auth.users
SELECT 
    'auth.users' as table_name,
    email,
    id,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Verificar se usuário existe em portal_users  
SELECT 
    'portal_users' as table_name,
    email,
    id,
    created_at,
    role
FROM portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- Contar usuários totais
SELECT 'Total auth.users:' as info, COUNT(*) as total FROM auth.users;
SELECT 'Total portal_users:' as info, COUNT(*) as total FROM portal_users;