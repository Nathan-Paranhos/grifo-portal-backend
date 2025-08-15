-- Grifo Vistorias - Políticas RLS (Row Level Security)
-- Baseado na arquitetura multi-tenant especificada no prompt.md

-- Habilita RLS em todas as tabelas
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE contestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar membership do usuário
CREATE OR REPLACE FUNCTION auth.user_company_ids()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT company_id 
    FROM company_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_uid = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário é admin global
CREATE OR REPLACE FUNCTION auth.is_global_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 
    FROM company_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE u.supabase_uid = auth.uid()::text
    AND cm.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para COMPANIES
-- Admins globais podem ver todas as empresas, outros usuários só veem suas empresas
CREATE POLICY "companies_select_policy" ON companies
  FOR SELECT TO authenticated
  USING (
    auth.is_global_admin() OR 
    id = ANY(auth.user_company_ids())
  );

CREATE POLICY "companies_insert_policy" ON companies
  FOR INSERT TO authenticated
  WITH CHECK (auth.is_global_admin());

CREATE POLICY "companies_update_policy" ON companies
  FOR UPDATE TO authenticated
  USING (
    auth.is_global_admin() OR 
    id = ANY(auth.user_company_ids())
  );

CREATE POLICY "companies_delete_policy" ON companies
  FOR DELETE TO authenticated
  USING (auth.is_global_admin());

-- Políticas para USERS
-- Usuários podem ver outros usuários das mesmas empresas
CREATE POLICY "users_select_policy" ON users
  FOR SELECT TO authenticated
  USING (
    supabase_uid = auth.uid()::text OR
    auth.is_global_admin() OR
    id IN (
      SELECT DISTINCT u.id
      FROM users u
      JOIN company_members cm ON cm.user_id = u.id
      WHERE cm.company_id = ANY(auth.user_company_ids())
    )
  );

CREATE POLICY "users_insert_policy" ON users
  FOR INSERT TO authenticated
  WITH CHECK (
    supabase_uid = auth.uid()::text OR
    auth.is_global_admin()
  );

CREATE POLICY "users_update_policy" ON users
  FOR UPDATE TO authenticated
  USING (
    supabase_uid = auth.uid()::text OR
    auth.is_global_admin()
  );

-- Políticas para COMPANY_MEMBERS
CREATE POLICY "company_members_select_policy" ON company_members
  FOR SELECT TO authenticated
  USING (
    company_id = ANY(auth.user_company_ids()) OR
    auth.is_global_admin()
  );

CREATE POLICY "company_members_insert_policy" ON company_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.is_global_admin() OR
    (company_id = ANY(auth.user_company_ids()) AND
     EXISTS(
       SELECT 1 FROM company_members cm2
       JOIN users u ON u.id = cm2.user_id
       WHERE u.supabase_uid = auth.uid()::text
       AND cm2.company_id = company_id
       AND cm2.role IN ('admin', 'manager')
     ))
  );

CREATE POLICY "company_members_update_policy" ON company_members
  FOR UPDATE TO authenticated
  USING (
    auth.is_global_admin() OR
    (company_id = ANY(auth.user_company_ids()) AND
     EXISTS(
       SELECT 1 FROM company_members cm2
       JOIN users u ON u.id = cm2.user_id
       WHERE u.supabase_uid = auth.uid()::text
       AND cm2.company_id = company_id
       AND cm2.role IN ('admin', 'manager')
     ))
  );

-- Políticas para PROPERTIES
CREATE POLICY "properties_select_policy" ON properties
  FOR SELECT TO authenticated
  USING (company_id = ANY(auth.user_company_ids()));

CREATE POLICY "properties_insert_policy" ON properties
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = ANY(auth.user_company_ids()) AND
    EXISTS(
      SELECT 1 FROM company_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_uid = auth.uid()::text
      AND cm.company_id = company_id
      AND cm.role IN ('admin', 'manager', 'attendant')
    )
  );

CREATE POLICY "properties_update_policy" ON properties
  FOR UPDATE TO authenticated
  USING (
    company_id = ANY(auth.user_company_ids()) AND
    EXISTS(
      SELECT 1 FROM company_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_uid = auth.uid()::text
      AND cm.company_id = company_id
      AND cm.role IN ('admin', 'manager', 'attendant')
    )
  );

CREATE POLICY "properties_delete_policy" ON properties
  FOR DELETE TO authenticated
  USING (
    company_id = ANY(auth.user_company_ids()) AND
    EXISTS(
      SELECT 1 FROM company_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_uid = auth.uid()::text
      AND cm.company_id = company_id
      AND cm.role IN ('admin', 'manager')
    )
  );

-- Políticas para INSPECTIONS
CREATE POLICY "inspections_select_policy" ON inspections
  FOR SELECT TO authenticated
  USING (company_id = ANY(auth.user_company_ids()));

CREATE POLICY "inspections_insert_policy" ON inspections
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = ANY(auth.user_company_ids()) AND
    EXISTS(
      SELECT 1 FROM company_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_uid = auth.uid()::text
      AND cm.company_id = company_id
      AND cm.role IN ('admin', 'manager', 'attendant')
    )
  );

CREATE POLICY "inspections_update_policy" ON inspections
  FOR UPDATE TO authenticated
  USING (
    company_id = ANY(auth.user_company_ids()) AND
    (
      -- Inspetores podem atualizar suas próprias vistorias
      (inspector_id IN (
        SELECT u.id FROM users u WHERE u.supabase_uid = auth.uid()::text
      )) OR
      -- Admins e managers podem atualizar qualquer vistoria da empresa
      EXISTS(
        SELECT 1 FROM company_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE u.supabase_uid = auth.uid()::text
        AND cm.company_id = company_id
        AND cm.role IN ('admin', 'manager')
      )
    )
  );

-- Políticas para CONTESTATIONS
CREATE POLICY "contestations_select_policy" ON contestations
  FOR SELECT TO authenticated
  USING (company_id = ANY(auth.user_company_ids()));

CREATE POLICY "contestations_insert_policy" ON contestations
  FOR INSERT TO authenticated
  WITH CHECK (company_id = ANY(auth.user_company_ids()));

CREATE POLICY "contestations_update_policy" ON contestations
  FOR UPDATE TO authenticated
  USING (
    company_id = ANY(auth.user_company_ids()) AND
    EXISTS(
      SELECT 1 FROM company_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_uid = auth.uid()::text
      AND cm.company_id = company_id
      AND cm.role IN ('admin', 'manager', 'attendant')
    )
  );

-- Políticas para UPLOADS
CREATE POLICY "uploads_select_policy" ON uploads
  FOR SELECT TO authenticated
  USING (company_id = ANY(auth.user_company_ids()));

CREATE POLICY "uploads_insert_policy" ON uploads
  FOR INSERT TO authenticated
  WITH CHECK (company_id = ANY(auth.user_company_ids()));

CREATE POLICY "uploads_delete_policy" ON uploads
  FOR DELETE TO authenticated
  USING (
    company_id = ANY(auth.user_company_ids()) AND
    (
      uploaded_by IN (
        SELECT u.id FROM users u WHERE u.supabase_uid = auth.uid()::text
      ) OR
      EXISTS(
        SELECT 1 FROM company_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE u.supabase_uid = auth.uid()::text
        AND cm.company_id = company_id
        AND cm.role IN ('admin', 'manager')
      )
    )
  );

-- Políticas para NOTIFICATIONS
CREATE POLICY "notifications_select_policy" ON notifications
  FOR SELECT TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM users u WHERE u.supabase_uid = auth.uid()::text
    ) OR
    (company_id = ANY(auth.user_company_ids()) AND
     EXISTS(
       SELECT 1 FROM company_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE u.supabase_uid = auth.uid()::text
       AND cm.company_id = company_id
       AND cm.role IN ('admin', 'manager')
     ))
  );

CREATE POLICY "notifications_insert_policy" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (company_id = ANY(auth.user_company_ids()));

CREATE POLICY "notifications_update_policy" ON notifications
  FOR UPDATE TO authenticated
  USING (
    user_id IN (
      SELECT u.id FROM users u WHERE u.supabase_uid = auth.uid()::text
    )
  );

-- Políticas para SETTINGS
CREATE POLICY "settings_select_policy" ON settings
  FOR SELECT TO authenticated
  USING (company_id = ANY(auth.user_company_ids()));

CREATE POLICY "settings_insert_policy" ON settings
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = ANY(auth.user_company_ids()) AND
    EXISTS(
      SELECT 1 FROM company_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_uid = auth.uid()::text
      AND cm.company_id = company_id
      AND cm.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "settings_update_policy" ON settings
  FOR UPDATE TO authenticated
  USING (
    company_id = ANY(auth.user_company_ids()) AND
    EXISTS(
      SELECT 1 FROM company_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_uid = auth.uid()::text
      AND cm.company_id = company_id
      AND cm.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "settings_delete_policy" ON settings
  FOR DELETE TO authenticated
  USING (
    company_id = ANY(auth.user_company_ids()) AND
    EXISTS(
      SELECT 1 FROM company_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE u.supabase_uid = auth.uid()::text
      AND cm.company_id = company_id
      AND cm.role IN ('admin', 'manager')
    )
  );