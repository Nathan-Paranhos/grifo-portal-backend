-- Criar tenant de teste para resolver erro interno da API
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
) ON CONFLICT (slug) DO NOTHING;

-- Criar empresa de teste associada ao tenant
INSERT INTO empresas (id, nome, cnpj, endereco, telefone, email, created_at, updated_at, configuracoes, plano, ativo)
VALUES (
  gen_random_uuid(),
  'Grifo Vistorias Teste',
  '12.345.678/0001-90',
  'Rua Teste, 123 - Centro',
  '(11) 99999-9999',
  'teste@grifovistorias.com',
  now(),
  now(),
  '{}',
  'premium',
  true
) ON CONFLICT (cnpj) DO NOTHING;

-- Criar usuário portal de teste
INSERT INTO portal_users (id, email, nome, empresa_id, role, permissions, can_create_vistorias, can_edit_vistorias, can_view_all_company_data, ativo, created_at, updated_at, first_login_completed)
SELECT 
  gen_random_uuid(),
  'paranhoscontato.n@gmail.com',
  'Usuário Teste Portal',
  e.id,
  'admin',
  '{"all": true}',
  true,
  true,
  true,
  true,
  now(),
  now(),
  true
FROM empresas e 
WHERE e.email = 'teste@grifovistorias.com'
ON CONFLICT (email) DO NOTHING;

-- Criar alguns dados de exemplo para testes
-- Imóvel de teste
INSERT INTO imoveis (id, endereco, tipo, cep, cidade, estado, empresa_id, created_at, updated_at, codigo)
SELECT 
  gen_random_uuid(),
  'Rua das Flores, 456 - Jardim Teste',
  'Apartamento',
  '01234-567',
  'São Paulo',
  'SP',
  e.id,
  now(),
  now(),
  'IMOVEL-001'
FROM empresas e 
WHERE e.email = 'teste@grifovistorias.com'
ON CONFLICT DO NOTHING;

-- Vistoria de teste
INSERT INTO vistorias (id, imovel_id, empresa_id, status, tipo_vistoria, observacoes, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  i.id,
  e.id,
  'pendente',
  'Entrada',
  'Vistoria de teste para QA',
  now(),
  now()
FROM empresas e 
JOIN imoveis i ON i.empresa_id = e.id
WHERE e.email = 'teste@grifovistorias.com'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Conceder permissões para as tabelas
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON portal_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON imoveis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vistorias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON contestacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fotos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON itens_vistoria TO authenticated;

-- Conceder permissões para anon (usuários não autenticados)
GRANT SELECT ON tenants TO anon;
GRANT SELECT ON empresas TO anon;
GRANT SELECT ON portal_users TO anon;