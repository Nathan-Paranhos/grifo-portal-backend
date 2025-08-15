-- Criar políticas RLS para isolamento multiempresa

-- 1. Políticas para tabela empresas
DROP POLICY IF EXISTS "empresas_policy_select" ON public.empresas;
DROP POLICY IF EXISTS "empresas_policy_insert" ON public.empresas;
DROP POLICY IF EXISTS "empresas_policy_update" ON public.empresas;
DROP POLICY IF EXISTS "empresas_policy_delete" ON public.empresas;

CREATE POLICY "empresas_policy_select" ON public.empresas
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        id = (auth.jwt() ->> 'empresa_id')::uuid OR
        id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
    );

CREATE POLICY "empresas_policy_insert" ON public.empresas
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        auth.role() = 'authenticated'
    );

CREATE POLICY "empresas_policy_update" ON public.empresas
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        id = (auth.jwt() ->> 'empresa_id')::uuid OR
        id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
    );

CREATE POLICY "empresas_policy_delete" ON public.empresas
    FOR DELETE USING (
        auth.role() = 'service_role'
    );

-- 2. Políticas para tabela imoveis
DROP POLICY IF EXISTS "imoveis_policy_select" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_policy_insert" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_policy_update" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_policy_delete" ON public.imoveis;

CREATE POLICY "imoveis_policy_select" ON public.imoveis
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
    );

CREATE POLICY "imoveis_policy_insert" ON public.imoveis
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        (auth.role() = 'authenticated' AND 
         (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
          empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid))
    );

CREATE POLICY "imoveis_policy_update" ON public.imoveis
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
    );

CREATE POLICY "imoveis_policy_delete" ON public.imoveis
    FOR DELETE USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
    );

-- 3. Políticas para tabela vistorias
DROP POLICY IF EXISTS "vistorias_policy_select" ON public.vistorias;
DROP POLICY IF EXISTS "vistorias_policy_insert" ON public.vistorias;
DROP POLICY IF EXISTS "vistorias_policy_update" ON public.vistorias;
DROP POLICY IF EXISTS "vistorias_policy_delete" ON public.vistorias;

CREATE POLICY "vistorias_policy_select" ON public.vistorias
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
    );

CREATE POLICY "vistorias_policy_insert" ON public.vistorias
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        (auth.role() = 'authenticated' AND 
         (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
          empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid))
    );

CREATE POLICY "vistorias_policy_update" ON public.vistorias
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
    );

CREATE POLICY "vistorias_policy_delete" ON public.vistorias
    FOR DELETE USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
    );

-- 4. Políticas para tabela fotos
DROP POLICY IF EXISTS "fotos_policy_select" ON public.fotos;
DROP POLICY IF EXISTS "fotos_policy_insert" ON public.fotos;
DROP POLICY IF EXISTS "fotos_policy_update" ON public.fotos;
DROP POLICY IF EXISTS "fotos_policy_delete" ON public.fotos;

CREATE POLICY "fotos_policy_select" ON public.fotos
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        EXISTS (
            SELECT 1 FROM public.vistorias v 
            WHERE v.id = fotos.vistoria_id 
            AND (v.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
                 v.empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid)
        )
    );

CREATE POLICY "fotos_policy_insert" ON public.fotos
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        (auth.role() = 'authenticated' AND 
         EXISTS (
            SELECT 1 FROM public.vistorias v 
            WHERE v.id = fotos.vistoria_id 
            AND (v.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
                 v.empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid)
        ))
    );

CREATE POLICY "fotos_policy_update" ON public.fotos
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        EXISTS (
            SELECT 1 FROM public.vistorias v 
            WHERE v.id = fotos.vistoria_id 
            AND (v.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
                 v.empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid)
        )
    );

CREATE POLICY "fotos_policy_delete" ON public.fotos
    FOR DELETE USING (
        auth.role() = 'service_role' OR 
        EXISTS (
            SELECT 1 FROM public.vistorias v 
            WHERE v.id = fotos.vistoria_id 
            AND (v.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
                 v.empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid)
        )
    );

-- 5. Políticas para tabela app_users
DROP POLICY IF EXISTS "app_users_policy_select" ON public.app_users;
DROP POLICY IF EXISTS "app_users_policy_insert" ON public.app_users;
DROP POLICY IF EXISTS "app_users_policy_update" ON public.app_users;
DROP POLICY IF EXISTS "app_users_policy_delete" ON public.app_users;

CREATE POLICY "app_users_policy_select" ON public.app_users
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid OR
        auth_user_id = auth.uid()
    );

CREATE POLICY "app_users_policy_insert" ON public.app_users
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        (auth.role() = 'authenticated' AND 
         (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
          empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid))
    );

CREATE POLICY "app_users_policy_update" ON public.app_users
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid OR
        auth_user_id = auth.uid()
    );

CREATE POLICY "app_users_policy_delete" ON public.app_users
    FOR DELETE USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
    );

-- 6. Políticas para tabela portal_users
DROP POLICY IF EXISTS "portal_users_policy_select" ON public.portal_users;
DROP POLICY IF EXISTS "portal_users_policy_insert" ON public.portal_users;
DROP POLICY IF EXISTS "portal_users_policy_update" ON public.portal_users;
DROP POLICY IF EXISTS "portal_users_policy_delete" ON public.portal_users;

CREATE POLICY "portal_users_policy_select" ON public.portal_users
    FOR SELECT USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid OR
        auth_user_id = auth.uid()
    );

CREATE POLICY "portal_users_policy_insert" ON public.portal_users
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR 
        (auth.role() = 'authenticated' AND 
         (empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
          empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid))
    );

CREATE POLICY "portal_users_policy_update" ON public.portal_users
    FOR UPDATE USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid OR
        auth_user_id = auth.uid()
    );

CREATE POLICY "portal_users_policy_delete" ON public.portal_users
    FOR DELETE USING (
        auth.role() = 'service_role' OR 
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
        empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
    );

-- Garantir permissões básicas para as roles
GRANT SELECT ON public.empresas TO anon, authenticated;
GRANT INSERT, UPDATE ON public.empresas TO authenticated;

GRANT SELECT ON public.imoveis TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.imoveis TO authenticated;

GRANT SELECT ON public.vistorias TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vistorias TO authenticated;

GRANT SELECT ON public.fotos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fotos TO authenticated;

GRANT SELECT ON public.app_users TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_users TO authenticated;

GRANT SELECT ON public.portal_users TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.portal_users TO authenticated;

-- Comentário de finalização
-- Políticas RLS criadas para isolamento multiempresa
-- Cada empresa só pode acessar seus próprios dados
-- SERVICE_ROLE tem acesso total para operações administrativas