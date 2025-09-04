-- Migração segura para limpar usuários duplicados
-- Data: 2025-01-17

-- 1. Primeiro, desabilita temporariamente as constraints de chave estrangeira
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. Remove dados órfãos e duplicados da tabela public.users primeiro
-- Remove registros da public.users que não têm correspondência em auth.users
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- 3. Para emails duplicados na public.users, mantém apenas o mais recente
DELETE FROM public.users 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
    FROM public.users
  ) t 
  WHERE rn > 1
);

-- 4. Remove especificamente o usuário de teste das duas tabelas
DELETE FROM public.users WHERE email = 'paranhoscontato.n@gmail.com';
DELETE FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';

-- 5. Remove usuários duplicados da auth.users (mantém o mais recente)
DELETE FROM auth.users 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
    FROM auth.users
  ) t 
  WHERE rn > 1
);

-- 6. Recria a constraint de chave estrangeira
ALTER TABLE public.users 
ADD CONSTRAINT users_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. Garante que a constraint de email único existe na tabela public.users
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_email_key' 
        AND table_name = 'users' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
END $$;

-- 8. Cria uma função para prevenir duplicatas de email
CREATE OR REPLACE FUNCTION prevent_duplicate_emails()
RETURNS TRIGGER AS $$
BEGIN
    -- Verifica se já existe um usuário com este email
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = NEW.email AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
        RAISE EXCEPTION 'Email já está em uso por outro usuário';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Cria trigger para prevenir duplicatas na inserção/atualização
DROP TRIGGER IF EXISTS prevent_duplicate_emails_trigger ON auth.users;
CREATE TRIGGER prevent_duplicate_emails_trigger
    BEFORE INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_duplicate_emails();

-- 10. Cria função para sincronizar dados entre auth.users e public.users
CREATE OR REPLACE FUNCTION sync_user_data()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Quando um novo usuário é criado no auth.users, cria na public.users
        INSERT INTO public.users (id, email, nome, role, user_type)
        VALUES (
            NEW.id, 
            NEW.email, 
            COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', 'Usuário'), 
            'vistoriador',
            'vistoriador_app'
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            nome = COALESCE(EXCLUDED.nome, public.users.nome),
            updated_at = now();
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Atualiza dados na public.users quando auth.users é atualizado
        UPDATE public.users SET
            email = NEW.email,
            nome = COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', nome),
            updated_at = now()
        WHERE id = NEW.id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Remove da public.users quando removido do auth.users
        DELETE FROM public.users WHERE id = OLD.id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 11. Cria trigger para sincronização automática
DROP TRIGGER IF EXISTS sync_user_data_trigger ON auth.users;
CREATE TRIGGER sync_user_data_trigger
    AFTER INSERT OR UPDATE OR DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_data();

-- 12. Atualiza as políticas RLS para garantir segurança
-- Política para a tabela public.users
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Política para permitir inserção durante o registro
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
CREATE POLICY "Enable insert for authenticated users" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 13. Garante que RLS está habilitado
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 14. Cria índices para performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_empresa_id ON public.users(empresa_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);

-- 15. Comentários para documentação
COMMENT ON FUNCTION prevent_duplicate_emails() IS 'Previne a criação de usuários com emails duplicados';
COMMENT ON FUNCTION sync_user_data() IS 'Sincroniza automaticamente dados entre auth.users e public.users';
COMMENT ON TRIGGER prevent_duplicate_emails_trigger ON auth.users IS 'Trigger que previne emails duplicados';
COMMENT ON TRIGGER sync_user_data_trigger ON auth.users IS 'Trigger que sincroniza dados entre tabelas de usuários';

-- Finaliza a migração
SELECT 'Migração segura de limpeza de usuários duplicados aplicada com sucesso!' as resultado;