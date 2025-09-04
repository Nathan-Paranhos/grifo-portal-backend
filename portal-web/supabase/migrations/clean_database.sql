-- Script de limpeza completa do banco de dados
-- Mantém apenas os usuários: paranhoscontato.n@gmail.com e visionariaev@gmail.com
-- Remove todos os dados de teste e mantém estrutura limpa

-- Desabilitar triggers temporariamente para evitar conflitos
SET session_replication_role = replica;

-- 1. Limpar dados relacionados a vistorias
DELETE FROM grifo_app_uploads;
DELETE FROM contest_links;
DELETE FROM contestacoes;
DELETE FROM visionaria_uploads;
DELETE FROM onedrive_sync_log;
DELETE FROM google_drive_sync_log;
DELETE FROM cloud_sync_settings;
DELETE FROM user_onedrive_tokens;
DELETE FROM user_google_tokens;
DELETE FROM vistoria_assignments;
DELETE FROM itens_vistoria;
DELETE FROM fotos;
DELETE FROM vistorias;

-- 2. Limpar dados de imóveis
DELETE FROM imoveis;

-- 3. Limpar dados do portal de clientes
DELETE FROM notifications;
DELETE FROM client_sessions;
DELETE FROM inspection_comments;
DELETE FROM inspection_files;
DELETE FROM inspection_requests;
DELETE FROM clients;

-- 4. Limpar usuários do app e portal (exceto os especificados)
DELETE FROM app_users 
WHERE email NOT IN ('paranhoscontato.n@gmail.com', 'visionariaev@gmail.com');

DELETE FROM portal_users 
WHERE email NOT IN ('paranhoscontato.n@gmail.com', 'visionariaev@gmail.com');

-- 5. Limpar usuários principais (exceto os especificados)
DELETE FROM users 
WHERE email NOT IN ('paranhoscontato.n@gmail.com', 'visionariaev@gmail.com');

-- 6. Limpar empresas que não têm usuários associados
DELETE FROM empresas 
WHERE id NOT IN (
    SELECT DISTINCT empresa_id 
    FROM users 
    WHERE empresa_id IS NOT NULL
    UNION
    SELECT DISTINCT empresa_id 
    FROM portal_users 
    WHERE empresa_id IS NOT NULL
    UNION
    SELECT DISTINCT empresa_id 
    FROM app_users 
    WHERE empresa_id IS NOT NULL
);

-- 7. Limpar logs e configurações
DELETE FROM audit_logs;
DELETE FROM audit_log;
DELETE FROM migration_log WHERE name NOT LIKE '%initial%' AND name NOT LIKE '%create%';
DELETE FROM jwt_claims_config;
DELETE FROM storage_config;

-- 8. Limpar tenants não utilizados
DELETE FROM tenants 
WHERE id NOT IN (
    SELECT DISTINCT tenant_id 
    FROM users 
    WHERE tenant_id IS NOT NULL
);

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

-- Resetar sequências se necessário
SELECT setval('migration_log_id_seq', 1, false);

-- Log da limpeza
INSERT INTO migration_log (name, description) 
VALUES ('clean_database_production', 'Limpeza completa do banco mantendo apenas usuários de produção');