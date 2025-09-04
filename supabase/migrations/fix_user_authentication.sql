-- Corrigir autenticação do usuário de teste

-- 1. Atualizar senha no auth.users (usando bcrypt)
UPDATE auth.users 
SET 
    encrypted_password = crypt('123456789', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE email = 'paranhoscontato.n@gmail.com';

-- 2. Atualizar senha no public.users (usando bcrypt)
UPDATE public.users 
SET 
    password_hash = crypt('123456789', gen_salt('bf')),
    is_active = true,
    status = 'active',
    first_login_completed = true,
    updated_at = NOW()
WHERE email = 'paranhoscontato.n@gmail.com';

-- 3. Garantir que o auth_user_id está correto
UPDATE public.users 
SET auth_user_id = (
    SELECT id FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com'
)
WHERE email = 'paranhoscontato.n@gmail.com' 
    AND auth_user_id IS NULL;

-- 4. Verificar resultado final
SELECT 
    'Verificação Final' as status,
    au.email as auth_email,
    pu.email as public_email,
    au.email_confirmed_at IS NOT NULL as email_confirmed,
    pu.is_active,
    pu.status,
    pu.user_type,
    pu.role,
    (au.id = pu.auth_user_id) as auth_linked
FROM auth.users au
JOIN public.users pu ON au.id = pu.auth_user_id
WHERE au.email = 'paranhoscontato.n@gmail.com';

-- 5. Testar hash da senha
SELECT 
    'Teste Senha Auth' as teste,
    email,
    (encrypted_password = crypt('123456789', encrypted_password)) as senha_auth_ok
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com'

UNION ALL

SELECT 
    'Teste Senha Public' as teste,
    email,
    (password_hash = crypt('123456789', password_hash)) as senha_public_ok
FROM public.users 
WHERE email = 'paranhoscontato.n@gmail.com';