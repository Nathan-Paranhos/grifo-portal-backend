-- Script para criar dados de teste no Supabase
-- Versão simplificada para evitar conflitos

-- 1. Inserir empresa de teste
INSERT INTO empresas (id, nome, cnpj, endereco, telefone, email) 
SELECT 
  gen_random_uuid(),
  'Imobiliária Teste Grifo',
  '99.999.999/0001-99',
  'Rua de Teste, 123 - Centro',
  '(11) 9999-9999',
  'teste@grifo.com'
WHERE NOT EXISTS (
  SELECT 1 FROM empresas WHERE nome = 'Imobiliária Teste Grifo'
);

-- 2. Inserir usuário vistoriador de teste
INSERT INTO app_users (id, email, nome, empresa_id, role, ativo)
SELECT 
  gen_random_uuid(), 
  'vistoriador.teste@grifo.com', 
  'Vistoriador Teste', 
  e.id, 
  'vistoriador', 
  true
FROM empresas e
WHERE e.nome = 'Imobiliária Teste Grifo'
AND NOT EXISTS (
  SELECT 1 FROM app_users WHERE email = 'vistoriador.teste@grifo.com'
);

-- 3. Inserir usuário gestor de teste
INSERT INTO portal_users (id, email, nome, empresa_id, role, can_create_vistorias, can_edit_vistorias, can_view_all_company_data, ativo)
SELECT 
  gen_random_uuid(), 
  'gestor.teste@grifo.com', 
  'Gestor Teste', 
  e.id, 
  'admin', 
  true, 
  true, 
  true, 
  true
FROM empresas e
WHERE e.nome = 'Imobiliária Teste Grifo'
AND NOT EXISTS (
  SELECT 1 FROM portal_users WHERE email = 'gestor.teste@grifo.com'
);

-- 4. Inserir imóvel de teste
INSERT INTO imoveis (id, endereco, tipo, cep, cidade, estado, empresa_id, codigo)
SELECT 
  gen_random_uuid(), 
  'Rua Teste Grifo, 456 - Teste', 
  'Apartamento', 
  '01234-567', 
  'São Paulo', 
  'SP', 
  e.id, 
  'TESTE001'
FROM empresas e
WHERE e.nome = 'Imobiliária Teste Grifo'
AND NOT EXISTS (
  SELECT 1 FROM imoveis WHERE codigo = 'TESTE001'
);

-- 5. Inserir vistoria de teste
INSERT INTO vistorias (id, imovel_id, app_vistoriador_id, empresa_id, status, tipo_vistoria, observacoes, data_vistoria)
SELECT 
  gen_random_uuid(), 
  i.id, 
  u.id, 
  e.id, 
  'concluida', 
  'Entrada', 
  'Vistoria de teste para demonstração', 
  NOW() - INTERVAL '1 day'
FROM empresas e
JOIN imoveis i ON i.empresa_id = e.id AND i.codigo = 'TESTE001'
JOIN app_users u ON u.empresa_id = e.id AND u.email = 'vistoriador.teste@grifo.com'
WHERE e.nome = 'Imobiliária Teste Grifo'
AND NOT EXISTS (
  SELECT 1 FROM vistorias v WHERE v.imovel_id = i.id AND v.app_vistoriador_id = u.id
);

-- 6. Inserir itens de vistoria de teste
INSERT INTO itens_vistoria (id, vistoria_id, ambiente, item, estado, observacoes)
SELECT 
  gen_random_uuid(), 
  v.id, 
  'Sala', 
  'Piso', 
  'Bom', 
  'Piso em bom estado'
FROM vistorias v
JOIN imoveis i ON v.imovel_id = i.id
WHERE i.codigo = 'TESTE001'
AND NOT EXISTS (
  SELECT 1 FROM itens_vistoria iv WHERE iv.vistoria_id = v.id AND iv.ambiente = 'Sala' AND iv.item = 'Piso'
);

INSERT INTO itens_vistoria (id, vistoria_id, ambiente, item, estado, observacoes)
SELECT 
  gen_random_uuid(), 
  v.id, 
  'Cozinha', 
  'Pia', 
  'Regular', 
  'Pequenos riscos'
FROM vistorias v
JOIN imoveis i ON v.imovel_id = i.id
WHERE i.codigo = 'TESTE001'
AND NOT EXISTS (
  SELECT 1 FROM itens_vistoria iv WHERE iv.vistoria_id = v.id AND iv.ambiente = 'Cozinha' AND iv.item = 'Pia'
);

-- 7. Inserir foto de teste
INSERT INTO fotos (id, vistoria_id, url, descricao, ambiente, tamanho_arquivo, formato)
SELECT 
  gen_random_uuid(), 
  v.id, 
  'https://exemplo.com/foto-teste.jpg', 
  'Foto de teste', 
  'Sala', 
  1024000, 
  'jpg'
FROM vistorias v
JOIN imoveis i ON v.imovel_id = i.id
WHERE i.codigo = 'TESTE001'
AND NOT EXISTS (
  SELECT 1 FROM fotos f WHERE f.vistoria_id = v.id AND f.descricao = 'Foto de teste'
);

-- 8. Inserir contestação de teste
INSERT INTO contestacoes (id, vistoria_id, empresa_id, portal_usuario_id, motivo, descricao, status)
SELECT 
  gen_random_uuid(), 
  v.id, 
  e.id, 
  p.id, 
  'Teste de contestação', 
  'Esta é uma contestação de teste para demonstração', 
  'pendente'
FROM vistorias v
JOIN imoveis i ON v.imovel_id = i.id
JOIN empresas e ON i.empresa_id = e.id
JOIN portal_users p ON p.empresa_id = e.id AND p.email = 'gestor.teste@grifo.com'
WHERE i.codigo = 'TESTE001'
AND NOT EXISTS (
  SELECT 1 FROM contestacoes c WHERE c.vistoria_id = v.id AND c.motivo = 'Teste de contestação'
);

-- Verificar dados criados
SELECT 'DADOS DE TESTE CRIADOS COM SUCESSO!' as resultado;

SELECT 'USUÁRIOS CRIADOS:' as info;
SELECT email, nome, role FROM app_users WHERE email LIKE '%@grifo.com';
SELECT email, nome, role FROM portal_users WHERE email LIKE '%@grifo.com';

SELECT 'EMPRESAS DE TESTE:' as info;
SELECT nome, cnpj FROM empresas WHERE nome LIKE '%Teste%';

SELECT 'IMÓVEIS DE TESTE:' as info;
SELECT codigo, endereco FROM imoveis WHERE codigo LIKE 'TESTE%';

SELECT 'VISTORIAS DE TESTE:' as info;
SELECT v.id, i.codigo as imovel, v.status, v.tipo_vistoria 
FROM vistorias v 
JOIN imoveis i ON v.imovel_id = i.id 
WHERE i.codigo LIKE 'TESTE%';

SELECT 'CONTESTAÇÕES DE TESTE:' as info;
SELECT c.motivo, c.status 
FROM contestacoes c 
JOIN vistorias v ON c.vistoria_id = v.id
JOIN imoveis i ON v.imovel_id = i.id
WHERE i.codigo LIKE 'TESTE%';