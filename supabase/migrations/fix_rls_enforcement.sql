-- Verificar e corrigir enforcement das políticas RLS

-- Primeiro, vamos verificar se RLS está realmente habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    relforcerowsecurity as rls_forced
FROM pg_tables pt
JOIN pg_class pc ON pc.relname = pt.tablename
WHERE schemaname = 'public' 
    AND tablename IN ('empresas', 'imoveis', 'vistorias', 'fotos', 'app_users', 'portal_users');

-- Forçar RLS para todas as tabelas críticas
ALTER TABLE public.empresas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vistorias FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fotos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.app_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portal_users FORCE ROW LEVEL SECURITY;

-- Remover permissões excessivas das roles anon
REVOKE ALL ON public.empresas FROM anon;
REVOKE ALL ON public.imoveis FROM anon;
REVOKE ALL ON public.vistorias FROM anon;
REVOKE ALL ON public.fotos FROM anon;
REVOKE ALL ON public.app_users FROM anon;
REVOKE ALL ON public.portal_users FROM anon;

-- Dar apenas permissões mínimas necessárias
-- anon pode apenas SELECT (mas será filtrado pelas políticas RLS)
GRANT SELECT ON public.empresas TO anon;
GRANT SELECT ON public.imoveis TO anon;
GRANT SELECT ON public.vistorias TO anon;
GRANT SELECT ON public.fotos TO anon;
GRANT SELECT ON public.app_users TO anon;
GRANT SELECT ON public.portal_users TO anon;

-- authenticated pode fazer operações CRUD (mas será filtrado pelas políticas RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imoveis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vistorias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fotos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_users TO authenticated;

-- Recriar políticas mais restritivas
-- Remover políticas existentes
DROP POLICY IF EXISTS "empresas_policy_select" ON public.empresas;
DROP POLICY IF EXISTS "imoveis_policy_select" ON public.imoveis;
DROP POLICY IF EXISTS "vistorias_policy_select" ON public.vistorias;
DROP POLICY IF EXISTS "fotos_policy_select" ON public.fotos;
DROP POLICY IF EXISTS "app_users_policy_select" ON public.app_users;
DROP POLICY IF EXISTS "portal_users_policy_select" ON public.portal_users;

-- Políticas mais restritivas - NEGAR acesso anônimo por padrão
CREATE POLICY "empresas_policy_select" ON public.empresas
    FOR SELECT USING (
        -- Apenas SERVICE_ROLE ou usuários autenticados com empresa_id no JWT
        auth.role() = 'service_role' OR 
        (
            auth.role() = 'authenticated' AND (
                id = (auth.jwt() ->> 'empresa_id')::uuid OR
                id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
            )
        )
    );

CREATE POLICY "imoveis_policy_select" ON public.imoveis
    FOR SELECT USING (
        -- Apenas SERVICE_ROLE ou usuários autenticados da mesma empresa
        auth.role() = 'service_role' OR 
        (
            auth.role() = 'authenticated' AND (
                empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
                empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
            )
        )
    );

CREATE POLICY "vistorias_policy_select" ON public.vistorias
    FOR SELECT USING (
        -- Apenas SERVICE_ROLE ou usuários autenticados da mesma empresa
        auth.role() = 'service_role' OR 
        (
            auth.role() = 'authenticated' AND (
                empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
                empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
            )
        )
    );

CREATE POLICY "fotos_policy_select" ON public.fotos
    FOR SELECT USING (
        -- Apenas SERVICE_ROLE ou usuários autenticados com acesso à vistoria
        auth.role() = 'service_role' OR 
        (
            auth.role() = 'authenticated' AND 
            EXISTS (
                SELECT 1 FROM public.vistorias v 
                WHERE v.id = fotos.vistoria_id 
                AND (
                    v.empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
                    v.empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
                )
            )
        )
    );

CREATE POLICY "app_users_policy_select" ON public.app_users
    FOR SELECT USING (
        -- Apenas SERVICE_ROLE, próprio usuário ou usuários da mesma empresa
        auth.role() = 'service_role' OR 
        (
            auth.role() = 'authenticated' AND (
                auth_user_id = auth.uid() OR
                empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
                empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
            )
        )
    );

CREATE POLICY "portal_users_policy_select" ON public.portal_users
    FOR SELECT USING (
        -- Apenas SERVICE_ROLE, próprio usuário ou usuários da mesma empresa
        auth.role() = 'service_role' OR 
        (
            auth.role() = 'authenticated' AND (
                auth_user_id = auth.uid() OR
                empresa_id = (auth.jwt() ->> 'empresa_id')::uuid OR
                empresa_id = (auth.jwt() -> 'app_metadata' ->> 'empresa_id')::uuid
            )
        )
    );

-- Verificar se as políticas foram aplicadas
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('empresas', 'imoveis', 'vistorias', 'fotos', 'app_users', 'portal_users') 
ORDER BY tablename, policyname;

-- Comentário final
-- RLS agora está FORÇADO e políticas são mais restritivas
-- Acesso anônimo deve ser negado por padrão