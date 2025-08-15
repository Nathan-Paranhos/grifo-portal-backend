-- Verificar políticas RLS existentes
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual 
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('empresas', 'imoveis', 'vistorias', 'fotos', 'app_users', 'portal_users') 
ORDER BY tablename, policyname;

-- Verificar se RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('empresas', 'imoveis', 'vistorias', 'fotos', 'app_users', 'portal_users')
ORDER BY tablename;

-- Verificar permissões das roles
SELECT 
    grantee, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND grantee IN ('anon', 'authenticated') 
    AND table_name IN ('empresas', 'imoveis', 'vistorias', 'fotos', 'app_users', 'portal_users')
ORDER BY table_name, grantee;