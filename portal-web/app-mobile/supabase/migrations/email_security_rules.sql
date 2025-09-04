-- Aplicar regras de segurança para emails únicos e RLS policies
-- Data: 2025-01-17

-- 1. Garantir que o email seja único na tabela users (verificar se já existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_email_unique' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
    END IF;
END $$;

-- 2. Garantir que o CNPJ seja único na tabela empresas (verificar se já existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'empresas_cnpj_unique' 
        AND table_name = 'empresas'
    ) THEN
        ALTER TABLE empresas ADD CONSTRAINT empresas_cnpj_unique UNIQUE (cnpj);
    END IF;
END $$;

-- 3. Criar políticas RLS para a tabela users
-- Política para SELECT: usuários podem ver apenas seus próprios dados ou dados da mesma empresa
CREATE POLICY "Users can view own data or company data" ON users
  FOR SELECT
  USING (
    auth.uid() = id OR 
    empresa_id IN (
      SELECT empresa_id FROM users WHERE id = auth.uid()
    )
  );

-- Política para INSERT: apenas usuários autenticados podem criar novos usuários
CREATE POLICY "Authenticated users can insert" ON users
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Política para UPDATE: usuários podem atualizar apenas seus próprios dados
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Política para DELETE: usuários podem deletar apenas seus próprios dados
CREATE POLICY "Users can delete own data" ON users
  FOR DELETE
  USING (auth.uid() = id);

-- 4. Criar políticas RLS para a tabela empresas
-- Política para SELECT: usuários podem ver apenas dados da própria empresa
CREATE POLICY "Users can view own company" ON empresas
  FOR SELECT
  USING (
    id IN (
      SELECT empresa_id FROM users WHERE id = auth.uid()
    )
  );

-- Política para INSERT: apenas usuários autenticados podem criar empresas
CREATE POLICY "Authenticated users can insert companies" ON empresas
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Política para UPDATE: usuários podem atualizar apenas dados da própria empresa
CREATE POLICY "Users can update own company" ON empresas
  FOR UPDATE
  USING (
    id IN (
      SELECT empresa_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT empresa_id FROM users WHERE id = auth.uid()
    )
  );

-- 5. Garantir permissões para roles anon e authenticated
-- Conceder permissões SELECT para role anon (necessário para login)
GRANT SELECT ON users TO anon;
GRANT SELECT ON empresas TO anon;

-- Conceder todas as permissões para role authenticated
GRANT ALL PRIVILEGES ON users TO authenticated;
GRANT ALL PRIVILEGES ON empresas TO authenticated;
GRANT ALL PRIVILEGES ON vistorias TO authenticated;
GRANT ALL PRIVILEGES ON imoveis TO authenticated;
GRANT ALL PRIVILEGES ON fotos TO authenticated;
GRANT ALL PRIVILEGES ON itens_vistoria TO authenticated;

-- 6. Criar função para validar email único antes de inserção
CREATE OR REPLACE FUNCTION validate_unique_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o email já existe (case insensitive)
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE LOWER(email) = LOWER(NEW.email) 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Email já está em uso. Por favor, use um email diferente.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Criar trigger para validar email único
DROP TRIGGER IF EXISTS validate_unique_email_trigger ON users;
CREATE TRIGGER validate_unique_email_trigger
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_unique_email();

-- 8. Criar função para validar CNPJ único
CREATE OR REPLACE FUNCTION validate_unique_cnpj()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o CNPJ já existe (apenas se não for nulo)
  IF NEW.cnpj IS NOT NULL AND EXISTS (
    SELECT 1 FROM empresas 
    WHERE cnpj = NEW.cnpj 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'CNPJ já está em uso. Por favor, use um CNPJ diferente.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Criar trigger para validar CNPJ único
DROP TRIGGER IF EXISTS validate_unique_cnpj_trigger ON empresas;
CREATE TRIGGER validate_unique_cnpj_trigger
  BEFORE INSERT OR UPDATE ON empresas
  FOR EACH ROW
  EXECUTE FUNCTION validate_unique_cnpj();

-- 10. Comentários para documentação
COMMENT ON CONSTRAINT users_email_unique ON users IS 'Garante que cada email seja único no sistema';
COMMENT ON CONSTRAINT empresas_cnpj_unique ON empresas IS 'Garante que cada CNPJ seja único no sistema';
COMMENT ON FUNCTION validate_unique_email() IS 'Função para validar email único com verificação case-insensitive';
COMMENT ON FUNCTION validate_unique_cnpj() IS 'Função para validar CNPJ único';