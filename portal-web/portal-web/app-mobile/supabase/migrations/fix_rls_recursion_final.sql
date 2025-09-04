-- Migração para corrigir recursão infinita nas políticas RLS
-- Data: 2025-01-10
-- Objetivo: Implementar políticas RLS simples e eficientes sem recursão

-- Desabilitar RLS temporariamente para limpeza
ALTER TABLE vistorias DISABLE ROW LEVEL SECURITY;
ALTER TABLE fotos DISABLE ROW LEVEL SECURITY;
ALTER TABLE itens_vistoria DISABLE ROW LEVEL SECURITY;
ALTER TABLE vistoria_assignments DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes que podem causar recursão
DROP POLICY IF EXISTS "vistorias_select_policy" ON vistorias;
DROP POLICY IF EXISTS "vistorias_insert_policy" ON vistorias;
DROP POLICY IF EXISTS "vistorias_update_policy" ON vistorias;
DROP POLICY IF EXISTS "vistorias_delete_policy" ON vistorias;
DROP POLICY IF EXISTS "fotos_select_policy" ON fotos;
DROP POLICY IF EXISTS "fotos_insert_policy" ON fotos;
DROP POLICY IF EXISTS "fotos_update_policy" ON fotos;
DROP POLICY IF EXISTS "fotos_delete_policy" ON fotos;
DROP POLICY IF EXISTS "itens_vistoria_select_policy" ON itens_vistoria;
DROP POLICY IF EXISTS "itens_vistoria_insert_policy" ON itens_vistoria;
DROP POLICY IF EXISTS "itens_vistoria_update_policy" ON itens_vistoria;
DROP POLICY IF EXISTS "itens_vistoria_delete_policy" ON itens_vistoria;
DROP POLICY IF EXISTS "vistoria_assignments_select_policy" ON vistoria_assignments;
DROP POLICY IF EXISTS "vistoria_assignments_insert_policy" ON vistoria_assignments;
DROP POLICY IF EXISTS "vistoria_assignments_update_policy" ON vistoria_assignments;
DROP POLICY IF EXISTS "vistoria_assignments_delete_policy" ON vistoria_assignments;

-- Criar políticas simples e diretas para VISTORIAS
CREATE POLICY "vistorias_public_read" ON vistorias
    FOR SELECT USING (true);

CREATE POLICY "vistorias_authenticated_write" ON vistorias
    FOR ALL USING (auth.role() = 'authenticated');

-- Criar políticas simples para FOTOS
CREATE POLICY "fotos_public_read" ON fotos
    FOR SELECT USING (true);

CREATE POLICY "fotos_authenticated_write" ON fotos
    FOR ALL USING (auth.role() = 'authenticated');

-- Criar políticas simples para ITENS_VISTORIA
CREATE POLICY "itens_vistoria_public_read" ON itens_vistoria
    FOR SELECT USING (true);

CREATE POLICY "itens_vistoria_authenticated_write" ON itens_vistoria
    FOR ALL USING (auth.role() = 'authenticated');

-- Criar políticas simples para VISTORIA_ASSIGNMENTS
CREATE POLICY "vistoria_assignments_public_read" ON vistoria_assignments
    FOR SELECT USING (true);

CREATE POLICY "vistoria_assignments_authenticated_write" ON vistoria_assignments
    FOR ALL USING (auth.role() = 'authenticated');

-- Reabilitar RLS com as novas políticas
ALTER TABLE vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_vistoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistoria_assignments ENABLE ROW LEVEL SECURITY;

-- Garantir permissões para roles anon e authenticated
GRANT SELECT ON vistorias TO anon;
GRANT ALL PRIVILEGES ON vistorias TO authenticated;
GRANT SELECT ON fotos TO anon;
GRANT ALL PRIVILEGES ON fotos TO authenticated;
GRANT SELECT ON itens_vistoria TO anon;
GRANT ALL PRIVILEGES ON itens_vistoria TO authenticated;
GRANT SELECT ON vistoria_assignments TO anon;
GRANT ALL PRIVILEGES ON vistoria_assignments TO authenticated;

-- Comentário final
-- Esta migração resolve a recursão infinita implementando políticas RLS simples
-- sem inserir dados duplicados