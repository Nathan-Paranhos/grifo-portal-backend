-- Migração para limpar usuários duplicados desabilitando constraints temporariamente
-- Data: 2025-01-17

-- 1. Desabilita temporariamente as constraints de chave estrangeira
ALTER TABLE fotos DISABLE TRIGGER ALL;
ALTER TABLE vistorias DISABLE TRIGGER ALL;
ALTER TABLE notifications DISABLE TRIGGER ALL;
ALTER TABLE contestacoes DISABLE TRIGGER ALL;
ALTER TABLE vistoria_assignments DISABLE TRIGGER ALL;
ALTER TABLE user_onedrive_tokens DISABLE TRIGGER ALL;
ALTER TABLE user_google_tokens DISABLE TRIGGER ALL;

-- 2. Remove especificamente o usuário de teste e todos os dados relacionados
-- Remove fotos relacionadas às vistorias do usuário de teste
DELETE FROM fotos WHERE vistoria_id IN (
    SELECT id FROM vistorias WHERE vistoriador_id IN (
        SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com'
    )
);

-- Remove vistorias do usuário de teste
DELETE FROM vistorias WHERE vistoriador_id IN (
    SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com'
);

-- Remove outras referências do usuário de teste
DELETE FROM notifications WHERE user_id IN (
    SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com'
);

DELETE FROM contestacoes WHERE user_id IN (
    SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com'
);

DELETE FROM vistoria_assignments WHERE vistoriador_id IN (
    SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com'
);

DELETE FROM user_onedrive_tokens WHERE user_id IN (
    SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com'
);

DELETE FROM user_google_tokens WHERE user_id IN (
    SELECT id FROM public.users WHERE email = 'paranhoscontato.n@gmail.com'
);

-- Remove o usuário de teste da tabela public.users
DELETE FROM public.users WHERE email = 'paranhoscontato.n@gmail.com';

-- 3. Remove dados órfãos (usuários em public.users que não existem em auth.users)
-- Primeiro identifica os usuários órfãos
CREATE TEMP TABLE orphan_users AS 
SELECT id FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- Remove fotos relacionadas às vistorias dos usuários órfãos
DELETE FROM fotos WHERE vistoria_id IN (
    SELECT id FROM vistorias WHERE vistoriador_id IN (SELECT id FROM orphan_users)
);

-- Remove vistorias dos usuários órfãos
DELETE FROM vistorias WHERE vistoriador_id IN (SELECT id FROM orphan_users);

-- Remove outras referências dos usuários órfãos
DELETE FROM notifications WHERE user_id IN (SELECT id FROM orphan_users);
DELETE FROM contestacoes WHERE user_id IN (SELECT id FROM orphan_users);
DELETE FROM vistoria_assignments WHERE vistoriador_id IN (SELECT id FROM orphan_users);
DELETE FROM user_onedrive_tokens WHERE user_id IN (SELECT id FROM orphan_users);
DELETE FROM user_google_tokens WHERE user_id IN (SELECT id FROM orphan_users);

-- Remove os usuários órfãos
DELETE FROM public.users WHERE id IN (SELECT id FROM orphan_users);

DROP TABLE orphan_users;

-- 4. Para emails duplicados na public.users, remove os mais antigos e suas referências
CREATE TEMP TABLE duplicate_users AS 
SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
    FROM public.users
) t 
WHERE rn > 1;

-- Remove fotos relacionadas às vistorias dos usuários duplicados
DELETE FROM fotos WHERE vistoria_id IN (
    SELECT id FROM vistorias WHERE vistoriador_id IN (SELECT id FROM duplicate_users)
);

-- Remove vistorias dos usuários duplicados
DELETE FROM vistorias WHERE vistoriador_id IN (SELECT id FROM duplicate_users);

-- Remove outras referências dos usuários duplicados
DELETE FROM notifications WHERE user_id IN (SELECT id FROM duplicate_users);
DELETE FROM contestacoes WHERE user_id IN (SELECT id FROM duplicate_users);
DELETE FROM vistoria_assignments WHERE vistoriador_id IN (SELECT id FROM duplicate_users);
DELETE FROM user_onedrive_tokens WHERE user_id IN (SELECT id FROM duplicate_users);
DELETE FROM user_google_tokens WHERE user_id IN (SELECT id FROM duplicate_users);

-- Remove os usuários duplicados (mantém apenas o mais recente)
DELETE FROM public.users WHERE id IN (SELECT id FROM duplicate_users);

DROP TABLE duplicate_users;

-- 5. Reabilita as constraints de chave estrangeira
ALTER TABLE fotos ENABLE TRIGGER ALL;
ALTER TABLE vistorias ENABLE TRIGGER ALL;
ALTER TABLE notifications ENABLE TRIGGER ALL;
ALTER TABLE contestacoes ENABLE TRIGGER ALL;
ALTER TABLE vistoria_assignments ENABLE TRIGGER ALL;
ALTER TABLE user_onedrive_tokens ENABLE TRIGGER ALL;
ALTER TABLE user_google_tokens ENABLE TRIGGER ALL;

-- 6. Garante que a constraint de email único existe na tabela public.users
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

-- 7. Cria função para sincronizar dados entre auth.users e public.users
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

-- 8. Cria trigger para sincronização automática
DROP TRIGGER IF EXISTS sync_user_data_trigger ON auth.users;
CREATE TRIGGER sync_user_data_trigger
    AFTER INSERT OR UPDATE OR DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_data();

-- 9. Atualiza as políticas RLS para garantir segurança
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
CREATE POLICY "Enable insert for authenticated users" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 10. Garante que RLS está habilitado
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 11. Cria índices para performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_empresa_id ON public.users(empresa_id);

-- Finaliza a migração
SELECT 'Limpeza completa de usuários com desabilitação de FK aplicada com sucesso!' as resultado;