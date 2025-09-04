-- Verificar usuários existentes no sistema
-- Consulta para listar todos os usuários do portal
SELECT 
    pu.id as portal_user_id,
    pu.email,
    pu.nome,
    pu.role,
    pu.empresa_id,
    e.nome as empresa_nome,
    pu.created_at as portal_created_at
FROM portal_users pu
LEFT JOIN empresas e ON pu.empresa_id = e.id
ORDER BY pu.created_at DESC;

-- Consulta para listar usuários do Supabase Auth
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    raw_app_meta_data
FROM auth.users
ORDER BY created_at DESC;

-- Verificar empresas existentes
SELECT 
    id,
    nome,
    cnpj,
    created_at
FROM empresas
ORDER BY created_at DESC;

-- Contar total de registros
SELECT 
    'portal_users' as tabela,
    COUNT(*) as total
FROM portal_users
UNION ALL
SELECT 
    'auth.users' as tabela,
    COUNT(*) as total
FROM auth.users
UNION ALL
SELECT 
    'empresas' as tabela,
    COUNT(*) as total
FROM empresas;