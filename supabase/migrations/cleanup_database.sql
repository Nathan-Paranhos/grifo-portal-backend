-- Script de limpeza do banco de dados
-- Mantém apenas os usuários: paranhoscontato.n@gmail.com e visionariaev@gmail.com
-- Data: Janeiro 2025

-- Desabilitar RLS temporariamente para limpeza
ALTER TABLE empresas DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vistorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE ambientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE fotos DISABLE ROW LEVEL SECURITY;
ALTER TABLE descricoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE laudos DISABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE contestacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE contest_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE vistoria_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE itens_vistoria DISABLE ROW LEVEL SECURITY;
ALTER TABLE imoveis DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_google_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE google_drive_sync_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_onedrive_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE onedrive_sync_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_sync_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE visionaria_uploads DISABLE ROW LEVEL SECURITY;
ALTER TABLE migration_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE jwt_claims_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE grifo_app_uploads DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Identificar os usuários que devem ser mantidos
DO $$
DECLARE
    user_paranhos_id UUID;
    user_visionaria_id UUID;
    empresa_paranhos_id UUID;
    empresa_visionaria_id UUID;
BEGIN
    -- Buscar IDs dos usuários que devem ser mantidos
    SELECT id INTO user_paranhos_id FROM users WHERE email = 'paranhoscontato.n@gmail.com';
    SELECT id INTO user_visionaria_id FROM users WHERE email = 'visionariaev@gmail.com';
    
    -- Buscar IDs das empresas associadas
    SELECT empresa_id INTO empresa_paranhos_id FROM users WHERE email = 'paranhoscontato.n@gmail.com';
    SELECT empresa_id INTO empresa_visionaria_id FROM users WHERE email = 'visionariaev@gmail.com';
    
    -- Log dos IDs encontrados
    RAISE NOTICE 'User Paranhos ID: %', user_paranhos_id;
    RAISE NOTICE 'User Visionaria ID: %', user_visionaria_id;
    RAISE NOTICE 'Empresa Paranhos ID: %', empresa_paranhos_id;
    RAISE NOTICE 'Empresa Visionaria ID: %', empresa_visionaria_id;
    
    -- Limpeza das tabelas dependentes primeiro (ordem de dependência)
    
    -- 1. Limpar logs e notificações
    DELETE FROM sync_logs WHERE vistoria_id NOT IN (
        SELECT id FROM vistorias WHERE user_id IN (user_paranhos_id, user_visionaria_id)
    );
    
    DELETE FROM notificacoes WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    
    DELETE FROM audit_log WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    
    DELETE FROM audit_logs WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    
    -- 2. Limpar assinaturas e laudos
    DELETE FROM assinaturas WHERE laudo_id NOT IN (
        SELECT l.id FROM laudos l 
        JOIN vistorias v ON l.vistoria_id = v.id 
        WHERE v.user_id IN (user_paranhos_id, user_visionaria_id)
    );
    
    DELETE FROM laudos WHERE vistoria_id NOT IN (
        SELECT id FROM vistorias WHERE user_id IN (user_paranhos_id, user_visionaria_id)
    );
    
    -- 3. Limpar descrições e fotos
    DELETE FROM descricoes WHERE ambiente_id NOT IN (
        SELECT a.id FROM ambientes a 
        JOIN vistorias v ON a.vistoria_id = v.id 
        WHERE v.user_id IN (user_paranhos_id, user_visionaria_id)
    );
    
    DELETE FROM fotos WHERE ambiente_id NOT IN (
        SELECT a.id FROM ambientes a 
        JOIN vistorias v ON a.vistoria_id = v.id 
        WHERE v.user_id IN (user_paranhos_id, user_visionaria_id)
    );
    
    DELETE FROM itens_vistoria WHERE ambiente_id NOT IN (
        SELECT a.id FROM ambientes a 
        JOIN vistorias v ON a.vistoria_id = v.id 
        WHERE v.user_id IN (user_paranhos_id, user_visionaria_id)
    );
    
    -- 4. Limpar ambientes
    DELETE FROM ambientes WHERE vistoria_id NOT IN (
        SELECT id FROM vistorias WHERE user_id IN (user_paranhos_id, user_visionaria_id)
    );
    
    -- 5. Limpar contestações e links
    DELETE FROM contestacoes WHERE vistoria_id NOT IN (
        SELECT id FROM vistorias WHERE user_id IN (user_paranhos_id, user_visionaria_id)
    );
    
    DELETE FROM contest_links WHERE vistoria_id NOT IN (
        SELECT id FROM vistorias WHERE user_id IN (user_paranhos_id, user_visionaria_id)
    );
    
    -- 6. Limpar atribuições de vistoria
    DELETE FROM vistoria_assignments WHERE vistoria_id NOT IN (
        SELECT id FROM vistorias WHERE user_id IN (user_paranhos_id, user_visionaria_id)
    );
    
    -- 7. Limpar vistorias
    DELETE FROM vistorias WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    
    -- 8. Limpar imóveis
    DELETE FROM imoveis WHERE empresa_id NOT IN (empresa_paranhos_id, empresa_visionaria_id);
    
    -- 9. Limpar dados de clientes e portal
    DELETE FROM inspection_comments WHERE inspection_request_id NOT IN (
        SELECT id FROM inspection_requests WHERE client_id NOT IN (
            SELECT id FROM clients WHERE email IN ('paranhoscontato.n@gmail.com', 'visionariaev@gmail.com')
        )
    );
    
    DELETE FROM inspection_files WHERE inspection_request_id NOT IN (
        SELECT id FROM inspection_requests WHERE client_id NOT IN (
            SELECT id FROM clients WHERE email IN ('paranhoscontato.n@gmail.com', 'visionariaev@gmail.com')
        )
    );
    
    DELETE FROM inspection_requests WHERE client_id NOT IN (
        SELECT id FROM clients WHERE email IN ('paranhoscontato.n@gmail.com', 'visionariaev@gmail.com')
    );
    
    DELETE FROM client_sessions WHERE client_id NOT IN (
        SELECT id FROM clients WHERE email IN ('paranhoscontato.n@gmail.com', 'visionariaev@gmail.com')
    );
    
    DELETE FROM clients WHERE email NOT IN ('paranhoscontato.n@gmail.com', 'visionariaev@gmail.com');
    
    -- 10. Limpar configurações de usuários
    DELETE FROM user_google_tokens WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    DELETE FROM user_onedrive_tokens WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    DELETE FROM cloud_sync_settings WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    DELETE FROM google_drive_sync_log WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    DELETE FROM onedrive_sync_log WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    
    -- 11. Limpar uploads
    DELETE FROM visionaria_uploads WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    DELETE FROM grifo_app_uploads WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    
    -- 12. Limpar usuários do app e portal
    DELETE FROM app_users WHERE email NOT IN ('paranhoscontato.n@gmail.com', 'visionariaev@gmail.com');
    DELETE FROM portal_users WHERE email NOT IN ('paranhoscontato.n@gmail.com', 'visionariaev@gmail.com');
    
    -- 13. Limpar usuários principais
    DELETE FROM users WHERE email NOT IN ('paranhoscontato.n@gmail.com', 'visionariaev@gmail.com');
    
    -- 14. Limpar empresas não utilizadas
    DELETE FROM empresas WHERE id NOT IN (empresa_paranhos_id, empresa_visionaria_id);
    
    -- 15. Limpar configurações e logs gerais
    DELETE FROM storage_config WHERE empresa_id NOT IN (empresa_paranhos_id, empresa_visionaria_id);
    DELETE FROM migration_log;
    DELETE FROM notifications WHERE user_id NOT IN (user_paranhos_id, user_visionaria_id);
    
    -- 16. Limpar tenants não utilizados
    DELETE FROM tenants WHERE id NOT IN (empresa_paranhos_id, empresa_visionaria_id);
    
    RAISE NOTICE 'Limpeza do banco de dados concluída!';
    RAISE NOTICE 'Usuários mantidos: paranhoscontato.n@gmail.com, visionariaev@gmail.com';
END $$;

-- Reabilitar RLS
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE descricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE laudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistoria_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_vistoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_drive_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_onedrive_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE onedrive_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE visionaria_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE jwt_claims_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE grifo_app_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Verificar dados restantes
SELECT 'users' as tabela, count(*) as registros FROM users
UNION ALL
SELECT 'empresas' as tabela, count(*) as registros FROM empresas
UNION ALL
SELECT 'vistorias' as tabela, count(*) as registros FROM vistorias
UNION ALL
SELECT 'clients' as tabela, count(*) as registros FROM clients
UNION ALL
SELECT 'portal_users' as tabela, count(*) as registros FROM portal_users
UNION ALL
SELECT 'app_users' as tabela, count(*) as registros FROM app_users;

-- Log final
SELECT 'Limpeza concluída em: ' || NOW() as status;