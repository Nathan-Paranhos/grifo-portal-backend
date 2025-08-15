-- Migração para separação completa dos contextos de usuários
-- App Mobile (vistoriadores) vs Portal Web (gestores)

-- 1. Criar tabela para usuários do app mobile
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    empresa_id UUID REFERENCES empresas(id),
    role TEXT DEFAULT 'vistoriador',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar tabela para usuários do portal web
CREATE TABLE IF NOT EXISTS portal_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    empresa_id UUID REFERENCES empresas(id),
    role TEXT DEFAULT 'gestor',
    permissions JSONB DEFAULT '{}',
    can_create_vistorias BOOLEAN DEFAULT true,
    can_edit_vistorias BOOLEAN DEFAULT true,
    can_view_all_company_data BOOLEAN DEFAULT true,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Migrar dados existentes da tabela users
-- Usuários com user_type 'vistoriador_app' vão para app_users
INSERT INTO app_users (auth_user_id, email, nome, empresa_id, role, created_at, updated_at)
SELECT id, email, nome, COALESCE(company_id, empresa_id), role, created_at, updated_at
FROM users 
WHERE user_type = 'vistoriador_app' OR role = 'vistoriador'
ON CONFLICT (email) DO NOTHING;

-- Usuários com user_type 'empresa_admin' ou 'empresa_user' vão para portal_users
INSERT INTO portal_users (auth_user_id, email, nome, empresa_id, role, can_create_vistorias, can_edit_vistorias, can_view_all_company_data, created_at, updated_at)
SELECT id, email, nome, COALESCE(company_id, empresa_id), 
       CASE WHEN user_type = 'empresa_admin' THEN 'admin' ELSE 'gestor' END,
       can_create_vistorias, can_edit_vistorias, can_view_all_company_data,
       created_at, updated_at
FROM users 
WHERE user_type IN ('empresa_admin', 'empresa_user') OR role IN ('admin', 'gestor')
ON CONFLICT (email) DO NOTHING;

-- 4. Atualizar referências nas tabelas relacionadas
-- Atualizar vistorias para referenciar app_users
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS app_vistoriador_id UUID REFERENCES app_users(id);
UPDATE vistorias SET app_vistoriador_id = (
    SELECT au.id FROM app_users au WHERE au.auth_user_id = vistorias.vistoriador_id
) WHERE vistoriador_id IS NOT NULL;

-- Atualizar vistoria_assignments para referenciar app_users
ALTER TABLE vistoria_assignments ADD COLUMN IF NOT EXISTS app_vistoriador_id UUID REFERENCES app_users(id);
UPDATE vistoria_assignments SET app_vistoriador_id = (
    SELECT au.id FROM app_users au WHERE au.auth_user_id = vistoria_assignments.vistoriador_id
) WHERE vistoriador_id IS NOT NULL;

-- Atualizar contestações para referenciar portal_users
ALTER TABLE contestacoes ADD COLUMN IF NOT EXISTS portal_usuario_id UUID REFERENCES portal_users(id);
UPDATE contestacoes SET portal_usuario_id = (
    SELECT pu.id FROM portal_users pu WHERE pu.auth_user_id = contestacoes.usuario_id
) WHERE usuario_id IS NOT NULL;

-- 5. Criar funções para triggers de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Criar triggers para updated_at
CREATE TRIGGER update_app_users_updated_at BEFORE UPDATE ON app_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portal_users_updated_at BEFORE UPDATE ON portal_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Habilitar RLS nas novas tabelas
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;

-- 8. Criar políticas RLS para app_users
-- Política para usuários autenticados do app mobile
CREATE POLICY "app_users_select_own" ON app_users
    FOR SELECT USING (
        auth.uid() = auth_user_id OR
        EXISTS (
            SELECT 1 FROM app_users au 
            WHERE au.auth_user_id = auth.uid() 
            AND au.empresa_id = app_users.empresa_id
        )
    );

CREATE POLICY "app_users_update_own" ON app_users
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- 9. Criar políticas RLS para portal_users
-- Política para usuários autenticados do portal web
CREATE POLICY "portal_users_select_company" ON portal_users
    FOR SELECT USING (
        auth.uid() = auth_user_id OR
        EXISTS (
            SELECT 1 FROM portal_users pu 
            WHERE pu.auth_user_id = auth.uid() 
            AND pu.empresa_id = portal_users.empresa_id
            AND pu.can_view_all_company_data = true
        )
    );

CREATE POLICY "portal_users_update_own" ON portal_users
    FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "portal_users_insert_admin" ON portal_users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM portal_users pu 
            WHERE pu.auth_user_id = auth.uid() 
            AND pu.role = 'admin'
        )
    );

-- 10. Atualizar políticas das tabelas compartilhadas
-- Política para vistorias (acesso por app_users e portal_users)
DROP POLICY IF EXISTS "vistorias_select_policy" ON vistorias;
CREATE POLICY "vistorias_select_policy" ON vistorias
    FOR SELECT USING (
        -- App users podem ver suas próprias vistorias
        EXISTS (
            SELECT 1 FROM app_users au 
            WHERE au.auth_user_id = auth.uid() 
            AND (au.id = vistorias.app_vistoriador_id OR au.empresa_id = vistorias.empresa_id)
        ) OR
        -- Portal users podem ver vistorias da empresa
        EXISTS (
            SELECT 1 FROM portal_users pu 
            WHERE pu.auth_user_id = auth.uid() 
            AND pu.empresa_id = vistorias.empresa_id
        )
    );

DROP POLICY IF EXISTS "vistorias_insert_policy" ON vistorias;
CREATE POLICY "vistorias_insert_policy" ON vistorias
    FOR INSERT WITH CHECK (
        -- Apenas portal users podem criar vistorias
        EXISTS (
            SELECT 1 FROM portal_users pu 
            WHERE pu.auth_user_id = auth.uid() 
            AND pu.empresa_id = vistorias.empresa_id
            AND pu.can_create_vistorias = true
        )
    );

DROP POLICY IF EXISTS "vistorias_update_policy" ON vistorias;
CREATE POLICY "vistorias_update_policy" ON vistorias
    FOR UPDATE USING (
        -- App users podem atualizar suas vistorias
        EXISTS (
            SELECT 1 FROM app_users au 
            WHERE au.auth_user_id = auth.uid() 
            AND au.id = vistorias.app_vistoriador_id
        ) OR
        -- Portal users podem atualizar vistorias da empresa
        EXISTS (
            SELECT 1 FROM portal_users pu 
            WHERE pu.auth_user_id = auth.uid() 
            AND pu.empresa_id = vistorias.empresa_id
            AND pu.can_edit_vistorias = true
        )
    );

-- 11. Política para contestações
DROP POLICY IF EXISTS "contestacoes_select_policy" ON contestacoes;
CREATE POLICY "contestacoes_select_policy" ON contestacoes
    FOR SELECT USING (
        -- Portal users podem ver contestações da empresa
        EXISTS (
            SELECT 1 FROM portal_users pu 
            WHERE pu.auth_user_id = auth.uid() 
            AND pu.empresa_id = contestacoes.empresa_id
        ) OR
        -- App users podem ver contestações relacionadas às suas vistorias
        EXISTS (
            SELECT 1 FROM app_users au 
            JOIN vistorias v ON v.app_vistoriador_id = au.id
            WHERE au.auth_user_id = auth.uid() 
            AND v.id = contestacoes.vistoria_id
        )
    );

-- 12. Criar função para identificar tipo de usuário
CREATE OR REPLACE FUNCTION get_user_type(user_id UUID)
RETURNS TEXT AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM app_users WHERE auth_user_id = user_id) THEN
        RETURN 'app_user';
    ELSIF EXISTS (SELECT 1 FROM portal_users WHERE auth_user_id = user_id) THEN
        RETURN 'portal_user';
    ELSE
        RETURN 'unknown';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Criar view unificada para compatibilidade (opcional)
CREATE OR REPLACE VIEW unified_users AS
SELECT 
    au.id,
    au.auth_user_id,
    au.email,
    au.nome,
    au.empresa_id,
    au.role,
    'app_user' as user_type,
    au.ativo,
    au.created_at,
    au.updated_at
FROM app_users au
UNION ALL
SELECT 
    pu.id,
    pu.auth_user_id,
    pu.email,
    pu.nome,
    pu.empresa_id,
    pu.role,
    'portal_user' as user_type,
    pu.ativo,
    pu.created_at,
    pu.updated_at
FROM portal_users pu;

-- 14. Conceder permissões
GRANT SELECT, INSERT, UPDATE ON app_users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON portal_users TO anon, authenticated;
GRANT SELECT ON unified_users TO anon, authenticated;

-- 15. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON app_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_app_users_empresa_id ON app_users(empresa_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

CREATE INDEX IF NOT EXISTS idx_portal_users_auth_user_id ON portal_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_empresa_id ON portal_users(empresa_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email);

CREATE INDEX IF NOT EXISTS idx_vistorias_app_vistoriador_id ON vistorias(app_vistoriador_id);
CREATE INDEX IF NOT EXISTS idx_vistoria_assignments_app_vistoriador_id ON vistoria_assignments(app_vistoriador_id);
CREATE INDEX IF NOT EXISTS idx_contestacoes_portal_usuario_id ON contestacoes(portal_usuario_id);

-- 16. Inserir log da migração
INSERT INTO migration_log (name, description) 
VALUES ('separate_user_contexts_complete', 'Separação completa dos contextos de usuários: app_users para mobile e portal_users para web');

-- Comentários finais:
-- Esta migração cria uma separação completa entre:
-- 1. app_users: Usuários do aplicativo mobile (vistoriadores)
-- 2. portal_users: Usuários do portal web (gestores/admins)
-- 
-- Cada contexto tem suas próprias políticas RLS e permissões específicas
-- As tabelas compartilhadas (vistorias, contestações) foram atualizadas para trabalhar com ambos os contextos
-- A view unified_users permite compatibilidade com código existente se necessário