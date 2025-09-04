-- Criar tabela de logs de auditoria para monitoramento de segurança
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    type VARCHAR(50) NOT NULL, -- ADMIN_ACCESS, RESOURCE_ACCESS, DATA_CHANGE
    action VARCHAR(100) NOT NULL, -- LOGIN_SUCCESS, LOGIN_FAILED, etc.
    user_email VARCHAR(255),
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    resource VARCHAR(100), -- nome do recurso acessado
    details JSONB, -- dados completos do log
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON audit_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON audit_logs(type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Habilitar RLS (Row Level Security)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir que apenas super admins vejam os logs
CREATE POLICY "Super admins can view audit logs" ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_user_id = auth.uid() 
            AND users.user_type = 'super_admin'
            AND users.is_active = true
            AND users.status = 'active'
        )
    );

-- Política para permitir inserção de logs (sistema)
CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE audit_logs IS 'Tabela de logs de auditoria para monitoramento de segurança e compliance';
COMMENT ON COLUMN audit_logs.type IS 'Tipo do log: ADMIN_ACCESS, RESOURCE_ACCESS, DATA_CHANGE';
COMMENT ON COLUMN audit_logs.action IS 'Ação específica: LOGIN_SUCCESS, LOGIN_FAILED, CREATE_USER, etc.';
COMMENT ON COLUMN audit_logs.details IS 'Dados completos do evento em formato JSON';
COMMENT ON COLUMN audit_logs.ip_address IS 'Endereço IP de origem da requisição';
COMMENT ON COLUMN audit_logs.user_agent IS 'User Agent do navegador/cliente';

-- Função para limpeza automática de logs antigos (executar mensalmente)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'Logs de auditoria antigos removidos';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário na função
COMMENT ON FUNCTION cleanup_old_audit_logs() IS 'Remove logs de auditoria com mais de 90 dias';

-- Conceder permissões necessárias
GRANT SELECT ON audit_logs TO authenticated;
GRANT INSERT ON audit_logs TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs() TO authenticated;