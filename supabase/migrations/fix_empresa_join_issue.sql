-- Verificar e corrigir problema com join da empresa

-- 1. Verificar se existe empresa
SELECT 'EMPRESAS EXISTENTES:' as info, id, nome, cnpj FROM empresas;

-- 2. Verificar o usuário portal sem join
SELECT 
    'PORTAL USER SEM JOIN:' as info,
    id,
    auth_user_id,
    email,
    nome,
    ativo,
    empresa_id
FROM portal_users
WHERE auth_user_id = '424e8e60-5b18-46d4-91e2-80baa090f523';

-- 3. Verificar se o empresa_id existe na tabela empresas
SELECT 
    'VERIFICAR EMPRESA_ID:' as info,
    pu.email,
    pu.empresa_id,
    e.id as empresa_exists,
    e.nome as empresa_nome
FROM portal_users pu
LEFT JOIN empresas e ON pu.empresa_id = e.id
WHERE pu.auth_user_id = '424e8e60-5b18-46d4-91e2-80baa090f523';

-- 4. Se não houver empresa, criar uma e atualizar o usuário
DO $$
DECLARE
    empresa_id_var UUID;
    user_empresa_id UUID;
BEGIN
    -- Verificar se o usuário tem empresa_id válido
    SELECT empresa_id INTO user_empresa_id 
    FROM portal_users 
    WHERE auth_user_id = '424e8e60-5b18-46d4-91e2-80baa090f523';
    
    -- Verificar se a empresa existe
    SELECT id INTO empresa_id_var FROM empresas WHERE id = user_empresa_id;
    
    -- Se a empresa não existir, criar uma nova
    IF empresa_id_var IS NULL THEN
        INSERT INTO empresas (nome, cnpj, email, telefone, endereco)
        VALUES (
            'Grifo Vistorias Ltda',
            '44.555.666/0001-77',
            'contato@grifovistorias.com',
            '(11) 5555-5555',
            'Av. Paulista, 1000 - São Paulo, SP'
        ) RETURNING id INTO empresa_id_var;
        
        -- Atualizar o usuário com a nova empresa
        UPDATE portal_users 
        SET empresa_id = empresa_id_var
        WHERE auth_user_id = '424e8e60-5b18-46d4-91e2-80baa090f523';
        
        RAISE NOTICE 'Nova empresa criada e usuário atualizado';
    ELSE
        RAISE NOTICE 'Empresa já existe: %', empresa_id_var;
    END IF;
END $$;

-- 5. Verificar resultado final
SELECT 
    'RESULTADO FINAL:' as info,
    pu.email,
    pu.nome,
    pu.ativo,
    pu.empresa_id,
    e.nome as empresa_nome
FROM portal_users pu
JOIN empresas e ON pu.empresa_id = e.id
WHERE pu.auth_user_id = '424e8e60-5b18-46d4-91e2-80baa090f523';