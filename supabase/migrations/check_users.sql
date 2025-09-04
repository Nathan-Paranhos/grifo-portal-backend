-- Consulta para verificar usuários existentes
SELECT 
    pu.id,
    pu.email,
    pu.nome,
    pu.role,
    pu.ativo,
    e.nome as empresa_nome
FROM portal_users pu
LEFT JOIN empresas e ON pu.empresa_id = e.id
ORDER BY pu.created_at DESC
LIMIT 10;

-- Verificar também se há empresas cadastradas
SELECT 
    id,
    nome,
    cnpj,
    ativo
FROM empresas
ORDER BY created_at DESC
LIMIT 5;