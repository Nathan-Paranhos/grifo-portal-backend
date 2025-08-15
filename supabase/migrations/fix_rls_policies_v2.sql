-- Fix RLS policies to prevent infinite recursion - Version 2
-- Drop ALL existing policies first, then create new ones

-- Drop all existing policies on all tables
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Drop policies on app_users
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'app_users' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON app_users';
    END LOOP;
    
    -- Drop policies on portal_users
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'portal_users' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON portal_users';
    END LOOP;
    
    -- Drop policies on vistorias
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'vistorias' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON vistorias';
    END LOOP;
    
    -- Drop policies on fotos
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'fotos' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON fotos';
    END LOOP;
END $$;

-- Create new RLS policies without recursion

-- App Users: Only authenticated users can access their own records
CREATE POLICY "app_users_select_policy" ON app_users
    FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "app_users_insert_policy" ON app_users
    FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "app_users_update_policy" ON app_users
    FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "app_users_delete_policy" ON app_users
    FOR DELETE
    USING (auth.uid() = auth_user_id);

-- Portal Users: Only authenticated users can access their own records
CREATE POLICY "portal_users_select_policy" ON portal_users
    FOR SELECT
    USING (auth.uid() = auth_user_id);

CREATE POLICY "portal_users_insert_policy" ON portal_users
    FOR INSERT
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "portal_users_update_policy" ON portal_users
    FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "portal_users_delete_policy" ON portal_users
    FOR DELETE
    USING (auth.uid() = auth_user_id);

-- Vistorias: Users can only access inspections from their company
CREATE POLICY "vistorias_select_policy" ON vistorias
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_users au 
            WHERE au.auth_user_id = auth.uid() 
            AND au.empresa_id = vistorias.empresa_id
        )
        OR
        EXISTS (
            SELECT 1 FROM portal_users pu 
            WHERE pu.auth_user_id = auth.uid() 
            AND pu.empresa_id = vistorias.empresa_id
        )
    );

CREATE POLICY "vistorias_insert_policy" ON vistorias
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_users au 
            WHERE au.auth_user_id = auth.uid() 
            AND au.empresa_id = vistorias.empresa_id
        )
        OR
        EXISTS (
            SELECT 1 FROM portal_users pu 
            WHERE pu.auth_user_id = auth.uid() 
            AND pu.empresa_id = vistorias.empresa_id
        )
    );

CREATE POLICY "vistorias_update_policy" ON vistorias
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_users au 
            WHERE au.auth_user_id = auth.uid() 
            AND au.empresa_id = vistorias.empresa_id
        )
        OR
        EXISTS (
            SELECT 1 FROM portal_users pu 
            WHERE pu.auth_user_id = auth.uid() 
            AND pu.empresa_id = vistorias.empresa_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_users au 
            WHERE au.auth_user_id = auth.uid() 
            AND au.empresa_id = vistorias.empresa_id
        )
        OR
        EXISTS (
            SELECT 1 FROM portal_users pu 
            WHERE pu.auth_user_id = auth.uid() 
            AND pu.empresa_id = vistorias.empresa_id
        )
    );

CREATE POLICY "vistorias_delete_policy" ON vistorias
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM app_users au 
            WHERE au.auth_user_id = auth.uid() 
            AND au.empresa_id = vistorias.empresa_id
        )
        OR
        EXISTS (
            SELECT 1 FROM portal_users pu 
            WHERE pu.auth_user_id = auth.uid() 
            AND pu.empresa_id = vistorias.empresa_id
        )
    );

-- Fotos: Users can only access photos from inspections of their company
CREATE POLICY "fotos_select_policy" ON fotos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vistorias v
            JOIN app_users au ON au.empresa_id = v.empresa_id
            WHERE v.id = fotos.vistoria_id 
            AND au.auth_user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM vistorias v
            JOIN portal_users pu ON pu.empresa_id = v.empresa_id
            WHERE v.id = fotos.vistoria_id 
            AND pu.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "fotos_insert_policy" ON fotos
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM vistorias v
            JOIN app_users au ON au.empresa_id = v.empresa_id
            WHERE v.id = fotos.vistoria_id 
            AND au.auth_user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM vistorias v
            JOIN portal_users pu ON pu.empresa_id = v.empresa_id
            WHERE v.id = fotos.vistoria_id 
            AND pu.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "fotos_update_policy" ON fotos
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM vistorias v
            JOIN app_users au ON au.empresa_id = v.empresa_id
            WHERE v.id = fotos.vistoria_id 
            AND au.auth_user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM vistorias v
            JOIN portal_users pu ON pu.empresa_id = v.empresa_id
            WHERE v.id = fotos.vistoria_id 
            AND pu.auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM vistorias v
            JOIN app_users au ON au.empresa_id = v.empresa_id
            WHERE v.id = fotos.vistoria_id 
            AND au.auth_user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM vistorias v
            JOIN portal_users pu ON pu.empresa_id = v.empresa_id
            WHERE v.id = fotos.vistoria_id 
            AND pu.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "fotos_delete_policy" ON fotos
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM vistorias v
            JOIN app_users au ON au.empresa_id = v.empresa_id
            WHERE v.id = fotos.vistoria_id 
            AND au.auth_user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM vistorias v
            JOIN portal_users pu ON pu.empresa_id = v.empresa_id
            WHERE v.id = fotos.vistoria_id 
            AND pu.auth_user_id = auth.uid()
        )
    );

-- Enable RLS on all tables
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON app_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON portal_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vistorias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fotos TO authenticated;

-- Grant basic read access to anon role for public data
GRANT SELECT ON empresas TO anon;
GRANT SELECT ON empresas TO authenticated;