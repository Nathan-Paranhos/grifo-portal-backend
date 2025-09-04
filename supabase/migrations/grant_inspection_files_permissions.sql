-- Conceder permissões para a tabela inspection_files
GRANT SELECT, INSERT, UPDATE, DELETE ON inspection_files TO authenticated;
GRANT SELECT ON inspection_files TO anon;

-- Verificar as permissões concedidas
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'inspection_files' 
  AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;