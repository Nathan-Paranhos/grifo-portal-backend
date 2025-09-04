-- Adicionar coluna tenant à tabela clients para suporte a multi-tenant
ALTER TABLE clients ADD COLUMN tenant VARCHAR(255);

-- Criar índice para melhorar performance nas consultas por tenant
CREATE INDEX idx_clients_tenant ON clients(tenant);

-- Adicionar constraint para garantir que tenant não seja nulo
ALTER TABLE clients ALTER COLUMN tenant SET NOT NULL;

-- Verificar a estrutura atualizada da tabela
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clients' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar permissões atuais
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' AND table_name = 'clients' AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;