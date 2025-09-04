-- Remover tabela notifications existente se houver conflito
DROP TABLE IF EXISTS notifications CASCADE;

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    document VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Tabela de solicitações de vistoria
CREATE TABLE IF NOT EXISTS inspection_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    property_address TEXT NOT NULL,
    property_type VARCHAR(50) NOT NULL, -- 'residential', 'commercial', 'industrial'
    inspection_type VARCHAR(50) NOT NULL, -- 'purchase', 'sale', 'insurance', 'maintenance'
    requested_date DATE,
    preferred_time VARCHAR(20),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'assigned', 'in_progress', 'completed', 'cancelled'
    assigned_to UUID REFERENCES auth.users(id),
    priority VARCHAR(10) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    estimated_duration INTEGER, -- em minutos
    special_requirements TEXT,
    contact_person VARCHAR(255),
    contact_phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scheduled_date TIMESTAMP WITH TIME ZONE,
    completed_date TIMESTAMP WITH TIME ZONE
);

-- Tabela de arquivos da vistoria
CREATE TABLE IF NOT EXISTS inspection_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_request_id UUID NOT NULL REFERENCES inspection_requests(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'photo', 'document', 'report', 'video'
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES auth.users(id),
    is_client_visible BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de comentários/histórico
CREATE TABLE IF NOT EXISTS inspection_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_request_id UUID NOT NULL REFERENCES inspection_requests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    client_id UUID REFERENCES clients(id),
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- true = apenas para equipe interna
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de sessões de clientes (para autenticação)
CREATE TABLE IF NOT EXISTS client_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de notificações (nova estrutura)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_type VARCHAR(10) NOT NULL, -- 'client', 'user'
    recipient_id UUID NOT NULL, -- client_id ou user_id
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'new_request', 'status_update', 'file_uploaded', 'reminder'
    is_read BOOLEAN DEFAULT false,
    related_inspection_id UUID REFERENCES inspection_requests(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_inspection_requests_client ON inspection_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_inspection_requests_status ON inspection_requests(status);
CREATE INDEX IF NOT EXISTS idx_inspection_requests_assigned ON inspection_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_inspection_files_request ON inspection_files(inspection_request_id);
CREATE INDEX IF NOT EXISTS idx_inspection_comments_request ON inspection_comments(inspection_request_id);
CREATE INDEX IF NOT EXISTS idx_client_sessions_token ON client_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_client_sessions_client ON client_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_sessions_expires ON client_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inspection_requests_updated_at BEFORE UPDATE ON inspection_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para clients
CREATE POLICY "Clients can view own data" ON clients
    FOR SELECT USING (id = (SELECT client_id FROM client_sessions WHERE session_token = current_setting('request.jwt.claims', true)::json->>'session_token'));

CREATE POLICY "Admins can view all clients" ON clients
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas RLS para inspection_requests
CREATE POLICY "Clients can view own requests" ON inspection_requests
    FOR SELECT USING (client_id = (SELECT client_id FROM client_sessions WHERE session_token = current_setting('request.jwt.claims', true)::json->>'session_token'));

CREATE POLICY "Clients can create own requests" ON inspection_requests
    FOR INSERT WITH CHECK (client_id = (SELECT client_id FROM client_sessions WHERE session_token = current_setting('request.jwt.claims', true)::json->>'session_token'));

CREATE POLICY "Admins can manage all requests" ON inspection_requests
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas RLS para inspection_files
CREATE POLICY "Clients can view own files" ON inspection_files
    FOR SELECT USING (
        is_client_visible = true AND 
        inspection_request_id IN (
            SELECT id FROM inspection_requests 
            WHERE client_id = (SELECT client_id FROM client_sessions WHERE session_token = current_setting('request.jwt.claims', true)::json->>'session_token')
        )
    );

CREATE POLICY "Admins can manage all files" ON inspection_files
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas RLS para inspection_comments
CREATE POLICY "Clients can view non-internal comments" ON inspection_comments
    FOR SELECT USING (
        is_internal = false AND 
        inspection_request_id IN (
            SELECT id FROM inspection_requests 
            WHERE client_id = (SELECT client_id FROM client_sessions WHERE session_token = current_setting('request.jwt.claims', true)::json->>'session_token')
        )
    );

CREATE POLICY "Admins can manage all comments" ON inspection_comments
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas RLS para notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (
        (recipient_type = 'client' AND recipient_id = (SELECT client_id FROM client_sessions WHERE session_token = current_setting('request.jwt.claims', true)::json->>'session_token')) OR
        (recipient_type = 'user' AND recipient_id = auth.uid())
    );

CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Políticas RLS para client_sessions
CREATE POLICY "Clients can view own sessions" ON client_sessions
    FOR SELECT USING (client_id = (SELECT client_id FROM client_sessions WHERE session_token = current_setting('request.jwt.claims', true)::json->>'session_token'));

CREATE POLICY "System can manage sessions" ON client_sessions
    FOR ALL USING (auth.role() = 'authenticated');

-- Função para limpar sessões expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM client_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Permissões para as tabelas
GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_sessions TO authenticated;

GRANT SELECT ON clients TO anon;
GRANT SELECT ON inspection_requests TO anon;
GRANT SELECT ON inspection_files TO anon;
GRANT SELECT ON inspection_comments TO anon;
GRANT SELECT ON notifications TO anon;
GRANT SELECT ON client_sessions TO anon;