-- Fix table permissions for inspection_requests, clients, and users tables
-- Grant necessary permissions to anon and authenticated roles

-- Check current permissions
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND grantee IN ('anon', 'authenticated') 
AND table_name IN ('inspection_requests', 'clients', 'users')
ORDER BY table_name, grantee;

-- Grant SELECT permissions to anon role for basic read access
GRANT SELECT ON inspection_requests TO anon;
GRANT SELECT ON clients TO anon;
GRANT SELECT ON users TO anon;

-- Grant full permissions to authenticated role
GRANT ALL PRIVILEGES ON inspection_requests TO authenticated;
GRANT ALL PRIVILEGES ON clients TO authenticated;
GRANT ALL PRIVILEGES ON users TO authenticated;

-- Verify permissions after granting
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND grantee IN ('anon', 'authenticated') 
AND table_name IN ('inspection_requests', 'clients', 'users')
ORDER BY table_name, grantee;