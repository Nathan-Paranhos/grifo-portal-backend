-- Grifo Vistorias - Configuração de Storage
-- Baseado na arquitetura multi-tenant especificada no prompt.md

-- Criar bucket para uploads de vistorias
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-uploads',
  'inspection-uploads',
  false,
  52428800, -- 50MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Criar bucket para documentos de empresas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-documents',
  'company-documents',
  false,
  10485760, -- 10MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Criar bucket para avatares de usuários
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  2097152, -- 2MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas RLS para bucket inspection-uploads
-- Usuários podem fazer upload apenas para sua própria empresa
CREATE POLICY "Users can upload inspection files for their company"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'inspection-uploads' AND
  auth.uid()::text IN (
    SELECT u.supabase_uid
    FROM users u
    JOIN company_members cm ON cm.user_id = u.id
    WHERE cm.company_id::text = (storage.foldername(name))[1]
    AND u.supabase_uid = auth.uid()::text
  )
);

-- Usuários podem visualizar arquivos de vistorias da sua empresa
CREATE POLICY "Users can view inspection files from their company"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'inspection-uploads' AND
  auth.uid()::text IN (
    SELECT u.supabase_uid
    FROM users u
    JOIN company_members cm ON cm.user_id = u.id
    WHERE cm.company_id::text = (storage.foldername(name))[1]
    AND u.supabase_uid = auth.uid()::text
  )
);

-- Usuários podem atualizar arquivos de vistorias da sua empresa
CREATE POLICY "Users can update inspection files from their company"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'inspection-uploads' AND
  auth.uid()::text IN (
    SELECT u.supabase_uid
    FROM users u
    JOIN company_members cm ON cm.user_id = u.id
    WHERE cm.company_id::text = (storage.foldername(name))[1]
    AND u.supabase_uid = auth.uid()::text
  )
);

-- Apenas admins e managers podem deletar arquivos de vistorias
CREATE POLICY "Admins and managers can delete inspection files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'inspection-uploads' AND
  auth.uid()::text IN (
    SELECT u.supabase_uid
    FROM users u
    JOIN company_members cm ON cm.user_id = u.id
    WHERE cm.company_id::text = (storage.foldername(name))[1]
    AND u.supabase_uid = auth.uid()::text
    AND cm.role IN ('admin', 'manager')
  )
);

-- Políticas RLS para bucket company-documents
-- Usuários podem fazer upload de documentos para sua empresa
CREATE POLICY "Users can upload company documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-documents' AND
  auth.uid()::text IN (
    SELECT u.supabase_uid
    FROM users u
    JOIN company_members cm ON cm.user_id = u.id
    WHERE cm.company_id::text = (storage.foldername(name))[1]
    AND u.supabase_uid = auth.uid()::text
    AND cm.role IN ('admin', 'manager')
  )
);

-- Usuários podem visualizar documentos da sua empresa
CREATE POLICY "Users can view company documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'company-documents' AND
  auth.uid()::text IN (
    SELECT u.supabase_uid
    FROM users u
    JOIN company_members cm ON cm.user_id = u.id
    WHERE cm.company_id::text = (storage.foldername(name))[1]
    AND u.supabase_uid = auth.uid()::text
  )
);

-- Apenas admins podem atualizar documentos da empresa
CREATE POLICY "Admins can update company documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-documents' AND
  auth.uid()::text IN (
    SELECT u.supabase_uid
    FROM users u
    JOIN company_members cm ON cm.user_id = u.id
    WHERE cm.company_id::text = (storage.foldername(name))[1]
    AND u.supabase_uid = auth.uid()::text
    AND cm.role = 'admin'
  )
);

-- Apenas admins podem deletar documentos da empresa
CREATE POLICY "Admins can delete company documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-documents' AND
  auth.uid()::text IN (
    SELECT u.supabase_uid
    FROM users u
    JOIN company_members cm ON cm.user_id = u.id
    WHERE cm.company_id::text = (storage.foldername(name))[1]
    AND u.supabase_uid = auth.uid()::text
    AND cm.role = 'admin'
  )
);

-- Políticas RLS para bucket user-avatars
-- Usuários podem fazer upload do próprio avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Qualquer usuário autenticado pode visualizar avatares (bucket público)
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-avatars' AND
  auth.role() = 'authenticated'
);

-- Usuários podem atualizar apenas o próprio avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Usuários podem deletar apenas o próprio avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Função auxiliar para organizar uploads por empresa e data
CREATE OR REPLACE FUNCTION generate_upload_path(
  p_company_id UUID,
  p_inspection_id UUID,
  p_filename TEXT,
  p_file_type TEXT DEFAULT 'image'
)
RETURNS TEXT AS $$
DECLARE
  date_path TEXT;
  sanitized_filename TEXT;
BEGIN
  -- Gera caminho baseado na data atual
  date_path := to_char(NOW(), 'YYYY/MM/DD');
  
  -- Sanitiza o nome do arquivo
  sanitized_filename := regexp_replace(
    lower(p_filename), 
    '[^a-z0-9._-]', 
    '_', 
    'g'
  );
  
  -- Retorna o caminho completo
  RETURN p_company_id || '/' || p_file_type || 's/' || date_path || '/' || p_inspection_id || '/' || sanitized_filename;
END;
$$ LANGUAGE plpgsql;

-- Função para limpar uploads órfãos (sem referência na tabela uploads)
CREATE OR REPLACE FUNCTION cleanup_orphaned_uploads()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  file_record RECORD;
BEGIN
  -- Busca arquivos no storage que não têm referência na tabela uploads
  FOR file_record IN
    SELECT so.name, so.bucket_id
    FROM storage.objects so
    LEFT JOIN uploads u ON u.file_path = so.name
    WHERE so.bucket_id IN ('inspection-uploads', 'company-documents')
    AND u.id IS NULL
    AND so.created_at < NOW() - INTERVAL '24 hours' -- Apenas arquivos com mais de 24h
  LOOP
    -- Remove o arquivo do storage
    DELETE FROM storage.objects 
    WHERE name = file_record.name 
    AND bucket_id = file_record.bucket_id;
    
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para obter URL assinada para download
CREATE OR REPLACE FUNCTION get_signed_upload_url(
  p_file_path TEXT,
  p_bucket_id TEXT DEFAULT 'inspection-uploads',
  p_expires_in INTEGER DEFAULT 3600
)
RETURNS TEXT AS $$
BEGIN
  -- Esta função seria implementada via Edge Function ou API
  -- Aqui apenas retornamos o caminho para referência
  RETURN '/api/v1/uploads/download?bucket=' || p_bucket_id || '&path=' || p_file_path;
END;
$$ LANGUAGE plpgsql;