-- Tabela para controle de versões de arquivos
CREATE TABLE IF NOT EXISTS file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL, -- Referência ao arquivo original na tabela uploads
  version_number INTEGER NOT NULL DEFAULT 1,
  file_hash VARCHAR(32) NOT NULL, -- MD5 hash para detectar duplicatas
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  upload_type VARCHAR(50) NOT NULL,
  related_id UUID, -- ID relacionado (vistoria, propriedade, etc.)
  description TEXT,
  change_reason TEXT DEFAULT 'Nova versão',
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Constraints
  CONSTRAINT fk_file_versions_company FOREIGN KEY (company_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_file_versions_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT unique_version_per_file UNIQUE (related_id, upload_type, original_name, version_number, is_active)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_related_id ON file_versions(related_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_upload_type ON file_versions(upload_type);
CREATE INDEX IF NOT EXISTS idx_file_versions_company_id ON file_versions(company_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_hash ON file_versions(file_hash);
CREATE INDEX IF NOT EXISTS idx_file_versions_active ON file_versions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_file_versions_created_at ON file_versions(created_at DESC);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_file_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_file_versions_updated_at
  BEFORE UPDATE ON file_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_file_versions_updated_at();

-- Função para limpar versões antigas automaticamente
CREATE OR REPLACE FUNCTION cleanup_old_file_versions()
RETURNS void AS $$
BEGIN
  -- Marcar como inativas versões antigas (manter apenas as 10 mais recentes por arquivo)
  WITH ranked_versions AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY related_id, upload_type, original_name 
        ORDER BY version_number DESC
      ) as rn
    FROM file_versions 
    WHERE is_active = TRUE
  )
  UPDATE file_versions 
  SET 
    is_active = FALSE,
    deleted_at = NOW()
  WHERE id IN (
    SELECT id FROM ranked_versions WHERE rn > 10
  );
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON TABLE file_versions IS 'Controle de versões de arquivos uploadados';
COMMENT ON COLUMN file_versions.file_id IS 'Referência ao arquivo original na tabela uploads';
COMMENT ON COLUMN file_versions.version_number IS 'Número sequencial da versão';
COMMENT ON COLUMN file_versions.file_hash IS 'Hash MD5 do arquivo para detectar duplicatas';
COMMENT ON COLUMN file_versions.change_reason IS 'Motivo da criação desta versão';
COMMENT ON COLUMN file_versions.is_active IS 'Indica se a versão está ativa (não foi removida)';

-- RLS (Row Level Security)
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados verem apenas arquivos de sua empresa
CREATE POLICY "Users can view file versions from their company" ON file_versions
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Política para usuários autenticados criarem versões em sua empresa
CREATE POLICY "Users can create file versions in their company" ON file_versions
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Política para usuários atualizarem versões de sua empresa
CREATE POLICY "Users can update file versions from their company" ON file_versions
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Política para usuários removerem versões de sua empresa
CREATE POLICY "Users can delete file versions from their company" ON file_versions
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Conceder permissões aos roles
GRANT SELECT, INSERT, UPDATE, DELETE ON file_versions TO authenticated;
GRANT SELECT ON file_versions TO anon;