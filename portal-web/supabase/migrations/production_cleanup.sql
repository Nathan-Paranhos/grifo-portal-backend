-- =====================================================
-- SCRIPT DE LIMPEZA PARA PRODUÇÃO - SISTEMA GRIFO
-- =====================================================
-- Este script remove todos os dados de teste e desenvolvimento
-- mantendo apenas a estrutura das tabelas para produção

-- Desabilitar verificações de chave estrangeira temporariamente
SET session_replication_role = replica;

-- =====================================================
-- LIMPEZA DE DADOS DE TESTE E DESENVOLVIMENTO
-- =====================================================

-- Limpar dados de vistorias e relacionados
DELETE FROM fotos WHERE vistoria_id IN (SELECT id FROM vistorias);
DELETE FROM itens_vistoria WHERE vistoria_id IN (SELECT id FROM vistorias);
DELETE FROM contestacoes WHERE vistoria_id IN (SELECT id FROM vistorias);
DELETE FROM vistoria_assignments WHERE vistoria_id IN (SELECT id FROM vistorias);
DELETE FROM inspection_files WHERE inspection_request_id IN (SELECT id FROM inspection_requests);
DELETE FROM inspection_comments WHERE inspection_request_id IN (SELECT id FROM inspection_requests);
DELETE FROM vistorias;
DELETE FROM inspection_requests;

-- Limpar dados de imóveis
DELETE FROM imoveis;

-- Limpar dados de usuários de teste (manter apenas estrutura)
DELETE FROM app_users;
DELETE FROM portal_users;
DELETE FROM users WHERE email LIKE '%test%' OR email LIKE '%exemplo%' OR email LIKE '%grifo.com';
DELETE FROM clients WHERE email LIKE '%test%' OR email LIKE '%exemplo%' OR email LIKE '%grifo.com';

-- Limpar empresas de teste
DELETE FROM empresas WHERE nome LIKE '%Test%' OR nome LIKE '%Teste%' OR nome LIKE '%MVP%';
DELETE FROM tenants WHERE name LIKE '%test%' OR name LIKE '%teste%' OR name LIKE '%mvp%';

-- Limpar logs e dados de auditoria
DELETE FROM audit_log;
DELETE FROM migration_log;
DELETE FROM google_drive_sync_log;
DELETE FROM onedrive_sync_log;

-- Limpar tokens e sessões
DELETE FROM user_google_tokens;
DELETE FROM user_onedrive_tokens;
DELETE FROM client_sessions;

-- Limpar uploads e arquivos temporários
DELETE FROM visionaria_uploads;
DELETE FROM grifo_app_uploads;

-- Limpar notificações de teste
DELETE FROM notifications;

-- Limpar links de contestação
DELETE FROM contest_links;

-- =====================================================
-- RESET DE SEQUÊNCIAS (IDs)
-- =====================================================

-- Reset das sequências para começar do 1
ALTER SEQUENCE IF EXISTS empresas_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS imoveis_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS vistorias_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS fotos_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS itens_vistoria_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS contestacoes_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS vistoria_assignments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS app_users_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS portal_users_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS clients_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS inspection_requests_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS tenants_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS notifications_id_seq RESTART WITH 1;

-- =====================================================
-- CONFIGURAÇÕES DE PRODUÇÃO
-- =====================================================

-- Limpar todas as configurações (serão reconfiguradas para produção)
DELETE FROM storage_config;
DELETE FROM cloud_sync_settings;
DELETE FROM jwt_claims_config;

-- Reabilitar verificações de chave estrangeira
SET session_replication_role = DEFAULT;

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- Mostrar contagem de registros restantes nas tabelas principais
SELECT 'empresas' as tabela, COUNT(*) as registros FROM empresas
UNION ALL
SELECT 'users' as tabela, COUNT(*) as registros FROM users
UNION ALL
SELECT 'tenants' as tabela, COUNT(*) as registros FROM tenants
UNION ALL
SELECT 'clients' as tabela, COUNT(*) as registros FROM clients
UNION ALL
SELECT 'vistorias' as tabela, COUNT(*) as registros FROM vistorias
UNION ALL
SELECT 'imoveis' as tabela, COUNT(*) as registros FROM imoveis
UNION ALL
SELECT 'inspection_requests' as tabela, COUNT(*) as registros FROM inspection_requests
ORDER BY tabela;

-- Mensagem de conclusão
SELECT 'LIMPEZA DE PRODUÇÃO CONCLUÍDA - SISTEMA PRONTO PARA USO' as status;