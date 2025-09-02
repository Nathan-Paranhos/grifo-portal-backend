-- =====================================================
-- TABELA DE LINKS DE CONTESTAÇÃO
-- =====================================================
-- Criação da tabela para armazenar tokens únicos de contestação
-- que permitem contestar laudos via link/QR code sem necessidade de login

-- Criar tabela de links de contestação
CREATE TABLE IF NOT EXISTS contest_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id UUID REFERENCES vistorias(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresas(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  contestant_name TEXT,
  contestant_email TEXT,
  contestant_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contest_links_token ON contest_links(token);
CREATE INDEX IF NOT EXISTS idx_contest_links_vistoria ON contest_links(vistoria_id);
CREATE INDEX IF NOT EXISTS idx_contest_links_empresa ON contest_links(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contest_links_expires ON contest_links(expires_at);

-- Habilitar RLS
ALTER TABLE contest_links ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso público via token (sem autenticação)
CREATE POLICY "Public access via token" ON contest_links
  FOR SELECT USING (true);

-- Política para usuários do portal visualizarem links da empresa
CREATE POLICY "Portal users can view company contest links" ON contest_links
  FOR SELECT USING (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal()
  );

-- Política para inserção por usuários do portal
CREATE POLICY "Portal users can create contest links" ON contest_links
  FOR INSERT WITH CHECK (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal()
  );

-- Política para atualização por usuários do portal
CREATE POLICY "Portal users can update company contest links" ON contest_links
  FOR UPDATE USING (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal()
  );

-- Função para gerar token único
CREATE OR REPLACE FUNCTION generate_contest_token()
RETURNS TEXT AS $$
DECLARE
  new_token TEXT;
  exists_token BOOLEAN;
BEGIN
  LOOP
    -- Gerar token de 32 caracteres
    new_token := encode(gen_random_bytes(24), 'base64');
    -- Remover caracteres especiais e deixar apenas alfanuméricos
    new_token := regexp_replace(new_token, '[^a-zA-Z0-9]', '', 'g');
    -- Garantir que tem pelo menos 32 caracteres
    IF length(new_token) < 32 THEN
      new_token := new_token || encode(gen_random_bytes(8), 'hex');
    END IF;
    -- Truncar para 32 caracteres
    new_token := substring(new_token from 1 for 32);
    
    -- Verificar se o token já existe
    SELECT EXISTS(SELECT 1 FROM contest_links WHERE contest_links.token = new_token) INTO exists_token;
    
    -- Se não existe, sair do loop
    IF NOT exists_token THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Função para criar link de contestação
CREATE OR REPLACE FUNCTION create_contest_link(
  p_vistoria_id UUID,
  p_empresa_id UUID,
  p_expires_days INTEGER DEFAULT 30
)
RETURNS TEXT AS $$
DECLARE
  new_token TEXT;
  expires_date TIMESTAMPTZ;
BEGIN
  -- Gerar token único
  new_token := generate_contest_token();
  
  -- Calcular data de expiração
  expires_date := now() + (p_expires_days || ' days')::INTERVAL;
  
  -- Inserir o link de contestação
  INSERT INTO contest_links (vistoria_id, empresa_id, token, expires_at)
  VALUES (p_vistoria_id, p_empresa_id, new_token, expires_date);
  
  RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para validar token de contestação
CREATE OR REPLACE FUNCTION validate_contest_token(p_token TEXT)
RETURNS TABLE(
  is_valid BOOLEAN,
  contest_link_id UUID,
  vistoria_id UUID,
  empresa_id UUID,
  is_expired BOOLEAN,
  is_used BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN cl.id IS NOT NULL AND cl.expires_at > now() AND NOT cl.is_used THEN true
      ELSE false
    END as is_valid,
    cl.id as contest_link_id,
    cl.vistoria_id,
    cl.empresa_id,
    CASE WHEN cl.expires_at <= now() THEN true ELSE false END as is_expired,
    cl.is_used
  FROM contest_links cl
  WHERE cl.token = p_token;
  
  -- Se não encontrou nenhum registro, retornar valores padrão
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, false, false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários na tabela
COMMENT ON TABLE contest_links IS 'Tabela para armazenar links únicos de contestação que permitem contestar laudos via QR code ou link direto';
COMMENT ON COLUMN contest_links.token IS 'Token único de 32 caracteres para acesso público à contestação';
COMMENT ON COLUMN contest_links.expires_at IS 'Data de expiração do link (padrão: 30 dias)';
COMMENT ON COLUMN contest_links.is_used IS 'Indica se o link já foi utilizado para criar uma contestação';
COMMENT ON COLUMN contest_links.used_at IS 'Data e hora em que o link foi utilizado';