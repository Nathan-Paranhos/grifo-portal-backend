-- QA Database Validation Script
-- Validação completa da estrutura e integridade do banco de dados

-- 1. Verificar constraints de chave primária
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 2. Verificar constraints de chave estrangeira
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 3. Verificar índices existentes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 4. Verificar constraints de NOT NULL
SELECT 
    table_name,
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
    AND is_nullable = 'NO'
ORDER BY table_name, column_name;

-- 5. Verificar constraints UNIQUE
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 6. Verificar integridade referencial - registros órfãos
-- Verificar vistorias sem empresa válida
SELECT 'vistorias_sem_empresa' as issue, COUNT(*) as count
FROM vistorias v
LEFT JOIN empresas e ON v.empresa_id = e.id
WHERE e.id IS NULL;

-- Verificar vistorias sem imóvel válido
SELECT 'vistorias_sem_imovel' as issue, COUNT(*) as count
FROM vistorias v
LEFT JOIN imoveis i ON v.imovel_id = i.id
WHERE i.id IS NULL;

-- Verificar fotos sem vistoria válida
SELECT 'fotos_sem_vistoria' as issue, COUNT(*) as count
FROM fotos f
LEFT JOIN vistorias v ON f.vistoria_id = v.id
WHERE v.id IS NULL;

-- Verificar itens_vistoria sem vistoria válida
SELECT 'itens_sem_vistoria' as issue, COUNT(*) as count
FROM itens_vistoria iv
LEFT JOIN vistorias v ON iv.vistoria_id = v.id
WHERE v.id IS NULL;

-- 7. Verificar dados duplicados
-- Verificar emails duplicados em users
SELECT 'users_email_duplicado' as issue, email, COUNT(*) as count
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- Verificar emails duplicados em portal_users
SELECT 'portal_users_email_duplicado' as issue, email, COUNT(*) as count
FROM portal_users
GROUP BY email
HAVING COUNT(*) > 1;

-- 8. Verificar estatísticas das tabelas principais
SELECT 'empresas' as tabela, COUNT(*) as total_registros FROM empresas
UNION ALL
SELECT 'users' as tabela, COUNT(*) as total_registros FROM users
UNION ALL
SELECT 'portal_users' as tabela, COUNT(*) as total_registros FROM portal_users
UNION ALL
SELECT 'imoveis' as tabela, COUNT(*) as total_registros FROM imoveis
UNION ALL
SELECT 'vistorias' as tabela, COUNT(*) as total_registros FROM vistorias
UNION ALL
SELECT 'fotos' as tabela, COUNT(*) as total_registros FROM fotos
UNION ALL
SELECT 'itens_vistoria' as tabela, COUNT(*) as total_registros FROM itens_vistoria
UNION ALL
SELECT 'contestacoes' as tabela, COUNT(*) as total_registros FROM contestacoes;

-- 9. Verificar campos obrigatórios com valores nulos
SELECT 'empresas_nome_null' as issue, COUNT(*) as count
FROM empresas WHERE nome IS NULL OR nome = '';

SELECT 'users_email_null' as issue, COUNT(*) as count
FROM users WHERE email IS NULL OR email = '';

SELECT 'vistorias_status_null' as issue, COUNT(*) as count
FROM vistorias WHERE status IS NULL OR status = '';

-- 10. Verificar RLS (Row Level Security)
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;