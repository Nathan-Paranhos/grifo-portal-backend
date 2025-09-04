-- Verificar vinculação entre auth.users e portal_users
-- Email: paranhoscontato.n@gmail.com

-- 1. Verificar usuário no auth.users
SELECT 
    'auth.users' as tabela,
    id as auth_user_id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 2. Verificar usuário no portal_users
SELECT 
    'portal_users' as tabela,
    id as portal_user_id,
    email,
    nome,
    role,
    auth_user_id,
    ativo,
    created_at
FROM portal_users 
WHERE email = 'paranhoscontato.n@gmail.com';

-- 3. Verificar se há vinculação correta
SELECT 
    'vinculacao' as info,
    au.id as auth_id,
    au.email as auth_email,
    pu.id as portal_id,
    pu.email as portal_email,
    pu.auth_user_id,
    CASE 
        WHEN pu.auth_user_id = au.id THEN 'VINCULADO'
        WHEN pu.auth_user_id IS NULL THEN 'NAO_VINCULADO'
        ELSE 'VINCULACAO_INCORRETA'
    END as status_vinculacao
FROM auth.users au
FULL OUTER JOIN portal_users pu ON au.email = pu.email
WHERE au.email = 'paranhoscontato.n@gmail.com' OR pu.email = 'paranhoscontato.n@gmail.com';

-- 4. Corrigir vinculação se necessário
DO $$
DECLARE
    auth_id UUID;
    portal_id UUID;
BEGIN
    -- Buscar IDs
    SELECT id INTO auth_id FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';
    SELECT id INTO portal_id FROM portal_users WHERE email = 'paranhoscontato.n@gmail.com';
    
    RAISE NOTICE 'Auth ID: %, Portal ID: %', auth_id, portal_id;
    
    -- Se ambos existem, fazer a vinculação
    IF auth_id IS NOT NULL AND portal_id IS NOT NULL THEN
        UPDATE portal_users 
        SET auth_user_id = auth_id 
        WHERE id = portal_id AND (auth_user_id IS NULL OR auth_user_id != auth_id);
        
        RAISE NOTICE 'Vinculação atualizada entre auth_user_id % e portal_user_id %', auth_id, portal_id;
    END IF;
END $$;

-- 5. Verificação final
SELECT 
    'RESULTADO_FINAL' as info,
    au.id as auth_user_id,
    pu.id as portal_user_id,
    pu.email,
    pu.nome,
    pu.role,
    pu.ativo,
    pu.auth_user_id as vinculado_com,
    CASE 
        WHEN pu.auth_user_id = au.id THEN 'OK - PRONTO PARA LOGIN'
        ELSE 'ERRO - VINCULACAO INCORRETA'
    END as status
FROM auth.users au
JOIN portal_users pu ON au.email = pu.email
WHERE au.email = 'paranhoscontato.n@gmail.com';