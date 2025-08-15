-- Grifo Vistorias - Esquema SQL Principal
-- Baseado na arquitetura multi-tenant especificada no prompt.md

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de empresas (tenants)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,          -- ex.: "grifo-app"
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  address JSONB,
  logo_url TEXT,
  plan TEXT DEFAULT 'standard',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuários da plataforma (vinculados ao supabase uid)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uid TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vínculo usuário x empresa (papéis)
CREATE TYPE user_role AS ENUM ('admin','manager','attendant','inspector','viewer');

CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'attendant',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, user_id)
);

-- Imóveis
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                     -- nome curto
  description TEXT,
  address JSONB NOT NULL,                  -- { street, number, city, state, zip, complement }
  owner JSONB,                             -- { name, phone, doc }
  type TEXT,                               -- casa, apto, comercial...
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vistorias
CREATE TYPE inspection_status AS ENUM ('pending','scheduled','in_progress','completed','canceled');

CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id),          -- quem solicitou (atendente)
  inspector_id UUID REFERENCES users(id),          -- quem executa
  status inspection_status NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  checklist JSONB,                                 -- estrutura dinâmica
  report_url TEXT,                                  -- PDF quando gerado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contestações
CREATE TABLE IF NOT EXISTS contestations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspection_id UUID REFERENCES inspections(id),
  property_id UUID REFERENCES properties(id),
  reason TEXT,
  description TEXT,
  status TEXT DEFAULT 'open',                       -- open, in_review, resolved, rejected
  evidence JSONB,                                   -- { photos: [urls], docs: [urls] }
  response JSONB,
  responded_by UUID REFERENCES users(id),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uploads (metadados de arquivos do Storage)
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  category TEXT,                                    -- 'photo','doc','report'
  filename TEXT NOT NULL,
  path TEXT NOT NULL,                               -- path no bucket
  mime_type TEXT,
  size_bytes BIGINT,
  url TEXT,                                         -- URL pública/assinada
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications (inbox)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,                      -- { inspection_id, property_id, company_name, tenant }
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, key)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_company_id ON properties(company_id);
CREATE INDEX IF NOT EXISTS idx_inspections_company_id ON inspections(company_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector_id ON inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_contestations_company_id ON contestations(company_id);
CREATE INDEX IF NOT EXISTS idx_uploads_company_id ON uploads(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_company_id ON settings(company_id);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON inspections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contestations_updated_at BEFORE UPDATE ON contestations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE companies IS 'Empresas/tenants do sistema multi-tenant';
COMMENT ON TABLE users IS 'Usuários da plataforma vinculados ao Supabase Auth';
COMMENT ON TABLE company_members IS 'Vínculo entre usuários e empresas com papéis específicos';
COMMENT ON TABLE properties IS 'Imóveis cadastrados por empresa';
COMMENT ON TABLE inspections IS 'Vistorias solicitadas e executadas';
COMMENT ON TABLE contestations IS 'Contestações de vistorias';
COMMENT ON TABLE uploads IS 'Metadados de arquivos no Supabase Storage';
COMMENT ON TABLE notifications IS 'Notificações para usuários';
COMMENT ON TABLE settings IS 'Configurações por empresa';