-- Migração para separação de contextos de usuários
-- App Mobile: vistoriadores
-- Portal Web: gestores de empresa

-- 1. Criar tabela para usuários do app mobile (vistoriadores)
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    empresa_id UUID REFERENCES empresas(id),
    role TEXT DEFAULT 'vistoriador',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar tabela para usuários do portal web (gestores)
CREATE TABLE IF NOT EXISTS portal_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    empresa_id UUID REFERENCES empresas(id),
    role TEXT DEFAULT 'gestor' CHECK (role IN ('gestor', 'admin', 'supervisor')),
    can_create_vistorias BOOLEAN DEFAULT true,
    can_edit_vistorias BOOLEAN DEFAULT true,
    can_view_all_company_data BOOLEAN DEFAULT true,
    can_manage_users BOOLEAN DEFAULT false,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Migrar dados existentes da tabela users
-- Usuários com user_type 'vistoriador_app' vão para app_users
INSERT INTO app_users (id, email, nome, empresa_id, role, created_at, updated_at)
SELECT 
    id, 
    email, 
    nome, 
    COALESCE(company_id, empresa_id) as empresa_id,
    'vistoriador',
    created_at, 
    updated_at
FROM users 
WHERE user_type = 'vistoriador_app'
ON CONFLICT (id) DO NOTHING;

-- Usuários com user_type 'empresa_admin' ou 'empresa_user' vão para portal_users
INSERT INTO portal_users (id, email, nome, empresa_id, role, can_create_vistorias, can_edit_vistorias, can_view_all_company_data, can_manage_users, created_at, updated_at)
SELECT 
    id, 
    email, 
    nome, 
    COALESCE(company_id, empresa_id) as empresa_id,
    CASE 
        WHEN user_type = 'empresa_admin' THEN 'admin'
        ELSE 'gestor'
    END as role,
    COALESCE(can_create_vistorias, true),
    COALESCE(can_edit_vistorias, true),
    COALESCE(can_view_all_company_data, true),
    CASE WHEN user_type = 'empresa_admin' THEN true ELSE false END,
    created_at, 
    updated_at
FROM users 
WHERE user_type IN ('empresa_admin', 'empresa_user')
ON CONFLICT (id) DO NOTHING;

-- 4. Atualizar referências nas tabelas relacionadas
-- Manter as referências existentes funcionando
-- A tabela vistorias já referencia users(id) que agora será app_users(id)

-- 5. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Criar triggers para updated_at
CREATE TRIGGER update_app_users_updated_at 
    BEFORE UPDATE ON app_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portal_users_updated_at 
    BEFORE UPDATE ON portal_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Habilitar RLS nas novas tabelas
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;

-- 8. Criar políticas RLS para app_users (vistoriadores)
-- Vistoriadores só podem ver/editar seus próprios dados
CREATE POLICY "app_users_select_own" ON app_users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "app_users_update_own" ON app_users
    FOR UPDATE USING (auth.uid() = id);

-- Permitir inserção para novos usuários autenticados
CREATE POLICY "app_users_insert_own" ON app_users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 9. Criar políticas RLS para portal_users (gestores)
-- Gestores podem ver outros usuários da mesma empresa
CREATE POLICY "portal_users_select_company" ON portal_users
    FOR SELECT USING (
        auth.uid() = id OR 
        empresa_id IN (
            SELECT empresa_id FROM portal_users WHERE id = auth.uid()
        )
    );

-- Gestores podem atualizar seus próprios dados
CREATE POLICY "portal_users_update_own" ON portal_users
    FOR UPDATE USING (auth.uid() = id);

-- Admins podem gerenciar usuários da mesma empresa
CREATE POLICY "portal_users_admin_manage" ON portal_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM portal_users 
            WHERE id = auth.uid() 
            AND can_manage_users = true 
            AND empresa_id = portal_users.empresa_id
        )
    );

-- Permitir inserção para novos usuários autenticados
CREATE POLICY "portal_users_insert_own" ON portal_users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 10. Atualizar políticas das tabelas compartilhadas
-- Vistorias: vistoriadores (app) e gestores (portal) da mesma empresa
DROP POLICY IF EXISTS "vistorias_select" ON vistorias;
CREATE POLICY "vistorias_select" ON vistorias
    FOR SELECT USING (
        -- Vistoriador pode ver suas próprias vistorias
        vistoriador_id = auth.uid() OR
        -- Gestores podem ver vistorias da empresa
        empresa_id IN (
            SELECT empresa_id FROM portal_users WHERE id = auth.uid()
        ) OR
        -- App users podem ver vistorias da empresa
        empresa_id IN (
            SELECT empresa_id FROM app_users WHERE id = auth.uid()
        )
    );

-- Contestações: similar às vistorias
DROP POLICY IF EXISTS "contestacoes_select" ON contestacoes;
CREATE POLICY "contestacoes_select" ON contestacoes
    FOR SELECT USING (
        -- Usuário que criou a contestação
        usuario_id = auth.uid() OR
        -- Gestores da empresa
        empresa_id IN (
            SELECT empresa_id FROM portal_users WHERE id = auth.uid()
        ) OR
        -- App users da empresa
        empresa_id IN (
            SELECT empresa_id FROM app_users WHERE id = auth.uid()
        )
    );

-- 11. Criar função para identificar tipo de usuário
CREATE OR REPLACE FUNCTION get_user_type(user_id UUID)
RETURNS TEXT AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM app_users WHERE id = user_id) THEN
        RETURN 'app_user';
    ELSIF EXISTS (SELECT 1 FROM portal_users WHERE id = user_id) THEN
        RETURN 'portal_user';
    ELSE
        RETURN 'unknown';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Criar view unificada para compatibilidade (opcional)
CREATE OR REPLACE VIEW unified_users AS
SELECT 
    id,
    email,
    nome,
    empresa_id,
    role,
    'app_user' as user_type,
    ativo,
    created_at,
    updated_at
FROM app_users
UNION ALL
SELECT 
    id,
    email,
    nome,
    empresa_id,
    role,
    'portal_user' as user_type,
    ativo,
    created_at,
    updated_at
FROM portal_users;

-- 13. Conceder permissões básicas
GRANT SELECT ON app_users TO anon, authenticated;
GRANT INSERT, UPDATE ON app_users TO authenticated;

GRANT SELECT ON portal_users TO anon, authenticated;
GRANT INSERT, UPDATE ON portal_users TO authenticated;

GRANT SELECT ON unified_users TO anon, authenticated;

-- 14. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_app_users_empresa_id ON app_users(empresa_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

CREATE INDEX IF NOT EXISTS idx_portal_users_empresa_id ON portal_users(empresa_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email);

-- 15. Comentários para documentação
COMMENT ON TABLE app_users IS 'Usuários do aplicativo mobile (vistoriadores)';
COMMENT ON TABLE portal_users IS 'Usuários do portal web (gestores de empresa)';
COMMENT ON FUNCTION get_user_type(UUID) IS 'Identifica se o usuário é do app mobile ou portal web';
COMMENT ON VIEW unified_users IS 'View unificada para compatibilidade com código existente';

-- Log da migração
INSERT INTO migration_log (name, description) 
VALUES (
    'separate_user_contexts', 
    'Separação de contextos: app_users para mobile e portal_users para web'
);