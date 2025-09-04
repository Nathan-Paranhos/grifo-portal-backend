-- =====================================================
-- GRIFO VISTORIAS - CONFIGURAÇÃO DE STORAGE BUCKETS
-- =====================================================
-- Versão: 1.0
-- Data: 2025-01-16
-- Descrição: Configuração completa dos buckets de storage

-- =====================================================
-- 1. CRIAÇÃO DOS BUCKETS PRINCIPAIS
-- =====================================================

-- Bucket principal para o app Grifo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'grifo-app',
  'grifo-app',
  false, -- Privado por padrão
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Bucket para fotos de vistorias
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vistoria-fotos',
  'vistoria-fotos',
  false, -- Privado por padrão
  5242880, -- 5MB por foto
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Bucket para relatórios e documentos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'relatorios',
  'relatorios',
  false, -- Privado por padrão
  52428800, -- 50MB para PDFs
  ARRAY['application/pdf', 'application/zip', 'text/plain']
) ON CONFLICT (id) DO NOTHING;

-- Bucket para logos e assets das empresas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'empresa-assets',
  'empresa-assets',
  true, -- Público para logos
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. POLÍTICAS DE ACESSO AOS BUCKETS
-- =====================================================

-- =====================================================
-- 2.1 POLÍTICAS PARA BUCKET 'grifo-app'
-- =====================================================

-- Política de SELECT para grifo-app
CREATE POLICY "Authenticated users can view company files in grifo-app"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'grifo-app' AND
  auth.role() = 'authenticated' AND
  (
    -- Usuários do portal podem ver arquivos da sua empresa
    (EXISTS (
      SELECT 1 FROM portal_users pu 
      WHERE pu.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = pu.empresa_id::text
    )) OR
    -- Usuários do app podem ver arquivos da sua empresa
    (EXISTS (
      SELECT 1 FROM app_users au 
      WHERE au.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = au.empresa_id::text
    ))
  )
);

-- Política de INSERT para grifo-app
CREATE POLICY "Authenticated users can upload files to grifo-app"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'grifo-app' AND
  auth.role() = 'authenticated' AND
  (
    -- Usuários do portal podem fazer upload para sua empresa
    (EXISTS (
      SELECT 1 FROM portal_users pu 
      WHERE pu.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = pu.empresa_id::text
    )) OR
    -- Usuários do app podem fazer upload para sua empresa
    (EXISTS (
      SELECT 1 FROM app_users au 
      WHERE au.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = au.empresa_id::text
    ))
  )
);

-- Política de UPDATE para grifo-app
CREATE POLICY "Authenticated users can update company files in grifo-app"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'grifo-app' AND
  auth.role() = 'authenticated' AND
  (
    -- Usuários do portal podem atualizar arquivos da sua empresa
    (EXISTS (
      SELECT 1 FROM portal_users pu 
      WHERE pu.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = pu.empresa_id::text
    )) OR
    -- Usuários do app podem atualizar arquivos da sua empresa
    (EXISTS (
      SELECT 1 FROM app_users au 
      WHERE au.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = au.empresa_id::text
    ))
  )
);

-- Política de DELETE para grifo-app
CREATE POLICY "Portal users can delete company files in grifo-app"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'grifo-app' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM portal_users pu 
    WHERE pu.auth_user_id = auth.uid() 
    AND (storage.foldername(name))[1] = pu.empresa_id::text
    AND (pu.role = 'admin' OR pu.can_edit_vistorias = true)
  )
);

-- =====================================================
-- 2.2 POLÍTICAS PARA BUCKET 'vistoria-fotos'
-- =====================================================

-- Política de SELECT para vistoria-fotos
CREATE POLICY "Users can view inspection photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vistoria-fotos' AND
  auth.role() = 'authenticated' AND
  (
    -- Usuários do portal podem ver fotos da sua empresa
    (EXISTS (
      SELECT 1 FROM portal_users pu 
      WHERE pu.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = pu.empresa_id::text
    )) OR
    -- Usuários do app podem ver fotos das vistorias atribuídas
    (EXISTS (
      SELECT 1 FROM app_users au
      JOIN vistorias v ON v.app_vistoriador_id = au.id
      WHERE au.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = au.empresa_id::text
      AND (storage.foldername(name))[2] = v.id::text
    ))
  )
);

-- Política de INSERT para vistoria-fotos
CREATE POLICY "Users can upload inspection photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vistoria-fotos' AND
  auth.role() = 'authenticated' AND
  (
    -- Usuários do portal podem fazer upload de fotos da sua empresa
    (EXISTS (
      SELECT 1 FROM portal_users pu 
      WHERE pu.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = pu.empresa_id::text
    )) OR
    -- Usuários do app podem fazer upload de fotos das vistorias atribuídas
    (EXISTS (
      SELECT 1 FROM app_users au
      JOIN vistorias v ON v.app_vistoriador_id = au.id
      WHERE au.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = au.empresa_id::text
      AND (storage.foldername(name))[2] = v.id::text
    ))
  )
);

-- Política de DELETE para vistoria-fotos
CREATE POLICY "Portal users can delete inspection photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vistoria-fotos' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM portal_users pu 
    WHERE pu.auth_user_id = auth.uid() 
    AND (storage.foldername(name))[1] = pu.empresa_id::text
    AND (pu.role = 'admin' OR pu.can_edit_vistorias = true)
  )
);

-- =====================================================
-- 2.3 POLÍTICAS PARA BUCKET 'relatorios'
-- =====================================================

-- Política de SELECT para relatórios
CREATE POLICY "Users can view company reports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'relatorios' AND
  auth.role() = 'authenticated' AND
  (
    -- Usuários do portal podem ver relatórios da sua empresa
    (EXISTS (
      SELECT 1 FROM portal_users pu 
      WHERE pu.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = pu.empresa_id::text
    )) OR
    -- Usuários do app podem ver relatórios das suas vistorias
    (EXISTS (
      SELECT 1 FROM app_users au
      JOIN vistorias v ON v.app_vistoriador_id = au.id
      WHERE au.auth_user_id = auth.uid() 
      AND (storage.foldername(name))[1] = au.empresa_id::text
      AND (storage.foldername(name))[2] = v.id::text
    ))
  )
);

-- Política de INSERT para relatórios
CREATE POLICY "Portal users can upload reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'relatorios' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM portal_users pu 
    WHERE pu.auth_user_id = auth.uid() 
    AND (storage.foldername(name))[1] = pu.empresa_id::text
  )
);

-- Política de DELETE para relatórios
CREATE POLICY "Admin users can delete reports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'relatorios' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM portal_users pu 
    WHERE pu.auth_user_id = auth.uid() 
    AND (storage.foldername(name))[1] = pu.empresa_id::text
    AND pu.role = 'admin'
  )
);

-- =====================================================
-- 2.4 POLÍTICAS PARA BUCKET 'empresa-assets'
-- =====================================================

-- Política de SELECT para empresa-assets (público)
CREATE POLICY "Public access to company assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'empresa-assets');

-- Política de INSERT para empresa-assets
CREATE POLICY "Portal admins can upload company assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'empresa-assets' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM portal_users pu 
    WHERE pu.auth_user_id = auth.uid() 
    AND (storage.foldername(name))[1] = pu.empresa_id::text
    AND (pu.role = 'admin' OR pu.can_manage_users = true)
  )
);

-- Política de UPDATE para empresa-assets
CREATE POLICY "Portal admins can update company assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'empresa-assets' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM portal_users pu 
    WHERE pu.auth_user_id = auth.uid() 
    AND (storage.foldername(name))[1] = pu.empresa_id::text
    AND (pu.role = 'admin' OR pu.can_manage_users = true)
  )
);

-- Política de DELETE para empresa-assets
CREATE POLICY "Portal admins can delete company assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'empresa-assets' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM portal_users pu 
    WHERE pu.auth_user_id = auth.uid() 
    AND (storage.foldername(name))[1] = pu.empresa_id::text
    AND pu.role = 'admin'
  )
);

-- =====================================================
-- 3. FUNÇÕES AUXILIARES PARA STORAGE
-- =====================================================

-- Função para gerar caminho de arquivo por empresa
CREATE OR REPLACE FUNCTION generate_storage_path(
  empresa_id UUID,
  vistoria_id UUID DEFAULT NULL,
  categoria TEXT DEFAULT 'geral',
  filename TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
BEGIN
  IF vistoria_id IS NOT NULL THEN
    RETURN empresa_id::text || '/' || vistoria_id::text || '/' || categoria || '/' || COALESCE(filename, '');
  ELSE
    RETURN empresa_id::text || '/' || categoria || '/' || COALESCE(filename, '');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para validar estrutura de pastas
CREATE OR REPLACE FUNCTION validate_storage_path(path TEXT, bucket_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  path_parts TEXT[];
  empresa_uuid UUID;
BEGIN
  -- Dividir o caminho em partes
  path_parts := string_to_array(path, '/');
  
  -- Validar se tem pelo menos empresa_id
  IF array_length(path_parts, 1) < 2 THEN
    RETURN FALSE;
  END IF;
  
  -- Validar se o primeiro elemento é um UUID válido
  BEGIN
    empresa_uuid := path_parts[1]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
  
  -- Validar se a empresa existe
  IF NOT EXISTS (SELECT 1 FROM empresas WHERE id = empresa_uuid) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. TRIGGERS PARA VALIDAÇÃO DE UPLOADS
-- =====================================================

-- Função de trigger para validar uploads
CREATE OR REPLACE FUNCTION validate_storage_upload()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar estrutura do caminho
  IF NOT validate_storage_path(NEW.name, NEW.bucket_id) THEN
    RAISE EXCEPTION 'Invalid storage path structure: %', NEW.name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de validação
CREATE TRIGGER validate_storage_upload_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id IN ('grifo-app', 'vistoria-fotos', 'relatorios', 'empresa-assets'))
  EXECUTE FUNCTION validate_storage_upload();

-- =====================================================
-- 5. VIEWS PARA MONITORAMENTO DE STORAGE
-- =====================================================

-- View para estatísticas de uso por empresa
CREATE OR REPLACE VIEW storage_usage_by_company AS
SELECT 
  e.id as empresa_id,
  e.nome as empresa_nome,
  so.bucket_id,
  COUNT(*) as total_files,
  SUM(so.metadata->>'size')::BIGINT as total_size_bytes,
  ROUND(SUM(so.metadata->>'size')::BIGINT / 1024.0 / 1024.0, 2) as total_size_mb
FROM empresas e
LEFT JOIN storage.objects so ON (storage.foldername(so.name))[1] = e.id::text
WHERE so.bucket_id IN ('grifo-app', 'vistoria-fotos', 'relatorios', 'empresa-assets')
GROUP BY e.id, e.nome, so.bucket_id
ORDER BY e.nome, so.bucket_id;

-- View para arquivos recentes por empresa
CREATE OR REPLACE VIEW recent_uploads_by_company AS
SELECT 
  e.id as empresa_id,
  e.nome as empresa_nome,
  so.bucket_id,
  so.name as file_path,
  so.metadata->>'size' as file_size,
  so.created_at,
  so.updated_at
FROM empresas e
JOIN storage.objects so ON (storage.foldername(so.name))[1] = e.id::text
WHERE so.bucket_id IN ('grifo-app', 'vistoria-fotos', 'relatorios', 'empresa-assets')
  AND so.created_at >= NOW() - INTERVAL '7 days'
ORDER BY so.created_at DESC;

-- =====================================================
-- 6. CONFIGURAÇÕES DE LIMPEZA AUTOMÁTICA
-- =====================================================

-- Função para limpeza de arquivos antigos
CREATE OR REPLACE FUNCTION cleanup_old_storage_files(
  bucket_name TEXT,
  days_old INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  file_record RECORD;
BEGIN
  -- Buscar arquivos antigos
  FOR file_record IN
    SELECT id, name, bucket_id
    FROM storage.objects
    WHERE bucket_id = bucket_name
      AND created_at < NOW() - (days_old || ' days')::INTERVAL
  LOOP
    -- Deletar arquivo
    DELETE FROM storage.objects WHERE id = file_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. REGISTRAR MIGRAÇÃO
-- =====================================================

INSERT INTO migration_log (name, description) 
VALUES ('01_storage_buckets', 'Configuração completa dos buckets de storage com políticas RLS');

-- =====================================================
-- 8. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION generate_storage_path(UUID, UUID, TEXT, TEXT) IS 'Gera caminho padronizado para arquivos no storage';
COMMENT ON FUNCTION validate_storage_path(TEXT, TEXT) IS 'Valida estrutura de caminhos no storage';
COMMENT ON FUNCTION cleanup_old_storage_files(TEXT, INTEGER) IS 'Remove arquivos antigos do storage';

COMMENT ON VIEW storage_usage_by_company IS 'Estatísticas de uso de storage por empresa';
COMMENT ON VIEW recent_uploads_by_company IS 'Uploads recentes por empresa (últimos 7 dias)';

-- =====================================================
-- FIM DA CONFIGURAÇÃO DE STORAGE
-- =====================================================