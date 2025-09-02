-- Consultar usuários existentes
SELECT 
    'auth.users' as tabela,
    email,
    created_at,
    email_confirmed_at,
    CASE WHEN encrypted_password IS NOT NULL THEN 'Sim' ELSE 'Não' END as tem_senha
FROM auth.users 
WHERE email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com')
ORDER BY email;

-- Consultar identidades
SELECT 
    'auth.identities' as tabela,
    i.provider,
    i.identity_data->>'email' as email,
    i.created_at
FROM auth.identities i
JOIN auth.users u ON i.user_id = u.id
WHERE u.email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com')
ORDER BY i.identity_data->>'email';

-- Consultar usuários na tabela public
SELECT 
    'public.users' as tabela,
    email,
    role,
    name,
    created_at
FROM public.users 
WHERE email IN ('visionariaev@gmail.com', 'paranhoscontato.n@gmail.com')
ORDER BY email;

-- Contar total de usuários
SELECT 'Total usuários auth.users' as info, count(*) as total FROM auth.users;
SELECT 'Total usuários public.users' as info, count(*) as total FROM public.users;