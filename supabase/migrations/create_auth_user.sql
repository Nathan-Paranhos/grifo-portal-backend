-- Atualizar dados existentes para testes

-- Atualizar empresa existente para garantir que está ativa
UPDATE empresas SET 
  nome = 'Grifo Vistorias Teste',
  email = 'teste@grifovistorias.com',
  ativo = true,
  updated_at = now()
WHERE cnpj = '12.345.678/0001-90';

-- Se não existe empresa com esse CNPJ, usar uma empresa existente
DO $$
DECLARE
  empresa_existente_id uuid;
BEGIN
  -- Buscar primeira empresa ativa
  SELECT id INTO empresa_existente_id FROM empresas WHERE ativo = true LIMIT 1;
  
  -- Se não encontrou empresa ativa, criar uma nova com CNPJ diferente
  IF empresa_existente_id IS NULL THEN
    INSERT INTO empresas (id, nome, cnpj, endereco, telefone, email, created_at, updated_at, configuracoes, plano, ativo)
    VALUES (
      'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
      'Grifo Vistorias Teste',
      '98.765.432/0001-10',
      'Rua Teste, 123 - Centro',
      '(11) 99999-9999',
      'teste@grifovistorias.com',
      now(),
      now(),
      '{}',
      'premium',
      true
    );
    empresa_existente_id := 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid;
  END IF;
  
  -- Inserir ou atualizar usuário portal
  INSERT INTO portal_users (
    id,
    email,
    nome,
    empresa_id,
    role,
    permissions,
    can_create_vistorias,
    can_edit_vistorias,
    can_view_all_company_data,
    ativo,
    created_at,
    updated_at,
    first_login_completed
  ) VALUES (
    'e778f687-d714-49c1-8bd6-a728f6874234'::uuid,
    'paranhoscontato.n@gmail.com',
    'Usuário Teste Portal',
    empresa_existente_id,
    'admin',
    '{"all": true}',
    true,
    true,
    true,
    true,
    now(),
    now(),
    true
  ) ON CONFLICT (email) DO UPDATE SET
    nome = 'Usuário Teste Portal',
    empresa_id = empresa_existente_id,
    role = 'admin',
    permissions = '{"all": true}',
    ativo = true,
    first_login_completed = true,
    updated_at = now();
END $$;

-- Criar tenant de teste
INSERT INTO tenants (id, name, slug, description, settings, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Empresa Teste',
  'teste',
  'Tenant de teste para desenvolvimento',
  '{}',
  true,
  now(),
  now()
) ON CONFLICT (slug) DO UPDATE SET
  name = 'Empresa Teste',
  description = 'Tenant de teste para desenvolvimento',
  is_active = true,
  updated_at = now();