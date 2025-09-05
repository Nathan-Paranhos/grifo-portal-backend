-- =====================================================
-- GRIFO VISTORIAS - SCHEMA COMPLETO DO BANCO DE DADOS
-- =====================================================
-- Versão: 1.0
-- Data: 2025-01-16
-- Descrição: Schema completo multi-tenant com RLS

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. TABELAS PRINCIPAIS
-- =====================================================

-- 1.1 Tabela de Empresas (Multi-tenant)
CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  logo_url TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.2 Usuários do App Mobile (Vistoriadores)
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  empresa_id UUID REFERENCES empresas(id),
  role TEXT DEFAULT 'vistoriador',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.3 Usuários do Portal Web (Gestores)
CREATE TABLE IF NOT EXISTS portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  empresa_id UUID REFERENCES empresas(id),
  role TEXT DEFAULT 'gestor' CHECK (role IN ('gestor', 'admin', 'supervisor')),
  can_create_vistorias BOOLEAN DEFAULT true,
  can_edit_vistorias BOOLEAN DEFAULT true,
  can_view_all_company_data BOOLEAN DEFAULT true,
  can_manage_users BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.4 Tabela de Imóveis
CREATE TABLE IF NOT EXISTS imoveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id),
  endereco TEXT NOT NULL,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  proprietario_nome TEXT,
  proprietario_contato TEXT,
  tipo_imovel TEXT,
  area_total DECIMAL,
  quartos INTEGER,
  banheiros INTEGER,
  vagas_garagem INTEGER,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.5 Tabela de Vistorias
CREATE TABLE IF NOT EXISTS vistorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id),
  imovel_id UUID REFERENCES imoveis(id),
  app_vistoriador_id UUID REFERENCES app_users(id),
  portal_solicitante_id UUID REFERENCES portal_users(id),
  tipo_vistoria TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'agendada', 'em_andamento', 'concluida', 'cancelada')),
  data_agendamento TIMESTAMPTZ,
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  observacoes TEXT,
  relatorio_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.6 Tabela de Fotos
CREATE TABLE IF NOT EXISTS fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id UUID REFERENCES vistorias(id) ON DELETE CASCADE,
  item_vistoria_id UUID,
  url_foto TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.7 Tabela de Itens de Vistoria
CREATE TABLE IF NOT EXISTS itens_vistoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id UUID REFERENCES vistorias(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  item TEXT NOT NULL,
  status TEXT,
  observacoes TEXT,
  fotos_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.8 Tabela de Contestações
CREATE TABLE IF NOT EXISTS contestacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id),
  vistoria_id UUID REFERENCES vistorias(id),
  usuario_id UUID,
  motivo TEXT NOT NULL,
  descricao TEXT,
  status TEXT DEFAULT 'aberta',
  evidencias JSONB,
  resposta TEXT,
  respondido_por UUID,
  respondido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.9 Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id),
  usuario_id UUID,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  dados JSONB,
  lida BOOLEAN DEFAULT false,
  lida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.10 Tabela de Atribuições de Vistoria
CREATE TABLE IF NOT EXISTS vistoria_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id UUID REFERENCES vistorias(id),
  app_vistoriador_id UUID REFERENCES app_users(id),
  atribuido_por UUID REFERENCES portal_users(id),
  data_atribuicao TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'ativa'
);

-- =====================================================
-- 2. TABELAS DE INTEGRAÇÃO E SINCRONIZAÇÃO
-- =====================================================

-- 2.1 Tokens Google Drive
CREATE TABLE IF NOT EXISTS user_google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.2 Log de Sincronização Google Drive
CREATE TABLE IF NOT EXISTS google_drive_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  file_id TEXT,
  sync_status TEXT,
  error_message TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- 2.3 Tokens OneDrive
CREATE TABLE IF NOT EXISTS user_onedrive_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.4 Log de Sincronização OneDrive
CREATE TABLE IF NOT EXISTS onedrive_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  file_id TEXT,
  sync_status TEXT,
  error_message TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- 2.5 Configurações de Sincronização
CREATE TABLE IF NOT EXISTS cloud_sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id),
  provider TEXT,
  enabled BOOLEAN DEFAULT false,
  auto_sync BOOLEAN DEFAULT false,
  sync_frequency TEXT,
  folder_structure JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 3. TABELAS DE STORAGE E UPLOADS
-- =====================================================

-- 3.1 Configurações de Storage
CREATE TABLE IF NOT EXISTS storage_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id),
  provider TEXT DEFAULT 'supabase',
  config JSONB,
  max_file_size BIGINT DEFAULT 10485760,
  allowed_types TEXT[] DEFAULT ARRAY['image/jpeg', 'image/png', 'application/pdf'],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3.2 Uploads do App Grifo
CREATE TABLE IF NOT EXISTS grifo_app_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id),
  user_id UUID,
  vistoria_id UUID REFERENCES vistorias(id),
  filename TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  storage_path TEXT,
  bucket_name TEXT DEFAULT 'grifo-app',
  public_url TEXT,
  upload_status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 4. TABELAS DE AUDITORIA E LOGS
-- =====================================================

-- 4.1 Log de Auditoria
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id),
  user_id UUID,
  user_type TEXT,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.2 Log de Migrações
CREATE TABLE IF NOT EXISTS migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- =====================================================
-- 5. ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices multi-tenant
CREATE INDEX IF NOT EXISTS idx_app_users_empresa_id ON app_users(empresa_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_empresa_id ON portal_users(empresa_id);
CREATE INDEX IF NOT EXISTS idx_imoveis_empresa_id ON imoveis(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_empresa_id ON vistorias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contestacoes_empresa_id ON contestacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_notifications_empresa_id ON notifications(empresa_id);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_vistorias_status ON vistorias(status);
CREATE INDEX IF NOT EXISTS idx_vistorias_vistoriador ON vistorias(app_vistoriador_id);
CREATE INDEX IF NOT EXISTS idx_fotos_vistoria ON fotos(vistoria_id);
CREATE INDEX IF NOT EXISTS idx_notifications_usuario ON notifications(usuario_id, lida);
CREATE INDEX IF NOT EXISTS idx_audit_log_empresa ON audit_log(empresa_id, created_at);

-- Índices compostos
CREATE INDEX IF NOT EXISTS idx_vistorias_empresa_status ON vistorias(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_fotos_vistoria_ordem ON fotos(vistoria_id, ordem);

-- =====================================================
-- 6. FUNÇÕES AUXILIARES PARA RLS
-- =====================================================

-- Função para obter empresa_id do usuário app
CREATE OR REPLACE FUNCTION get_user_empresa_id_app()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT empresa_id 
    FROM app_users 
    WHERE auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter empresa_id do usuário portal
CREATE OR REPLACE FUNCTION get_user_empresa_id_portal()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT empresa_id 
    FROM portal_users 
    WHERE auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se é usuário do app
CREATE OR REPLACE FUNCTION is_app_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM app_users 
    WHERE auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se é usuário do portal
CREATE OR REPLACE FUNCTION is_portal_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM portal_users 
    WHERE auth_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. POLÍTICAS RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS em todas as tabelas principais
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_vistoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistoria_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grifo_app_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas para app_users
CREATE POLICY "App users can view own data" ON app_users
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "App users can update own data" ON app_users
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Políticas para portal_users
CREATE POLICY "Portal users can view own data" ON portal_users
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Portal users can update own data" ON portal_users
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Políticas para empresas
CREATE POLICY "Users can view own company" ON empresas
  FOR SELECT USING (
    id = get_user_empresa_id_app() OR 
    id = get_user_empresa_id_portal()
  );

-- Políticas para imóveis
CREATE POLICY "Portal users can manage company properties" ON imoveis
  FOR ALL USING (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal()
  );

CREATE POLICY "App users can view company properties" ON imoveis
  FOR SELECT USING (
    is_app_user() AND 
    empresa_id = get_user_empresa_id_app()
  );

-- Políticas para vistorias
CREATE POLICY "Portal users can manage company inspections" ON vistorias
  FOR ALL USING (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal()
  );

CREATE POLICY "App users can manage assigned inspections" ON vistorias
  FOR ALL USING (
    is_app_user() AND 
    empresa_id = get_user_empresa_id_app() AND
    app_vistoriador_id = (
      SELECT id FROM app_users WHERE auth_user_id = auth.uid()
    )
  );

-- Políticas para fotos
CREATE POLICY "Users can manage inspection photos" ON fotos
  FOR ALL USING (
    vistoria_id IN (
      SELECT id FROM vistorias 
      WHERE (
        (is_portal_user() AND empresa_id = get_user_empresa_id_portal()) OR
        (is_app_user() AND empresa_id = get_user_empresa_id_app() AND 
         app_vistoriador_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid()))
      )
    )
  );

-- Políticas para itens_vistoria
CREATE POLICY "Users can manage inspection items" ON itens_vistoria
  FOR ALL USING (
    vistoria_id IN (
      SELECT id FROM vistorias 
      WHERE (
        (is_portal_user() AND empresa_id = get_user_empresa_id_portal()) OR
        (is_app_user() AND empresa_id = get_user_empresa_id_app() AND 
         app_vistoriador_id = (SELECT id FROM app_users WHERE auth_user_id = auth.uid()))
      )
    )
  );

-- Políticas para contestações
CREATE POLICY "Users can manage company contestations" ON contestacoes
  FOR ALL USING (
    (is_portal_user() AND empresa_id = get_user_empresa_id_portal()) OR
    (is_app_user() AND empresa_id = get_user_empresa_id_app())
  );

-- Políticas para notificações
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (
    usuario_id = auth.uid() OR
    (is_portal_user() AND empresa_id = get_user_empresa_id_portal()) OR
    (is_app_user() AND empresa_id = get_user_empresa_id_app())
  );

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (usuario_id = auth.uid());

-- Políticas para uploads
CREATE POLICY "Users can manage company uploads" ON grifo_app_uploads
  FOR ALL USING (
    (is_portal_user() AND empresa_id = get_user_empresa_id_portal()) OR
    (is_app_user() AND empresa_id = get_user_empresa_id_app())
  );

-- =====================================================
-- 8. TRIGGERS E FUNÇÕES AUTOMÁTICAS
-- =====================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_empresas_updated_at
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portal_users_updated_at
  BEFORE UPDATE ON portal_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_imoveis_updated_at
  BEFORE UPDATE ON imoveis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vistorias_updated_at
  BEFORE UPDATE ON vistorias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. INSERÇÃO DE DADOS INICIAIS
-- =====================================================

-- Registrar migração
INSERT INTO migration_log (name, description) 
VALUES ('00_complete_schema', 'Schema completo inicial do Grifo Vistorias');

-- Empresa padrão para desenvolvimento
INSERT INTO empresas (id, nome, cnpj, email, ativo) 
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Visionária Imóveis',
  '12.345.678/0001-90',
  'contato@visionaria.com.br',
  true
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 10. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE empresas IS 'Tabela central multi-tenant para empresas clientes';
COMMENT ON TABLE app_users IS 'Usuários do aplicativo mobile (vistoriadores)';
COMMENT ON TABLE portal_users IS 'Usuários do portal web (gestores)';
COMMENT ON TABLE vistorias IS 'Núcleo do sistema - registros de vistorias';
COMMENT ON TABLE fotos IS 'Metadados das fotos capturadas nas vistorias';
COMMENT ON TABLE audit_log IS 'Log de auditoria para rastreamento de ações';

COMMENT ON FUNCTION get_user_empresa_id_app() IS 'Retorna empresa_id do usuário app autenticado';
COMMENT ON FUNCTION get_user_empresa_id_portal() IS 'Retorna empresa_id do usuário portal autenticado';
COMMENT ON FUNCTION is_app_user() IS 'Verifica se o usuário autenticado é do app mobile';
COMMENT ON FUNCTION is_portal_user() IS 'Verifica se o usuário autenticado é do portal web';

-- =====================================================
-- FIM DO SCHEMA COMPLETO
-- =====================================================