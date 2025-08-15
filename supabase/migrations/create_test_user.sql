-- Criar usuário de teste físico para validação
-- Este script cria um usuário completo para testes do sistema

-- 1. Primeiro, vamos garantir que temos uma empresa de teste
INSERT INTO empresas (id, nome, cnpj, endereco, telefone, email, created_at, updated_at)
VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'Grifo Vistorias Teste',
  '55.444.333/0001-22',
  'Rua Teste, 123 - Centro',
  '(11) 99999-9999',
  'contato@grifoteste.com',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  updated_at = NOW();

-- 2. Criar usuário para o Portal Web (sem auth_user_id por enquanto)
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
  updated_at
) VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  'portal.teste@grifo.com',
  'Usuário Teste Portal',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'admin',
  '{"all": true}',
  true,
  true,
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  nome = EXCLUDED.nome,
  updated_at = NOW();

-- 3. Criar usuário para o App Mobile (sem auth_user_id por enquanto)
INSERT INTO app_users (
  id,
  email,
  nome,
  empresa_id,
  role,
  ativo,
  created_at,
  updated_at
) VALUES (
  '770e8400-e29b-41d4-a716-446655440002',
  'app.teste@grifo.com',
  'Vistoriador Teste App',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'vistoriador',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  nome = EXCLUDED.nome,
  updated_at = NOW();

-- 5. Criar imóveis de teste
INSERT INTO imoveis (
  id,
  endereco,
  tipo,
  cep,
  cidade,
  estado,
  codigo,
  empresa_id,
  created_at,
  updated_at
) VALUES 
(
  '880e8400-e29b-41d4-a716-446655440003',
  'Rua das Flores, 123 - Centro',
  'Apartamento',
  '01234-567',
  'São Paulo',
  'SP',
  'APT001',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  NOW(),
  NOW()
),
(
  '990e8400-e29b-41d4-a716-446655440004',
  'Av. Paulista, 456 - Bela Vista',
  'Casa',
  '01310-100',
  'São Paulo',
  'SP',
  'CASA002',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 6. Criar vistorias de teste
INSERT INTO vistorias (
  id,
  imovel_id,
  app_vistoriador_id,
  empresa_id,
  status,
  tipo_vistoria,
  observacoes,
  data_vistoria,
  created_at,
  updated_at
) VALUES 
(
  'aa0e8400-e29b-41d4-a716-446655440005',
  '880e8400-e29b-41d4-a716-446655440003',
  '770e8400-e29b-41d4-a716-446655440002',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'pendente',
  'entrada',
  'Vistoria de entrada do apartamento',
  NOW() + INTERVAL '1 day',
  NOW(),
  NOW()
),
(
  'bb0e8400-e29b-41d4-a716-446655440006',
  '990e8400-e29b-41d4-a716-446655440004',
  '770e8400-e29b-41d4-a716-446655440002',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'concluida',
  'saida',
  'Vistoria de saída da casa',
  NOW() - INTERVAL '2 days',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 4. Verificar se os dados foram inseridos corretamente
SELECT 'Empresa criada:' as info, nome FROM empresas WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
SELECT 'Portal user criado:' as info, nome, email FROM portal_users WHERE email = 'portal.teste@grifo.com';
SELECT 'App user criado:' as info, nome, email FROM app_users WHERE email = 'app.teste@grifo.com';
SELECT 'Imóveis criados:' as info, COUNT(*) as total FROM imoveis WHERE empresa_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
SELECT 'Vistorias criadas:' as info, COUNT(*) as total FROM vistorias WHERE empresa_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';