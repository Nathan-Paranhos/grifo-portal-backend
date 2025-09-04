-- =============================================================================
-- LIMPEZA DE LOGS E AUDITORIA DE DESENVOLVIMENTO
-- =============================================================================
-- Este script limpa todas as tabelas de logs e auditoria que podem conter
-- dados de desenvolvimento e teste

-- Limpar logs de sincronização do Google Drive
DELETE FROM google_drive_sync_log;

-- Limpar logs de sincronização do OneDrive
DELETE FROM onedrive_sync_log;

-- Limpar logs de migração
DELETE FROM migration_log;

-- Limpar logs de auditoria
DELETE FROM audit_log;

-- Limpar notificações antigas
DELETE FROM notifications;

-- Limpar sessões de clientes
DELETE FROM client_sessions;

-- Limpar tokens do Google (desenvolvimento)
DELETE FROM user_google_tokens;

-- Limpar tokens do OneDrive (desenvolvimento)
DELETE FROM user_onedrive_tokens;

-- Limpar uploads do Visionaria (desenvolvimento)
DELETE FROM visionaria_uploads;

-- Limpar uploads do Grifo App (desenvolvimento)
DELETE FROM grifo_app_uploads;

-- Resetar sequências das tabelas de log
SELECT setval(pg_get_serial_sequence('google_drive_sync_log', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('onedrive_sync_log', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('migration_log', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('audit_log', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('notifications', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('client_sessions', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('user_google_tokens', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('user_onedrive_tokens', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('visionaria_uploads', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('grifo_app_uploads', 'id'), 1, false);

-- Mensagem de confirmação
DO $$
BEGIN
    RAISE NOTICE 'Limpeza de logs e auditoria concluída com sucesso!';
    RAISE NOTICE 'Tabelas limpas:';
    RAISE NOTICE '- google_drive_sync_log';
    RAISE NOTICE '- onedrive_sync_log';
    RAISE NOTICE '- migration_log';
    RAISE NOTICE '- audit_log';
    RAISE NOTICE '- notifications';
    RAISE NOTICE '- client_sessions';
    RAISE NOTICE '- user_google_tokens';
    RAISE NOTICE '- user_onedrive_tokens';
    RAISE NOTICE '- visionaria_uploads';
    RAISE NOTICE '- grifo_app_uploads';
    RAISE NOTICE 'Sequências resetadas para iniciar do ID 1';
END $$;