-- Otimização do banco de dados para suporte a muitas fotos
-- Adiciona campos para compressão, metadados e otimização de storage

-- Adicionar campos de otimização na tabela fotos
ALTER TABLE fotos 
ADD COLUMN IF NOT EXISTS tamanho_arquivo INTEGER,
ADD COLUMN IF NOT EXISTS formato VARCHAR(10),
ADD COLUMN IF NOT EXISTS comprimida BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS url_thumbnail TEXT,
ADD COLUMN IF NOT EXISTS largura INTEGER,
ADD COLUMN IF NOT EXISTS altura INTEGER,
ADD COLUMN IF NOT EXISTS hash_arquivo VARCHAR(64);

-- Criar índices para otimizar consultas com muitas fotos
CREATE INDEX IF NOT EXISTS idx_fotos_vistoria_id ON fotos(vistoria_id);
CREATE INDEX IF NOT EXISTS idx_fotos_ambiente ON fotos(ambiente);
CREATE INDEX IF NOT EXISTS idx_fotos_created_at ON fotos(created_at);
CREATE INDEX IF NOT EXISTS idx_fotos_tamanho ON fotos(tamanho_arquivo);
CREATE INDEX IF NOT EXISTS idx_fotos_hash ON fotos(hash_arquivo);

-- Criar tabela para armazenar configurações de storage
CREATE TABLE IF NOT EXISTS storage_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    max_file_size INTEGER DEFAULT 10485760, -- 10MB
    compression_quality INTEGER DEFAULT 80,
    thumbnail_size INTEGER DEFAULT 300,
    allowed_formats TEXT[] DEFAULT ARRAY['jpg', 'jpeg', 'png', 'webp'],
    auto_compress BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO storage_config (max_file_size, compression_quality, thumbnail_size, auto_compress)
VALUES (10485760, 80, 300, true)
ON CONFLICT DO NOTHING;

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger na tabela storage_config
DROP TRIGGER IF EXISTS update_storage_config_updated_at ON storage_config;
CREATE TRIGGER update_storage_config_updated_at
    BEFORE UPDATE ON storage_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Criar view para estatísticas de fotos
CREATE OR REPLACE VIEW fotos_stats AS
SELECT 
    v.empresa_id,
    COUNT(f.id) as total_fotos,
    SUM(f.tamanho_arquivo) as tamanho_total,
    AVG(f.tamanho_arquivo) as tamanho_medio,
    COUNT(CASE WHEN f.comprimida = true THEN 1 END) as fotos_comprimidas,
    COUNT(DISTINCT f.vistoria_id) as vistorias_com_fotos
FROM fotos f
JOIN vistorias v ON f.vistoria_id = v.id
GROUP BY v.empresa_id;

-- Garantir permissões para as novas tabelas
GRANT ALL PRIVILEGES ON storage_config TO authenticated;
GRANT SELECT ON fotos_stats TO authenticated;
GRANT ALL PRIVILEGES ON storage_config TO anon;
GRANT SELECT ON fotos_stats TO anon;

-- Comentários para documentação
COMMENT ON COLUMN fotos.tamanho_arquivo IS 'Tamanho do arquivo em bytes';
COMMENT ON COLUMN fotos.formato IS 'Formato da imagem (jpg, png, webp, etc.)';
COMMENT ON COLUMN fotos.comprimida IS 'Indica se a foto foi comprimida';
COMMENT ON COLUMN fotos.url_thumbnail IS 'URL da versão thumbnail da foto';
COMMENT ON COLUMN fotos.hash_arquivo IS 'Hash MD5 do arquivo para evitar duplicatas';
COMMENT ON TABLE storage_config IS 'Configurações globais para otimização de storage de fotos';
COMMENT ON VIEW fotos_stats IS 'Estatísticas de uso de fotos por empresa';