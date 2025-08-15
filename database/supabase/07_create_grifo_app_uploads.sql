-- Criação da tabela grifo_app_uploads
CREATE TABLE IF NOT EXISTS grifo_app_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vistoria_id UUID NOT NULL REFERENCES vistorias(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE grifo_app_uploads ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para grifo_app_uploads
DROP POLICY IF EXISTS "Portal users can manage uploads" ON grifo_app_uploads;
CREATE POLICY "Portal users can manage uploads" ON grifo_app_uploads
  FOR ALL USING (
    is_portal_user() AND 
    get_user_empresa_id_portal() = (SELECT empresa_id FROM vistorias WHERE id = grifo_app_uploads.vistoria_id)
  );

DROP POLICY IF EXISTS "App users can manage uploads" ON grifo_app_uploads;
CREATE POLICY "App users can manage uploads" ON grifo_app_uploads
  FOR ALL USING (
    is_app_user() AND 
    EXISTS (
      SELECT 1 FROM vistorias v 
      WHERE v.id = grifo_app_uploads.vistoria_id 
      AND v.app_vistoriador_id = (
        SELECT id FROM app_users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_grifo_app_uploads_vistoria_id ON grifo_app_uploads(vistoria_id);
CREATE INDEX IF NOT EXISTS idx_grifo_app_uploads_uploaded_by ON grifo_app_uploads(uploaded_by);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_grifo_app_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_grifo_app_uploads_updated_at
    BEFORE UPDATE ON grifo_app_uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_grifo_app_uploads_updated_at();