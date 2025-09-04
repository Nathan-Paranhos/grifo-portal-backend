-- Migração para limpar apenas a tabela public.users
-- Data: 2025-01-17

-- 1. Remove dados órfãos da tabela public.users
-- (usuários que existem em public.users mas não em auth.users)
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- 2. Para emails duplicados na public.users, mantém apenas o mais recente
DELETE FROM public.users 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
    FROM public.users
  ) t 
  WHERE rn > 1
);

-- 3. Remove especificamente o usuário de teste da tabela public.users
DELETE FROM public.users WHERE email = 'paranhoscontato.n@gmail.com';

-- 4. Garante que a constraint de email único existe na tabela public.users
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

-- 5. Cria função para sincronizar dados entre auth.users e public.users
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

-- 6. Cria trigger para sincronização automática
DROP TRIGGER IF EXISTS sync_user_data_trigger ON auth.users;
CREATE TRIGGER sync_user_data_trigger
    AFTER INSERT OR UPDATE OR DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_data();

-- 7. Atualiza as políticas RLS para garantir segurança
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

-- 8. Garante que RLS está habilitado
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 9. Cria índices para performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_empresa_id ON public.users(empresa_id);

-- 10. Comentários para documentação
COMMENT ON FUNCTION sync_user_data() IS 'Sincroniza automaticamente dados entre auth.users e public.users';
COMMENT ON TRIGGER sync_user_data_trigger ON auth.users IS 'Trigger que sincroniza dados entre tabelas de usuários';

-- Finaliza a migração
SELECT 'Limpeza da tabela public.users aplicada com sucesso!' as resultado;