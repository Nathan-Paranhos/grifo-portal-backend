-- Verificar se o usuário admin foi criado corretamente

-- Verificar na tabela auth.users
SELECT 
    'AUTH USERS:' as table_name,
    id,
    email,
    email_confirmed_at IS NOT NULL as email_confirmed,
    created_at
FROM auth.users 
WHERE email = 'grifo.admin@teste.com';

-- Verificar na tabela portal_users
SELECT 
    'PORTAL USERS:' as table_name,
    id,
    auth_user_id,
    email,
    nome,
    role,
    ativo,
    empresa_id,
    created_at
FROM portal_users 
WHERE email = 'grifo.admin@teste.com';

-- Verificar join entre as tabelas
SELECT 
    'JOIN VERIFICATION:' as table_name,
    au.email as auth_email,
    au.id as auth_id,
    pu.email as portal_email,
    pu.auth_user_id as portal_auth_id,
    pu.nome,
    pu.ativo,
    pu.role,
    e.nome as empresa_nome
FROM auth.users au
LEFT JOIN portal_users pu ON au.id = pu.auth_user_id
LEFT JOIN empresas e ON pu.empresa_id = e.id
WHERE au.email = 'grifo.admin@teste.com';

-- Verificar se há algum problema com a empresa
SELECT 
    'EMPRESAS:' as table_name,
    id,
    nome,
    cnpj,
    email
FROM empresas
LIMIT 3;