-- Adicionar campo data à tabela notifications se não existir
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB;

-- Conceder permissões para a tabela notifications
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT ON notifications TO anon;