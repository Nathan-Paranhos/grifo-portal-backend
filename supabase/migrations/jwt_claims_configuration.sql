-- Configuração de JWT Claims personalizados para separação de contextos
-- Esta migração adiciona claims customizados usando apenas o schema public

-- 1. Criar função para obter claims customizados do usuário
CREATE OR REPLACE FUNCTION get_user_claims(user_id UUID)
RETURNS JSONB AS $$
DECLARE
    user_claims JSONB := '{}'::JSONB;
    app_user_data RECORD;
    portal_user_data RECORD;
BEGIN
    -- Verificar se é um usuário do app mobile
    SELECT au.id, au.empresa_id, au.role, au.ativo
    INTO app_user_data
    FROM app_users au
    WHERE au.auth_user_id = user_id;
    
    IF FOUND THEN
        user_claims := jsonb_build_object(
            'user_type', 'app_user',
            'user_id', app_user_data.id,
            'empresa_id', app_user_data.empresa_id,
            'role', app_user_data.role,
            'ativo', app_user_data.ativo,
            'context', 'mobile_app'
        );
        RETURN user_claims;
    END IF;
    
    -- Verificar se é um usuário do portal web
    SELECT pu.id, pu.empresa_id, pu.role, pu.ativo, pu.can_create_vistorias, 
           pu.can_edit_vistorias, pu.can_view_all_company_data, pu.permissions
    INTO portal_user_data
    FROM portal_users pu
    WHERE pu.auth_user_id = user_id;
    
    IF FOUND THEN
        user_claims := jsonb_build_object(
            'user_type', 'portal_user',
            'user_id', portal_user_data.id,
            'empresa_id', portal_user_data.empresa_id,
            'role', portal_user_data.role,
            'ativo', portal_user_data.ativo,
            'can_create_vistorias', portal_user_data.can_create_vistorias,
            'can_edit_vistorias', portal_user_data.can_edit_vistorias,
            'can_view_all_company_data', portal_user_data.can_view_all_company_data,
            'permissions', portal_user_data.permissions,
            'context', 'web_portal'
        );
        RETURN user_claims;
    END IF;
    
    -- Se não encontrou em nenhuma tabela, retorna claims básicos
    user_claims := jsonb_build_object(
        'user_type', 'unknown',
        'context', 'undefined'
    );
    
    RETURN user_claims;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função para obter claims do usuário atual
CREATE OR REPLACE FUNCTION get_current_user_claims()
RETURNS JSONB AS $$
BEGIN
    RETURN get_user_claims(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função para verificar se o usuário atual é do tipo especificado
CREATE OR REPLACE FUNCTION is_user_type(expected_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_claims JSONB;
BEGIN
    user_claims := get_current_user_claims();
    RETURN (user_claims->>'user_type') = expected_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função para verificar permissões específicas do portal
CREATE OR REPLACE FUNCTION has_portal_permission(permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_claims JSONB;
BEGIN
    user_claims := get_current_user_claims();
    
    -- Verificar se é usuário do portal
    IF (user_claims->>'user_type') != 'portal_user' THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar permissão específica
    CASE permission_name
        WHEN 'create_vistorias' THEN
            RETURN (user_claims->>'can_create_vistorias')::BOOLEAN;
        WHEN 'edit_vistorias' THEN
            RETURN (user_claims->>'can_edit_vistorias')::BOOLEAN;
        WHEN 'view_all_company_data' THEN
            RETURN (user_claims->>'can_view_all_company_data')::BOOLEAN;
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Função para obter empresa do usuário atual
CREATE OR REPLACE FUNCTION get_current_user_empresa_id()
RETURNS UUID AS $$
DECLARE
    user_claims JSONB;
BEGIN
    user_claims := get_current_user_claims();
    RETURN (user_claims->>'empresa_id')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para verificar se usuário está ativo
CREATE OR REPLACE FUNCTION is_current_user_active()
RETURNS BOOLEAN AS $$
DECLARE
    user_claims JSONB;
BEGIN
    user_claims := get_current_user_claims();
    RETURN COALESCE((user_claims->>'ativo')::BOOLEAN, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Função para obter role do usuário atual
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    user_claims JSONB;
BEGIN
    user_claims := get_current_user_claims();
    RETURN user_claims->>'role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Tabela para armazenar configurações de JWT claims (para uso futuro)
CREATE TABLE IF NOT EXISTS jwt_claims_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_type TEXT NOT NULL CHECK (user_type IN ('app_user', 'portal_user')),
    claim_name TEXT NOT NULL,
    claim_value JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela de configuração
ALTER TABLE jwt_claims_config ENABLE ROW LEVEL SECURITY;

-- Política para administradores gerenciarem configurações
CREATE POLICY "Apenas admins podem gerenciar JWT claims config" ON jwt_claims_config
    FOR ALL USING (
        get_current_user_role() = 'admin' AND 
        is_current_user_active()
    );

-- 9. Trigger para updated_at na tabela de configuração
CREATE TRIGGER jwt_claims_config_updated_at
    BEFORE UPDATE ON jwt_claims_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 10. Conceder permissões necessárias
GRANT EXECUTE ON FUNCTION get_user_claims(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_claims() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_user_type(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION has_portal_permission(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_empresa_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_active() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_role() TO anon, authenticated;

-- Conceder permissões na tabela de configuração
GRANT SELECT, INSERT, UPDATE, DELETE ON jwt_claims_config TO authenticated;

-- 11. Inserir log da migração
INSERT INTO migration_log (name, description) 
VALUES ('jwt_claims_configuration', 'Configuração de funções para JWT claims personalizados - separação app_user vs portal_user');

-- Comentários sobre uso:
-- 
-- No frontend, você pode usar as funções para obter informações do usuário:
-- 
-- // Obter todos os claims do usuário atual
-- const { data } = await supabase.rpc('get_current_user_claims')
-- 
-- // Verificar tipo de usuário
-- const { data: isAppUser } = await supabase.rpc('is_user_type', { expected_type: 'app_user' })
-- 
-- // Verificar permissões do portal
-- const { data: canCreate } = await supabase.rpc('has_portal_permission', { permission_name: 'create_vistorias' })
-- 
-- // Obter empresa do usuário
-- const { data: empresaId } = await supabase.rpc('get_current_user_empresa_id')
-- 
-- // Verificar se usuário está ativo
-- const { data: isActive } = await supabase.rpc('is_current_user_active')
-- 
-- // Obter role do usuário
-- const { data: userRole } = await supabase.rpc('get_current_user_role')
-- 
-- Essas funções podem ser usadas em políticas RLS e no código da aplicação
-- para implementar controle de acesso baseado no tipo de usuário.