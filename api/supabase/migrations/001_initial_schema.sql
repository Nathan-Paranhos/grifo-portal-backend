-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";

-- Enums
create type public.role_type as enum (
  'superadmin',
  'admin', 
  'corretor',
  'leitura'
);

create type public.vistoria_status as enum (
  'rascunho',
  'enviada',
  'finalizada'
);

-- Empresas table
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  ativa BOOLEAN DEFAULT true,
  storage_mb INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Usuarios table
CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  role public.role_type NOT NULL DEFAULT 'leitura',
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Imoveis table
CREATE TABLE public.imoveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  endereco JSONB NOT NULL,
  proprietario JSONB,
  inquilino JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vistorias table
CREATE TABLE public.vistorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  status public.vistoria_status DEFAULT 'rascunho',
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contestacoes table
CREATE TABLE public.contestacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  vistoria_id UUID NOT NULL REFERENCES public.vistorias(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  justificativa TEXT NOT NULL,
  status TEXT DEFAULT 'aberta',
  anexos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contestacoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for empresas
CREATE POLICY "superadmin_bypass" ON public.empresas
  USING (auth.jwt()->>'role' = 'superadmin');

CREATE POLICY "empresa_isolation" ON public.empresas
  USING (id::text = auth.jwt()->>'empresa_id');

CREATE POLICY "empresa_write" ON public.empresas
  FOR ALL
  USING (id::text = auth.jwt()->>'empresa_id')
  WITH CHECK (id::text = auth.jwt()->>'empresa_id');

-- RLS Policies for usuarios
CREATE POLICY "superadmin_bypass" ON public.usuarios
  USING (auth.jwt()->>'role' = 'superadmin');

CREATE POLICY "empresa_isolation" ON public.usuarios
  USING (empresa_id::text = auth.jwt()->>'empresa_id');

CREATE POLICY "empresa_write" ON public.usuarios
  FOR ALL
  USING (empresa_id::text = auth.jwt()->>'empresa_id')
  WITH CHECK (empresa_id::text = auth.jwt()->>'empresa_id');

-- RLS Policies for imoveis
CREATE POLICY "superadmin_bypass" ON public.imoveis
  USING (auth.jwt()->>'role' = 'superadmin');

CREATE POLICY "empresa_isolation" ON public.imoveis
  USING (empresa_id::text = auth.jwt()->>'empresa_id');

CREATE POLICY "empresa_write" ON public.imoveis
  FOR ALL
  USING (empresa_id::text = auth.jwt()->>'empresa_id')
  WITH CHECK (empresa_id::text = auth.jwt()->>'empresa_id');

-- RLS Policies for vistorias
CREATE POLICY "superadmin_bypass" ON public.vistorias
  USING (auth.jwt()->>'role' = 'superadmin');

CREATE POLICY "empresa_isolation" ON public.vistorias
  USING (empresa_id::text = auth.jwt()->>'empresa_id');

CREATE POLICY "empresa_write" ON public.vistorias
  FOR ALL
  USING (empresa_id::text = auth.jwt()->>'empresa_id')
  WITH CHECK (empresa_id::text = auth.jwt()->>'empresa_id');

-- RLS Policies for contestacoes
CREATE POLICY "superadmin_bypass" ON public.contestacoes
  USING (auth.jwt()->>'role' = 'superadmin');

CREATE POLICY "empresa_isolation" ON public.contestacoes
  USING (empresa_id::text = auth.jwt()->>'empresa_id');

CREATE POLICY "empresa_write" ON public.contestacoes
  FOR ALL
  USING (empresa_id::text = auth.jwt()->>'empresa_id')
  WITH CHECK (empresa_id::text = auth.jwt()->>'empresa_id');

-- Storage bucket for vistorias
INSERT INTO storage.buckets (id, name, public) VALUES ('vistorias', 'vistorias', false);

-- Storage Policy for bucket vistorias
CREATE POLICY bucket_vistorias_isolation
ON storage.objects
FOR ALL
USING (
  bucket_id = 'vistorias'
  AND (storage.foldername(name))[1] = auth.jwt()->>'empresa_id'
);

-- Create indexes for performance
CREATE INDEX idx_usuarios_empresa_id ON public.usuarios(empresa_id);
CREATE INDEX idx_imoveis_empresa_id ON public.imoveis(empresa_id);
CREATE INDEX idx_vistorias_empresa_id ON public.vistorias(empresa_id);
CREATE INDEX idx_vistorias_imovel_id ON public.vistorias(imovel_id);
CREATE INDEX idx_contestacoes_vistoria_id ON public.contestacoes(vistoria_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER handle_updated_at_usuarios
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_imoveis
  BEFORE UPDATE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_vistorias
  BEFORE UPDATE ON public.vistorias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_contestacoes
  BEFORE UPDATE ON public.contestacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed data should be added manually in production
-- Do not include hardcoded user data in migrations