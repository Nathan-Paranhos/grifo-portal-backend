-- Correção final das políticas RLS - Negar acesso anônimo explicitamente

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "empresas_policy_select" ON public.empresas;
DROP POLICY IF EXISTS "empresas_policy_insert" ON public.empresas;
DROP POLICY IF EXISTS "empresas_policy_update" ON public.empresas;
DROP POLICY IF EXISTS "empresas_policy_delete" ON public.empresas;

DROP POLICY IF EXISTS "imoveis_policy_select" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_policy_insert" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_policy_update" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_policy_delete" ON public.imoveis;

DROP POLICY IF EXISTS "vistorias_policy_select" ON public.vistorias;
DROP POLICY IF EXISTS "vistorias_policy_insert" ON public.vistorias;
DROP POLICY IF EXISTS "vistorias_policy_update" ON public.vistorias;
DROP POLICY IF EXISTS "vistorias_policy_delete" ON public.vistorias;

DROP POLICY IF EXISTS "fotos_policy_select" ON public.fotos;
DROP POLICY IF EXISTS "fotos_policy_insert" ON public.fotos;
DROP POLICY IF EXISTS "fotos_policy_update" ON public.fotos;
DROP POLICY IF EXISTS "fotos_policy_delete" ON public.fotos;

DROP POLICY IF EXISTS "app_users_policy_select" ON public.app_users;
DROP POLICY IF EXISTS "app_users_policy_insert" ON public.app_users;
DROP POLICY IF EXISTS "app_users_policy_update" ON public.app_users;
DROP POLICY IF EXISTS "app_users_policy_delete" ON public.app_users;

DROP POLICY IF EXISTS "portal_users_policy_select" ON public.portal_users;
DROP POLICY IF EXISTS "portal_users_policy_insert" ON public.portal_users;
DROP POLICY IF EXISTS "portal_users_policy_update" ON public.portal_users;
DROP POLICY IF EXISTS "portal_users_policy_delete" ON public.portal_users;

-- Garantir que RLS está habilitado e forçado
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas FORCE ROW LEVEL SECURITY;

ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis FORCE ROW LEVEL SECURITY;

ALTER TABLE public.vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vistorias FORCE ROW LEVEL SECURITY;

ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos FORCE ROW LEVEL SECURITY;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users FORCE ROW LEVEL SECURITY;

ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_users FORCE ROW LEVEL SECURITY;

-- Remover todas as permissões das roles anon e authenticated
REVOKE ALL ON public.empresas FROM anon, authenticated;
REVOKE ALL ON public.imoveis FROM anon, authenticated;
REVOKE ALL ON public.vistorias FROM anon, authenticated;
REVOKE ALL ON public.fotos FROM anon, authenticated;
REVOKE ALL ON public.app_users FROM anon, authenticated;
REVOKE ALL ON public.portal_users FROM anon, authenticated;

-- Criar políticas que NEGAM explicitamente acesso anônimo
-- EMPRESAS
CREATE POLICY "deny_anon_empresas" ON public.empresas
    FOR ALL USING (auth.role() != 'anon');

-- IMOVEIS
CREATE POLICY "deny_anon_imoveis" ON public.imoveis
    FOR ALL USING (auth.role() != 'anon');

-- VISTORIAS
CREATE POLICY "deny_anon_vistorias" ON public.vistorias
    FOR ALL USING (auth.role() != 'anon');

-- FOTOS
CREATE POLICY "deny_anon_fotos" ON public.fotos
    FOR ALL USING (auth.role() != 'anon');

-- APP_USERS
CREATE POLICY "deny_anon_app_users" ON public.app_users
    FOR ALL USING (auth.role() != 'anon');

-- PORTAL_USERS
CREATE POLICY "deny_anon_portal_users" ON public.portal_users
    FOR ALL USING (auth.role() != 'anon');

-- Dar permissões apenas para authenticated e service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imoveis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vistorias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fotos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_users TO authenticated;

-- Service role tem acesso total (bypass RLS)
GRANT ALL ON public.empresas TO service_role;
GRANT ALL ON public.imoveis TO service_role;
GRANT ALL ON public.vistorias TO service_role;
GRANT ALL ON public.fotos TO service_role;
GRANT ALL ON public.app_users TO service_role;
GRANT ALL ON public.portal_users TO service_role;

-- Comentário
-- Políticas RLS configuradas para negar explicitamente acesso anônimo
-- Apenas usuários autenticados e service_role podem acessar os dados