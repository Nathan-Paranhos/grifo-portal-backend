-- Migração para unificar estrutura de usuários
-- Modifica a tabela users existente para suportar tanto administradores quanto clientes

-- Adicionar colunas necessárias à tabela users existente
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS document VARCHAR(20); -- CPF/CNPJ para clientes
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_slug VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Atualizar campo name baseado no campo nome existente
UPDATE users SET name = nome WHERE name IS NULL AND nome IS NOT NULL;

-- Salvar a view usuarios se existir
DO $$
DECLARE
    view_definition TEXT;
BEGIN
    -- Capturar a definição da view usuarios se existir
    SELECT pg_get_viewdef('usuarios'::regclass) INTO view_definition;
    
    -- Armazenar em uma tabela temporária para recriar depois
    CREATE TEMP TABLE IF NOT EXISTS temp_view_backup (view_name TEXT, definition TEXT);
    INSERT INTO temp_view_backup VALUES ('usuarios', view_definition);
EXCEPTION
    WHEN undefined_table THEN
        -- View não existe, continuar
        NULL;
END $$;

-- Converter user_type de enum para VARCHAR para evitar problemas
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_user_type VARCHAR(20);

-- Mapear os valores existentes do enum para VARCHAR
UPDATE users SET new_user_type = CASE 
    WHEN user_type::text = 'empresa_admin' THEN 'admin'
    WHEN user_type::text = 'empresa_user' THEN 'admin'
    WHEN user_type::text = 'vistoriador_app' THEN 'admin'
    WHEN user_type::text = 'admin' THEN 'admin'
    WHEN user_type::text = 'super_admin' THEN 'super_admin'
    WHEN user_type::text = 'client' THEN 'client'
    ELSE 'admin'
END WHERE new_user_type IS NULL;

-- Remover a coluna antiga com CASCADE para remover dependências
ALTER TABLE users DROP COLUMN IF EXISTS user_type CASCADE;
ALTER TABLE users RENAME COLUMN new_user_type TO user_type;

-- Adicionar constraint para user_type
ALTER TABLE users ADD CONSTRAINT valid_user_type CHECK (user_type IN ('admin', 'super_admin', 'client', 'empresa_admin', 'empresa_user', 'vistoriador_app'));

-- Recriar a view usuarios se existia
DO $$
DECLARE
    view_def TEXT;
BEGIN
    SELECT definition INTO view_def FROM temp_view_backup WHERE view_name = 'usuarios';
    IF view_def IS NOT NULL THEN
        -- Tentar recriar a view (pode precisar de ajustes)
        EXECUTE 'CREATE OR REPLACE VIEW usuarios AS ' || view_def;
    END IF;
EXCEPTION
    WHEN others THEN
        -- Se falhar, criar uma view simples
        CREATE OR REPLACE VIEW usuarios AS 
        SELECT id, name, email, user_type, created_at, updated_at 
        FROM users;
END $$;

-- Adicionar constraint para o status
DO $$
BEGIN
    ALTER TABLE users ADD CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'pending', 'suspended'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Adicionar foreign key constraint para tenants se possível
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenants') THEN
        ALTER TABLE users ADD CONSTRAINT fk_users_tenant_id 
            FOREIGN KEY (tenant_id) REFERENCES tenants(id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Adicionar foreign key para auth.users se possível
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        ALTER TABLE users ADD CONSTRAINT fk_users_auth_user_id 
            FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Criar índices adicionais
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_tenant_slug ON users(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Trigger para atualizar updated_at (se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Atualizar políticas RLS existentes
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Clients can view own data" ON users;
DROP POLICY IF EXISTS "Only admins can create users" ON users;
DROP POLICY IF EXISTS "Users can update own data or admins can update any" ON users;

-- Política para administradores (podem ver todos os usuários)
CREATE POLICY "Admins can view all users" ON users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.auth_user_id = auth.uid() 
            AND admin_user.user_type IN ('admin', 'super_admin')
        )
    );

-- Política para clientes (podem ver apenas seus próprios dados)
CREATE POLICY "Clients can view own data" ON users
    FOR SELECT
    USING (
        auth_user_id = auth.uid() 
        OR (
            user_type = 'client' 
            AND tenant_id = (
                SELECT tenant_id FROM users 
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Política para inserção (apenas admins podem criar usuários)
CREATE POLICY "Only admins can create users" ON users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.auth_user_id = auth.uid() 
            AND admin_user.user_type IN ('admin', 'super_admin')
        )
    );

-- Política para atualização
CREATE POLICY "Users can update own data or admins can update any" ON users
    FOR UPDATE
    USING (
        auth_user_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM users admin_user 
            WHERE admin_user.auth_user_id = auth.uid() 
            AND admin_user.user_type IN ('admin', 'super_admin')
        )
    );

-- Recriar política para contestações se necessário
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contestacoes') THEN
        DROP POLICY IF EXISTS "contestacoes_delete_policy" ON contestacoes;
        CREATE POLICY "contestacoes_delete_policy" ON contestacoes
            FOR DELETE
            USING (
                EXISTS (
                    SELECT 1 FROM users 
                    WHERE users.auth_user_id = auth.uid() 
                    AND users.user_type IN ('admin', 'super_admin')
                )
            );
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- Conceder permissões básicas
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT ON users TO anon;

-- Comentários para documentação
COMMENT ON TABLE users IS 'Tabela unificada de usuários que suporta administradores e clientes';
COMMENT ON COLUMN users.user_type IS 'Tipo de usuário: admin, super_admin, client, empresa_admin, empresa_user, vistoriador_app';
COMMENT ON COLUMN users.tenant_id IS 'ID do tenant para clientes (multi-tenant)';
COMMENT ON COLUMN users.tenant_slug IS 'Slug do tenant para compatibilidade';
COMMENT ON COLUMN users.document IS 'CPF ou CNPJ para clientes';
COMMENT ON COLUMN users.name IS 'Nome do usuário (baseado no campo nome existente)';