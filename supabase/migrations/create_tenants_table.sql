-- Criar tabela de tenants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir tenant padrão
INSERT INTO tenants (id, name, slug, description) 
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Grifo Administração',
  'default',
  'Tenant padrão do sistema Grifo'
) ON CONFLICT (slug) DO NOTHING;

-- Conceder permissões
GRANT SELECT ON tenants TO anon;
GRANT ALL PRIVILEGES ON tenants TO authenticated;