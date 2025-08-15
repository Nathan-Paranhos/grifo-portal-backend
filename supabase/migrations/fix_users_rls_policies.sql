-- Fix infinite recursion in users table RLS policies
-- Drop existing policies that might be causing recursion
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Company admins can view company users" ON users;
DROP POLICY IF EXISTS "Company admins can manage company users" ON users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON users;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON users;

-- Create simple, non-recursive policies
-- Policy for users to view their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy for users to update their own profile
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy for company admins to view users in their company
CREATE POLICY "company_admins_select_company_users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      JOIN users u ON au.id = u.id
      WHERE au.id = auth.uid()
      AND u.user_type = 'empresa_admin'
      AND u.company_id = users.company_id
    )
  );

-- Policy for company admins to manage users in their company
CREATE POLICY "company_admins_manage_company_users" ON users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      JOIN users u ON au.id = u.id
      WHERE au.id = auth.uid()
      AND u.user_type = 'empresa_admin'
      AND u.company_id = users.company_id
    )
  );

-- Grant permissions to roles
GRANT SELECT ON users TO authenticated;
GRANT INSERT ON users TO authenticated;
GRANT UPDATE ON users TO authenticated;
GRANT DELETE ON users TO authenticated;

-- Grant basic read access to anon for public operations
GRANT SELECT ON users TO anon;