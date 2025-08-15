-- Fix RLS policies to prevent infinite recursion
-- This migration fixes the recursive policies that are causing database errors

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view vistorias from their company" ON vistorias;
DROP POLICY IF EXISTS "Users can insert vistorias for their company" ON vistorias;
DROP POLICY IF EXISTS "Users can update vistorias from their company" ON vistorias;
DROP POLICY IF EXISTS "Users can delete vistorias from their company" ON vistorias;

DROP POLICY IF EXISTS "Users can view fotos from their company vistorias" ON fotos;
DROP POLICY IF EXISTS "Users can insert fotos for their company vistorias" ON fotos;
DROP POLICY IF EXISTS "Users can update fotos from their company vistorias" ON fotos;
DROP POLICY IF EXISTS "Users can delete fotos from their company vistorias" ON fotos;

DROP POLICY IF EXISTS "Users can view itens_vistoria from their company" ON itens_vistoria;
DROP POLICY IF EXISTS "Users can insert itens_vistoria for their company" ON itens_vistoria;
DROP POLICY IF EXISTS "Users can update itens_vistoria from their company" ON itens_vistoria;
DROP POLICY IF EXISTS "Users can delete itens_vistoria from their company" ON itens_vistoria;

DROP POLICY IF EXISTS "Users can view vistoria_assignments from their company" ON vistoria_assignments;
DROP POLICY IF EXISTS "Users can insert vistoria_assignments for their company" ON vistoria_assignments;
DROP POLICY IF EXISTS "Users can update vistoria_assignments from their company" ON vistoria_assignments;
DROP POLICY IF EXISTS "Users can delete vistoria_assignments from their company" ON vistoria_assignments;

-- Create simplified, non-recursive policies for vistorias table
CREATE POLICY "vistorias_select_policy" ON vistorias
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.empresa_id = vistorias.empresa_id
        )
    );

CREATE POLICY "vistorias_insert_policy" ON vistorias
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.empresa_id = vistorias.empresa_id
        )
    );

CREATE POLICY "vistorias_update_policy" ON vistorias
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.empresa_id = vistorias.empresa_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.empresa_id = vistorias.empresa_id
        )
    );

CREATE POLICY "vistorias_delete_policy" ON vistorias
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.empresa_id = vistorias.empresa_id
        )
    );

-- Create simplified, non-recursive policies for fotos table
CREATE POLICY "fotos_select_policy" ON fotos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE u.id = auth.uid() 
            AND v.id = fotos.vistoria_id
        )
    );

CREATE POLICY "fotos_insert_policy" ON fotos
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE u.id = auth.uid() 
            AND v.id = fotos.vistoria_id
        )
    );

CREATE POLICY "fotos_update_policy" ON fotos
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE u.id = auth.uid() 
            AND v.id = fotos.vistoria_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE u.id = auth.uid() 
            AND v.id = fotos.vistoria_id
        )
    );

CREATE POLICY "fotos_delete_policy" ON fotos
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE u.id = auth.uid() 
            AND v.id = fotos.vistoria_id
        )
    );

-- Create simplified, non-recursive policies for itens_vistoria table
CREATE POLICY "itens_vistoria_select_policy" ON itens_vistoria
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE u.id = auth.uid() 
            AND v.id = itens_vistoria.vistoria_id
        )
    );

CREATE POLICY "itens_vistoria_insert_policy" ON itens_vistoria
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE u.id = auth.uid() 
            AND v.id = itens_vistoria.vistoria_id
        )
    );

CREATE POLICY "itens_vistoria_update_policy" ON itens_vistoria
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE u.id = auth.uid() 
            AND v.id = itens_vistoria.vistoria_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE u.id = auth.uid() 
            AND v.id = itens_vistoria.vistoria_id
        )
    );

CREATE POLICY "itens_vistoria_delete_policy" ON itens_vistoria
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE u.id = auth.uid() 
            AND v.id = itens_vistoria.vistoria_id
        )
    );

-- Create simplified, non-recursive policies for vistoria_assignments table
CREATE POLICY "vistoria_assignments_select_policy" ON vistoria_assignments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND (u.id = vistoria_assignments.vistoriador_id OR u.empresa_id IN (
                SELECT v.empresa_id FROM vistorias v WHERE v.id = vistoria_assignments.vistoria_id
            ))
        )
    );

CREATE POLICY "vistoria_assignments_insert_policy" ON vistoria_assignments
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.empresa_id IN (
                SELECT v.empresa_id FROM vistorias v WHERE v.id = vistoria_assignments.vistoria_id
            )
        )
    );

CREATE POLICY "vistoria_assignments_update_policy" ON vistoria_assignments
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.empresa_id IN (
                SELECT v.empresa_id FROM vistorias v WHERE v.id = vistoria_assignments.vistoria_id
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.empresa_id IN (
                SELECT v.empresa_id FROM vistorias v WHERE v.id = vistoria_assignments.vistoria_id
            )
        )
    );

CREATE POLICY "vistoria_assignments_delete_policy" ON vistoria_assignments
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.empresa_id IN (
                SELECT v.empresa_id FROM vistorias v WHERE v.id = vistoria_assignments.vistoria_id
            )
        )
    );

-- Grant necessary permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON vistorias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fotos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON itens_vistoria TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vistoria_assignments TO authenticated;

-- Grant basic read access to anon role for public data
GRANT SELECT ON vistorias TO anon;
GRANT SELECT ON fotos TO anon;
GRANT SELECT ON itens_vistoria TO anon;
GRANT SELECT ON vistoria_assignments TO anon;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';