-- Fix RLS policies for inspection_requests and clients tables
-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('inspection_requests', 'clients')
ORDER BY tablename, policyname;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "anon_select_inspection_requests" ON inspection_requests;
DROP POLICY IF EXISTS "authenticated_all_inspection_requests" ON inspection_requests;
DROP POLICY IF EXISTS "anon_select_clients" ON clients;
DROP POLICY IF EXISTS "authenticated_all_clients" ON clients;

-- Create permissive policies for inspection_requests
CREATE POLICY "anon_select_inspection_requests" ON inspection_requests
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "authenticated_all_inspection_requests" ON inspection_requests
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create permissive policies for clients
CREATE POLICY "anon_select_clients" ON clients
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "authenticated_all_clients" ON clients
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Verify policies after creation
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('inspection_requests', 'clients')
ORDER BY tablename, policyname;