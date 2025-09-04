-- Inserir o usuário na tabela portal_users se não existir
INSERT INTO public.portal_users (
    nome,
    email,
    auth_user_id,
    first_login_completed,
    ativo,
    created_at,
    updated_at
)
SELECT 
    'Super Admin',
    'paranhoscontato.n@gmail.com',
    au.id,
    true,
    true,
    NOW(),
    NOW()
FROM auth.users au
WHERE au.email = 'paranhoscontato.n@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM public.portal_users pu 
    WHERE pu.auth_user_id = au.id
);

-- Verificar se foi inserido
SELECT 
    pu.id,
    pu.nome,
    pu.email,
    pu.auth_user_id,
    pu.first_login_completed,
    pu.ativo
FROM public.portal_users pu
WHERE pu.email = 'paranhoscontato.n@gmail.com';