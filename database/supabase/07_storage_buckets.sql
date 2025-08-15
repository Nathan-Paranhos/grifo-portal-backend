-- Grifo Vistorias - Configuração dos Buckets de Storage
-- Buckets para fotos de vistorias e documentos da empresa

-- Criar bucket para fotos de vistorias (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-vistorias',
  'fotos-vistorias', 
  false,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket para documentos da empresa (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-empresa',
  'documentos-empresa',
  false,
  104857600, -- 100MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket para avatars de usuários (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars-usuarios',
  'avatars-usuarios',
  true, -- público para facilitar exibição
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Função para extrair empresa_id do path do storage
CREATE OR REPLACE FUNCTION extract_empresa_id_from_path(path TEXT)
RETURNS UUID AS $$
BEGIN
  -- Path format: empresa_id/vistoria_id/filename ou empresa_id/filename
  RETURN (string_to_array(path, '/'))[1]::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- POLÍTICAS RLS PARA BUCKET fotos-vistorias

-- Portal users podem ver fotos de vistorias da sua empresa
CREATE POLICY "Portal users can view inspection photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fotos-vistorias' AND
    is_portal_user() AND
    extract_empresa_id_from_path(name) = get_user_empresa_id_portal()
  );

-- App users podem fazer upload de fotos de vistorias da sua empresa
CREATE POLICY "App users can upload inspection photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fotos-vistorias' AND
    is_app_user() AND
    extract_empresa_id_from_path(name) = get_user_empresa_id_app()
  );

-- App users podem ver fotos de vistorias da sua empresa
CREATE POLICY "App users can view inspection photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fotos-vistorias' AND
    is_app_user() AND
    extract_empresa_id_from_path(name) = get_user_empresa_id_app()
  );

-- App users podem deletar fotos que fizeram upload
CREATE POLICY "App users can delete their photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fotos-vistorias' AND
    is_app_user() AND
    extract_empresa_id_from_path(name) = get_user_empresa_id_app() AND
    owner = auth.uid()
  );

-- Portal admins podem deletar fotos da empresa
CREATE POLICY "Portal admins can delete company photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fotos-vistorias' AND
    is_portal_user() AND
    has_portal_role('admin') AND
    extract_empresa_id_from_path(name) = get_user_empresa_id_portal()
  );

-- POLÍTICAS RLS PARA BUCKET documentos-empresa

-- Portal users podem gerenciar documentos da empresa
CREATE POLICY "Portal users can manage company documents" ON storage.objects
  FOR ALL USING (
    bucket_id = 'documentos-empresa' AND
    is_portal_user() AND
    extract_empresa_id_from_path(name) = get_user_empresa_id_portal()
  );

-- App users podem ver documentos da empresa (somente leitura)
CREATE POLICY "App users can view company documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documentos-empresa' AND
    is_app_user() AND
    extract_empresa_id_from_path(name) = get_user_empresa_id_app()
  );

-- POLÍTICAS RLS PARA BUCKET avatars-usuarios

-- Usuários podem fazer upload do próprio avatar
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars-usuarios' AND
    auth.uid()::TEXT = (string_to_array(name, '/'))[1]
  );

-- Usuários podem ver avatars (bucket público)
CREATE POLICY "Users can view avatars" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'avatars-usuarios'
  );

-- Usuários podem atualizar próprio avatar
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars-usuarios' AND
    auth.uid()::TEXT = (string_to_array(name, '/'))[1]
  );

-- Usuários podem deletar próprio avatar
CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars-usuarios' AND
    auth.uid()::TEXT = (string_to_array(name, '/'))[1]
  );

-- Função para gerar URL assinada para fotos de vistoria
CREATE OR REPLACE FUNCTION get_signed_photo_url(
  bucket_name TEXT,
  file_path TEXT,
  expires_in INTEGER DEFAULT 3600
)
RETURNS TEXT AS $$
DECLARE
  signed_url TEXT;
BEGIN
  -- Verificar se usuário tem acesso ao arquivo
  IF bucket_name = 'fotos-vistorias' THEN
    IF is_portal_user() THEN
      IF extract_empresa_id_from_path(file_path) != get_user_empresa_id_portal() THEN
        RETURN NULL;
      END IF;
    ELSIF is_app_user() THEN
      IF extract_empresa_id_from_path(file_path) != get_user_empresa_id_app() THEN
        RETURN NULL;
      END IF;
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  -- Gerar URL assinada (simulação - na prática seria feito via API)
  signed_url := format('https://your-supabase-url.supabase.co/storage/v1/object/sign/%s/%s?expires_in=%s', 
                      bucket_name, file_path, expires_in);
  
  RETURN signed_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar uploads órfãos (fotos sem vistoria associada)
CREATE OR REPLACE FUNCTION cleanup_orphaned_uploads()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Deletar fotos órfãs (mais de 24h sem vistoria associada)
  WITH orphaned_photos AS (
    SELECT o.name
    FROM storage.objects o
    WHERE o.bucket_id = 'fotos-vistorias'
    AND o.created_at < NOW() - INTERVAL '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM fotos f 
      WHERE f.storage_path = o.name
    )
  )
  DELETE FROM storage.objects 
  WHERE bucket_id = 'fotos-vistorias' 
  AND name IN (SELECT name FROM orphaned_photos);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON FUNCTION extract_empresa_id_from_path(TEXT) IS 'Extrai empresa_id do path do storage';
COMMENT ON FUNCTION get_signed_photo_url(TEXT, TEXT, INTEGER) IS 'Gera URL assinada para fotos com verificação de acesso';
COMMENT ON FUNCTION cleanup_orphaned_uploads() IS 'Remove uploads órfãos do storage';