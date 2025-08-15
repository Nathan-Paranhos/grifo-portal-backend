-- Criar bucket grifo-app no Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'grifo-app',
  'grifo-app',
  false,
  52428800, -- 50MB
  ARRAY[
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para o bucket grifo-app
CREATE POLICY "Portal users can manage grifo-app files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'grifo-app' AND
    is_portal_user() AND
    extract_empresa_id_from_path(name) = get_user_empresa_id_portal()
  );

CREATE POLICY "App users can manage grifo-app files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'grifo-app' AND
    is_app_user() AND
    extract_empresa_id_from_path(name) = get_user_empresa_id_app()
  );