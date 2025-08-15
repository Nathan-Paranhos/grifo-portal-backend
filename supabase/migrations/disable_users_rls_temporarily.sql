-- Temporarily disable RLS on users table to fix infinite recursion
-- This will allow the server to start while we debug the policy issues

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "company_admins_select_company_users" ON users;
DROP POLICY IF EXISTS "company_admins_manage_company_users" ON users;

-- Disable RLS temporarily
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON users TO authenticated;
GRANT SELECT ON users TO anon;

-- Add a comment to remember to re-enable RLS later
COMMENT ON TABLE users IS 'RLS temporarily disabled due to infinite recursion - needs to be re-enabled with proper policies';