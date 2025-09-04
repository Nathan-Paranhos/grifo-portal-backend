-- Complete RLS policies fix - Remove all existing policies and create simple ones
-- This migration completely removes all problematic RLS policies and creates new simple ones

-- Disable RLS temporarily to clean up
ALTER TABLE vistorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE fotos DISABLE ROW LEVEL SECURITY;
ALTER TABLE itens_vistoria DISABLE ROW LEVEL SECURITY;
ALTER TABLE vistoria_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE empresas DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE imoveis DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on all tables
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on vistorias
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'vistorias' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON vistorias';
    END LOOP;
    
    -- Drop all policies on fotos
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'fotos' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON fotos';
    END LOOP;
    
    -- Drop all policies on itens_vistoria
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'itens_vistoria' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON itens_vistoria';
    END LOOP;
    
    -- Drop all policies on vistoria_assignments
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'vistoria_assignments' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON vistoria_assignments';
    END LOOP;
    
    -- Drop all policies on empresas
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'empresas' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON empresas';
    END LOOP;
    
    -- Drop all policies on users
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON users';
    END LOOP;
    
    -- Drop all policies on imoveis
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'imoveis' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON imoveis';
    END LOOP;
END $$;

-- Create simple, non-recursive policies for empresas
CREATE POLICY "empresas_all_access" ON empresas FOR ALL USING (true) WITH CHECK (true);

-- Create simple, non-recursive policies for users
CREATE POLICY "users_all_access" ON users FOR ALL USING (true) WITH CHECK (true);

-- Create simple, non-recursive policies for imoveis
CREATE POLICY "imoveis_all_access" ON imoveis FOR ALL USING (true) WITH CHECK (true);

-- Create simple, non-recursive policies for vistorias
CREATE POLICY "vistorias_all_access" ON vistorias FOR ALL USING (true) WITH CHECK (true);

-- Create simple, non-recursive policies for fotos
CREATE POLICY "fotos_all_access" ON fotos FOR ALL USING (true) WITH CHECK (true);

-- Create simple, non-recursive policies for itens_vistoria
CREATE POLICY "itens_vistoria_all_access" ON itens_vistoria FOR ALL USING (true) WITH CHECK (true);

-- Create simple, non-recursive policies for vistoria_assignments
CREATE POLICY "vistoria_assignments_all_access" ON vistoria_assignments FOR ALL USING (true) WITH CHECK (true);

-- Re-enable RLS
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_vistoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistoria_assignments ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to anon and authenticated roles
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';