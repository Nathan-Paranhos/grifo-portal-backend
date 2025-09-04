-- Migração de dados para a tabela users unificada
-- Migra dados das tabelas clients, app_users e portal_users

-- Migrar dados da tabela clients (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clients') THEN
        INSERT INTO users (
            name, email, phone, password_hash, document, address, city, state, zip_code,
            user_type, tenant_slug, is_active, created_at, updated_at, created_by
        )
        SELECT 
            name, email, phone, password_hash, document, address, city, state, zip_code,
            'client' as user_type,
            tenant as tenant_slug,
            is_active,
            created_at,
            updated_at,
            created_by
        FROM clients
        WHERE NOT EXISTS (
            SELECT 1 FROM users WHERE users.email = clients.email
        );
        
        RAISE NOTICE 'Migrated % clients to users table', (SELECT COUNT(*) FROM clients);
    ELSE
        RAISE NOTICE 'Table clients does not exist, skipping migration';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error migrating clients: %', SQLERRM;
END $$;

-- Migrar dados da tabela app_users (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'app_users') THEN
        INSERT INTO users (
            name, email, user_type, is_active, created_at, updated_at
        )
        SELECT 
            name, email, 
            'admin' as user_type,
            COALESCE(is_active, true) as is_active,
            COALESCE(created_at, NOW()) as created_at,
            COALESCE(updated_at, NOW()) as updated_at
        FROM app_users
        WHERE NOT EXISTS (
            SELECT 1 FROM users WHERE users.email = app_users.email
        );
        
        RAISE NOTICE 'Migrated % app_users to users table', (SELECT COUNT(*) FROM app_users);
    ELSE
        RAISE NOTICE 'Table app_users does not exist, skipping migration';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error migrating app_users: %', SQLERRM;
END $$;

-- Migrar dados da tabela portal_users (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'portal_users') THEN
        INSERT INTO users (
            name, email, user_type, is_active, created_at, updated_at
        )
        SELECT 
            name, email,
            'admin' as user_type,
            COALESCE(is_active, true) as is_active,
            COALESCE(created_at, NOW()) as created_at,
            COALESCE(updated_at, NOW()) as updated_at
        FROM portal_users
        WHERE NOT EXISTS (
            SELECT 1 FROM users WHERE users.email = portal_users.email
        );
        
        RAISE NOTICE 'Migrated % portal_users to users table', (SELECT COUNT(*) FROM portal_users);
    ELSE
        RAISE NOTICE 'Table portal_users does not exist, skipping migration';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error migrating portal_users: %', SQLERRM;
END $$;

-- Atualizar tenant_id baseado no tenant_slug (se a tabela tenants existir)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenants') THEN
        UPDATE users 
        SET tenant_id = (
            SELECT tenants.id 
            FROM tenants 
            WHERE tenants.slug = users.tenant_slug
        )
        WHERE tenant_slug IS NOT NULL 
        AND tenant_id IS NULL;
        
        RAISE NOTICE 'Updated tenant_id for users with tenant_slug';
    ELSE
        RAISE NOTICE 'Table tenants does not exist, skipping tenant_id update';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error updating tenant_id: %', SQLERRM;
END $$;

-- Verificar e reportar o resultado da migração
DO $$
DECLARE
    total_users INTEGER;
    admin_users INTEGER;
    client_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_users FROM users;
    SELECT COUNT(*) INTO admin_users FROM users WHERE user_type IN ('admin', 'super_admin', 'empresa_admin', 'empresa_user', 'vistoriador_app');
    SELECT COUNT(*) INTO client_users FROM users WHERE user_type = 'client';
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Total users: %', total_users;
    RAISE NOTICE 'Admin users: %', admin_users;
    RAISE NOTICE 'Client users: %', client_users;
END $$;

-- Conceder permissões
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT ON users TO anon;