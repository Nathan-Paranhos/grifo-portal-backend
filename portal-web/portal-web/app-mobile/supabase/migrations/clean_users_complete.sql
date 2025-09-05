-- Migração completa para limpar usuários duplicados
-- Remove todas as constraints, limpa dados e recria constraints
-- Data: 2025-01-17

-- 1. Remove todas as constraints de chave estrangeira que referenciam public.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.vistorias DROP CONSTRAINT IF EXISTS vistorias_vistoriador_id_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.vistoria_assignments DROP CONSTRAINT IF EXISTS vistoria_assignments_vistoriador_id_fkey;
ALTER TABLE public.vistoria_assignments DROP CONSTRAINT IF EXISTS vistoria_assignments_assigned_by_fkey;
ALTER TABLE public.contestacoes DROP CONSTRAINT IF EXISTS contestacoes_usuario_id_fkey;
ALTER TABLE public.contestacoes DROP CONSTRAINT IF EXISTS contestacoes_respondido_por_fkey;
ALTER TABLE public.user_google_tokens DROP CONSTRAINT IF EXISTS user_google_tokens_user_id_fkey;
ALTER TABLE public.google_drive_sync_log DROP CONSTRAINT IF EXISTS google_drive_sync_log_user_id_fkey;
ALTER TABLE public.google_drive_sync_log DROP CONSTRAINT IF EXISTS fk_google_sync_user;
ALTER TABLE public.user_onedrive_tokens DROP CONSTRAINT IF EXISTS user_onedrive_tokens_user_id_fkey;
ALTER TABLE public.onedrive_sync_log DROP CONSTRAINT IF EXISTS onedrive_sync_log_user_id_fkey;
ALTER TABLE public.cloud_sync_settings DROP CONSTRAINT IF EXISTS cloud_sync_settings_user_id_fkey;

-- 2. Remove especificamente o usuário de teste e seus dados relacionados
DELETE FROM public.notifications WHERE user_id IN (SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com');
DELETE FROM public.vistoria_assignments WHERE vistoriador_id IN (SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com');
DELETE FROM public.vistoria_assignments WHERE assigned_by IN (SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com');
DELETE FROM public.contestacoes WHERE usuario_id IN (SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com');
DELETE FROM public.contestacoes WHERE respondido_por IN (SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com');
DELETE FROM public.user_google_tokens WHERE user_id IN (SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com');
DELETE FROM public.google_drive_sync_log WHERE user_id IN (SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com');
DELETE FROM public.user_onedrive_tokens WHERE user_id IN (SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com');
DELETE FROM public.onedrive_sync_log WHERE user_id IN (SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com');
DELETE FROM public.cloud_sync_settings WHERE user_id IN (SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com');

-- Atualiza vistorias para remover referência ao usuário que será deletado
UPDATE public.vistorias SET vistoriador_id = NULL WHERE vistoriador_id IN (SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com');

-- Remove o usuário de teste
DELETE FROM public.users WHERE email = 'paranhoscontato.n@gmail.com';
DELETE FROM auth.users WHERE email = 'paranhoscontato.n@gmail.com';

-- 3. Remove dados órfãos da tabela public.users
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- 4. Para emails duplicados na public.users, mantém apenas o mais recente
DELETE FROM public.users 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
    FROM public.users
  ) t 
  WHERE rn > 1
);

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

-- 6. Recria todas as constraints de chave estrangeira
ALTER TABLE public.users 
ADD CONSTRAINT users_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.vistorias 
ADD CONSTRAINT vistorias_vistoriador_id_fkey 
FOREIGN KEY (vistoriador_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.vistoria_assignments 
ADD CONSTRAINT vistoria_assignments_vistoriador_id_fkey 
FOREIGN KEY (vistoriador_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.vistoria_assignments 
ADD CONSTRAINT vistoria_assignments_assigned_by_fkey 
FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.contestacoes 
ADD CONSTRAINT contestacoes_usuario_id_fkey 
FOREIGN KEY (usuario_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.contestacoes 
ADD CONSTRAINT contestacoes_respondido_por_fkey 
FOREIGN KEY (respondido_por) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_google_tokens 
ADD CONSTRAINT user_google_tokens_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.google_drive_sync_log 
ADD CONSTRAINT google_drive_sync_log_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.google_drive_sync_log 
ADD CONSTRAINT fk_google_sync_user 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_onedrive_tokens 
ADD CONSTRAINT user_onedrive_tokens_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.onedrive_sync_log 
ADD CONSTRAINT onedrive_sync_log_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.cloud_sync_settings 
ADD CONSTRAINT cloud_sync_settings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

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

-- Finaliza a migração
SELECT 'Migração completa de limpeza de usuários duplicados aplicada com sucesso!' as resultado;