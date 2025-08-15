-- Grifo Vistorias - Políticas RLS para separação app_users e portal_users
-- Baseado na estrutura existente do banco

-- Habilitar RLS em todas as tabelas se ainda não estiver habilitado
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_vistoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistoria_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grifo_app_uploads ENABLE ROW LEVEL SECURITY;

-- Função para obter empresa_id do usuário app
CREATE OR REPLACE FUNCTION get_user_empresa_id_app()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT empresa_id 
    FROM app_users 
    WHERE auth_user_id = auth.uid()
    AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter empresa_id do usuário portal
CREATE OR REPLACE FUNCTION get_user_empresa_id_portal()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT empresa_id 
    FROM portal_users 
    WHERE auth_user_id = auth.uid()
    AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se é usuário do app
CREATE OR REPLACE FUNCTION is_app_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se é usuário do portal
CREATE OR REPLACE FUNCTION is_portal_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM portal_users 
    WHERE auth_user_id = auth.uid() 
    AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário tem role específica (app)
CREATE OR REPLACE FUNCTION has_app_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app_users 
    WHERE auth_user_id = auth.uid() 
    AND role = required_role
    AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário tem role específica (portal)
CREATE OR REPLACE FUNCTION has_portal_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM portal_users 
    WHERE auth_user_id = auth.uid() 
    AND role = required_role
    AND ativo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLÍTICAS RLS PARA EMPRESAS
-- Portal users podem ver/editar sua empresa
DROP POLICY IF EXISTS "Portal users can view their company" ON empresas;
CREATE POLICY "Portal users can view their company" ON empresas
  FOR SELECT USING (
    is_portal_user() AND id = get_user_empresa_id_portal()
  );

DROP POLICY IF EXISTS "Portal admins can update their company" ON empresas;
CREATE POLICY "Portal admins can update their company" ON empresas
  FOR UPDATE USING (
    is_portal_user() AND 
    id = get_user_empresa_id_portal() AND
    has_portal_role('admin')
  );

-- App users podem ver sua empresa
DROP POLICY IF EXISTS "App users can view their company" ON empresas;
CREATE POLICY "App users can view their company" ON empresas
  FOR SELECT USING (
    is_app_user() AND id = get_user_empresa_id_app()
  );

-- POLÍTICAS RLS PARA APP_USERS
-- Apenas portal users podem gerenciar app_users da mesma empresa
DROP POLICY IF EXISTS "Portal users can manage app users" ON app_users;
CREATE POLICY "Portal users can manage app users" ON app_users
  FOR ALL USING (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal()
  );

-- App users podem ver apenas seu próprio registro
DROP POLICY IF EXISTS "App users can view themselves" ON app_users;
CREATE POLICY "App users can view themselves" ON app_users
  FOR SELECT USING (
    is_app_user() AND auth_user_id = auth.uid()
  );

-- POLÍTICAS RLS PARA PORTAL_USERS
-- Portal users podem ver outros portal users da mesma empresa
DROP POLICY IF EXISTS "Portal users can view company portal users" ON portal_users;
CREATE POLICY "Portal users can view company portal users" ON portal_users
  FOR SELECT USING (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal()
  );

-- Apenas admins podem gerenciar outros portal users
DROP POLICY IF EXISTS "Portal admins can manage portal users" ON portal_users;
CREATE POLICY "Portal admins can manage portal users" ON portal_users
  FOR ALL USING (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal() AND
    has_portal_role('admin')
  );

-- POLÍTICAS RLS PARA IMÓVEIS
-- Portal users podem gerenciar imóveis da empresa
DROP POLICY IF EXISTS "Portal users can manage properties" ON imoveis;
CREATE POLICY "Portal users can manage properties" ON imoveis
  FOR ALL USING (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal()
  );

-- App users podem ver imóveis da empresa
DROP POLICY IF EXISTS "App users can view properties" ON imoveis;
CREATE POLICY "App users can view properties" ON imoveis
  FOR SELECT USING (
    is_app_user() AND 
    empresa_id = get_user_empresa_id_app()
  );

-- POLÍTICAS RLS PARA VISTORIAS
-- Portal users podem gerenciar vistorias da empresa
DROP POLICY IF EXISTS "Portal users can manage inspections" ON vistorias;
CREATE POLICY "Portal users can manage inspections" ON vistorias
  FOR ALL USING (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal()
  );

-- App users podem ver/editar vistorias atribuídas a eles
DROP POLICY IF EXISTS "App users can manage assigned inspections" ON vistorias;
CREATE POLICY "App users can manage assigned inspections" ON vistorias
  FOR ALL USING (
    is_app_user() AND 
    empresa_id = get_user_empresa_id_app() AND
    app_vistoriador_id = (
      SELECT id FROM app_users WHERE auth_user_id = auth.uid()
    )
  );

-- POLÍTICAS RLS PARA FOTOS
-- Portal users podem ver fotos de vistorias da empresa
DROP POLICY IF EXISTS "Portal users can view photos" ON fotos;
CREATE POLICY "Portal users can view photos" ON fotos
  FOR SELECT USING (
    is_portal_user() AND 
    EXISTS (
      SELECT 1 FROM vistorias v 
      WHERE v.id = fotos.vistoria_id 
      AND v.empresa_id = get_user_empresa_id_portal()
    )
  );

-- App users podem gerenciar fotos de suas vistorias
DROP POLICY IF EXISTS "App users can manage photos" ON fotos;
CREATE POLICY "App users can manage photos" ON fotos
  FOR ALL USING (
    is_app_user() AND 
    EXISTS (
      SELECT 1 FROM vistorias v 
      WHERE v.id = fotos.vistoria_id 
      AND v.empresa_id = get_user_empresa_id_app()
      AND v.app_vistoriador_id = (
        SELECT id FROM app_users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- POLÍTICAS RLS PARA ITENS_VISTORIA
-- Similar às fotos
DROP POLICY IF EXISTS "Portal users can view inspection items" ON itens_vistoria;
CREATE POLICY "Portal users can view inspection items" ON itens_vistoria
  FOR SELECT USING (
    is_portal_user() AND 
    EXISTS (
      SELECT 1 FROM vistorias v 
      WHERE v.id = itens_vistoria.vistoria_id 
      AND v.empresa_id = get_user_empresa_id_portal()
    )
  );

DROP POLICY IF EXISTS "App users can manage inspection items" ON itens_vistoria;
CREATE POLICY "App users can manage inspection items" ON itens_vistoria
  FOR ALL USING (
    is_app_user() AND 
    EXISTS (
      SELECT 1 FROM vistorias v 
      WHERE v.id = itens_vistoria.vistoria_id 
      AND v.empresa_id = get_user_empresa_id_app()
      AND v.app_vistoriador_id = (
        SELECT id FROM app_users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- POLÍTICAS RLS PARA CONTESTAÇÕES
-- Portal users podem gerenciar contestações da empresa
DROP POLICY IF EXISTS "Portal users can manage contestations" ON contestacoes;
CREATE POLICY "Portal users can manage contestations" ON contestacoes
  FOR ALL USING (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal()
  );

-- App users podem ver contestações de suas vistorias
DROP POLICY IF EXISTS "App users can view contestations" ON contestacoes;
CREATE POLICY "App users can view contestations" ON contestacoes
  FOR SELECT USING (
    is_app_user() AND 
    EXISTS (
      SELECT 1 FROM vistorias v 
      WHERE v.id = contestacoes.vistoria_id 
      AND v.empresa_id = get_user_empresa_id_app()
      AND v.app_vistoriador_id = (
        SELECT id FROM app_users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- POLÍTICAS RLS PARA NOTIFICATIONS
-- Portal users veem notificações da empresa
DROP POLICY IF EXISTS "Portal users can view notifications" ON notifications;
CREATE POLICY "Portal users can view notifications" ON notifications
  FOR SELECT USING (
    is_portal_user() AND 
    user_id IN (
      SELECT id FROM users WHERE empresa_id = get_user_empresa_id_portal()
    )
  );

-- App users veem suas próprias notificações
DROP POLICY IF EXISTS "App users can view notifications" ON notifications;
CREATE POLICY "App users can view notifications" ON notifications
  FOR SELECT USING (
    is_app_user() AND 
    user_id IN (
      SELECT id FROM users WHERE empresa_id = get_user_empresa_id_app()
    )
  );

-- POLÍTICAS RLS PARA VISTORIA_ASSIGNMENTS
-- Portal users podem gerenciar assignments da empresa
DROP POLICY IF EXISTS "Portal users can manage assignments" ON vistoria_assignments;
CREATE POLICY "Portal users can manage assignments" ON vistoria_assignments
  FOR ALL USING (
    is_portal_user() AND 
    EXISTS (
      SELECT 1 FROM vistorias v 
      WHERE v.id = vistoria_assignments.vistoria_id 
      AND v.empresa_id = get_user_empresa_id_portal()
    )
  );

-- App users podem ver assignments atribuídos a eles
DROP POLICY IF EXISTS "App users can view assignments" ON vistoria_assignments;
CREATE POLICY "App users can view assignments" ON vistoria_assignments
  FOR SELECT USING (
    is_app_user() AND 
    app_vistoriador_id = (
      SELECT id FROM app_users WHERE auth_user_id = auth.uid()
    )
  );

-- POLÍTICAS RLS PARA GRIFO_APP_UPLOADS
-- Portal users podem gerenciar uploads da empresa
DROP POLICY IF EXISTS "Portal users can manage uploads" ON grifo_app_uploads;
CREATE POLICY "Portal users can manage uploads" ON grifo_app_uploads
  FOR ALL USING (
    is_portal_user() AND 
    empresa_id = get_user_empresa_id_portal()
  );

-- App users podem gerenciar uploads de suas vistorias
DROP POLICY IF EXISTS "App users can manage uploads" ON grifo_app_uploads;
CREATE POLICY "App users can manage uploads" ON grifo_app_uploads
  FOR ALL USING (
    is_app_user() AND 
    empresa_id = get_user_empresa_id_app() AND
    (
      vistoria_id IS NULL OR
      EXISTS (
        SELECT 1 FROM vistorias v 
        WHERE v.id = grifo_app_uploads.vistoria_id 
        AND v.app_vistoriador_id = (
          SELECT id FROM app_users WHERE auth_user_id = auth.uid()
        )
      )
    )
  );

-- Comentários
COMMENT ON FUNCTION get_user_empresa_id_app() IS 'Retorna empresa_id do usuário app autenticado';
COMMENT ON FUNCTION get_user_empresa_id_portal() IS 'Retorna empresa_id do usuário portal autenticado';
COMMENT ON FUNCTION is_app_user() IS 'Verifica se o usuário autenticado é um app_user';
COMMENT ON FUNCTION is_portal_user() IS 'Verifica se o usuário autenticado é um portal_user';