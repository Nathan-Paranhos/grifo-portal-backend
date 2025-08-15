-- Vistorias de exemplo com diferentes status e tipos
-- Continuação dos dados de exemplo para demonstração completa

-- Inserir vistorias de entrada (recém-criadas)
INSERT INTO vistorias (id, imovel_id, vistoriador_id, empresa_id, tipo, status, data_agendada, observacoes, created_at, updated_at) VALUES
('vistoria-001', 'imovel-001', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'entrada', 'agendada', '2024-01-20 09:00:00', 'Vistoria de entrada para novo inquilino. Verificar estado geral do imóvel.', '2024-01-15 10:30:00', '2024-01-15 10:30:00'),
('vistoria-002', 'imovel-002', '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'entrada', 'em_andamento', '2024-01-18 14:00:00', 'Apartamento de alto padrão. Atenção especial aos acabamentos.', '2024-01-16 08:15:00', '2024-01-18 14:30:00'),
('vistoria-003', 'imovel-003', '550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440001', 'entrada', 'finalizada', '2024-01-10 10:00:00', 'Cobertura nos Jardins. Vistoria completa realizada.', '2024-01-08 16:20:00', '2024-01-10 17:45:00'),
('vistoria-004', 'imovel-004', '550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440002', 'entrada', 'finalizada', '2024-01-12 11:30:00', 'Apartamento compacto, bem conservado.', '2024-01-10 09:00:00', '2024-01-12 16:20:00')
ON CONFLICT (id) DO NOTHING;

-- Inserir vistorias de saída
INSERT INTO vistorias (id, imovel_id, vistoriador_id, empresa_id, tipo, status, data_agendada, observacoes, created_at, updated_at) VALUES
('vistoria-005', 'imovel-001', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'saida', 'agendada', '2024-01-25 15:00:00', 'Vistoria de saída após 2 anos de locação. Verificar possíveis danos.', '2024-01-20 11:45:00', '2024-01-20 11:45:00'),
('vistoria-006', 'imovel-005', '550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440003', 'saida', 'em_andamento', '2024-01-19 16:30:00', 'Apartamento frente mar em Copacabana. Verificar infiltrações.', '2024-01-17 13:20:00', '2024-01-19 16:45:00'),
('vistoria-007', 'imovel-002', '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'saida', 'finalizada', '2024-01-08 09:00:00', 'Vistoria de saída concluída. Pequenos reparos necessários.', '2024-01-05 14:30:00', '2024-01-08 12:15:00')
ON CONFLICT (id) DO NOTHING;

-- Inserir vistorias comerciais
INSERT INTO vistorias (id, imovel_id, vistoriador_id, empresa_id, tipo, status, data_agendada, observacoes, created_at, updated_at) VALUES
('vistoria-008', 'imovel-006', '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'comercial', 'finalizada', '2024-01-05 08:00:00', 'Escritório na Paulista. Vistoria para seguro empresarial.', '2024-01-02 10:00:00', '2024-01-05 17:30:00'),
('vistoria-009', 'imovel-007', '550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440002', 'comercial', 'em_andamento', '2024-01-21 13:00:00', 'Loja na 25 de Março. Verificar instalações elétricas.', '2024-01-18 15:45:00', '2024-01-21 13:30:00'),
('vistoria-010', 'imovel-008', '550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440003', 'comercial', 'agendada', '2024-01-24 10:30:00', 'Escritório no Centro do Rio. Vistoria preventiva.', '2024-01-22 09:15:00', '2024-01-22 09:15:00')
ON CONFLICT (id) DO NOTHING;

-- Inserir vistorias industriais
INSERT INTO vistorias (id, imovel_id, vistoriador_id, empresa_id, tipo, status, data_agendada, observacoes, created_at, updated_at) VALUES
('vistoria-011', 'imovel-010', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'industrial', 'finalizada', '2024-01-03 07:00:00', 'Galpão industrial em Guarulhos. Vistoria de segurança completa.', '2023-12-28 16:00:00', '2024-01-03 18:00:00'),
('vistoria-012', 'imovel-011', '550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440002', 'industrial', 'em_andamento', '2024-01-22 06:30:00', 'Fábrica em São Bernardo. Verificar equipamentos de segurança.', '2024-01-19 14:20:00', '2024-01-22 07:00:00'),
('vistoria-013', 'imovel-012', '550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440003', 'industrial', 'agendada', '2024-01-26 08:00:00', 'Centro logístico no Rio. Vistoria de renovação de seguro.', '2024-01-23 11:30:00', '2024-01-23 11:30:00')
ON CONFLICT (id) DO NOTHING;

-- Inserir vistorias de seguros
INSERT INTO vistorias (id, imovel_id, vistoriador_id, empresa_id, tipo, status, data_agendada, observacoes, created_at, updated_at) VALUES
('vistoria-014', 'imovel-003', '550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440001', 'seguro', 'finalizada', '2024-01-07 14:00:00', 'Vistoria para renovação de seguro residencial. Cobertura de alto valor.', '2024-01-04 12:00:00', '2024-01-07 18:30:00'),
('vistoria-015', 'imovel-009', '550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'seguro', 'em_andamento', '2024-01-23 11:00:00', 'Shopping Center. Vistoria para seguro empresarial de grande porte.', '2024-01-21 10:00:00', '2024-01-23 11:45:00')
ON CONFLICT (id) DO NOTHING;

-- Inserir itens de vistoria de exemplo para algumas vistorias finalizadas
INSERT INTO itens_vistoria (id, vistoria_id, ambiente, item, estado, observacoes, foto_url, created_at) VALUES
-- Itens da vistoria-003 (finalizada)
('item-001', 'vistoria-003', 'Sala de Estar', 'Piso de madeira', 'bom', 'Piso em excelente estado, sem riscos ou manchas', NULL, '2024-01-10 10:30:00'),
('item-002', 'vistoria-003', 'Sala de Estar', 'Parede pintada', 'otimo', 'Pintura recente, sem defeitos', NULL, '2024-01-10 10:35:00'),
('item-003', 'vistoria-003', 'Cozinha', 'Bancada de granito', 'bom', 'Pequeno risco na bancada, mas em bom estado geral', NULL, '2024-01-10 11:00:00'),
('item-004', 'vistoria-003', 'Cozinha', 'Armários planejados', 'otimo', 'Armários novos, todas as portas funcionando perfeitamente', NULL, '2024-01-10 11:10:00'),
('item-005', 'vistoria-003', 'Banheiro Social', 'Revestimento cerâmico', 'regular', 'Algumas peças soltas, necessário reparo', NULL, '2024-01-10 11:30:00'),
-- Itens da vistoria-004 (finalizada)
('item-006', 'vistoria-004', 'Quarto Principal', 'Piso laminado', 'bom', 'Piso em bom estado, apenas desgaste normal', NULL, '2024-01-12 12:00:00'),
('item-007', 'vistoria-004', 'Quarto Principal', 'Janela de alumínio', 'otimo', 'Janela nova, vedação perfeita', NULL, '2024-01-12 12:15:00'),
('item-008', 'vistoria-004', 'Área de Serviço', 'Tanque de louça', 'bom', 'Tanque em bom estado, sem trincas', NULL, '2024-01-12 13:00:00'),
-- Itens da vistoria-007 (finalizada)
('item-009', 'vistoria-007', 'Sala de Jantar', 'Lustre de cristal', 'regular', 'Lustre com algumas peças faltando, necessário reparo', NULL, '2024-01-08 09:30:00'),
('item-010', 'vistoria-007', 'Varanda', 'Deck de madeira', 'ruim', 'Madeira com sinais de cupim, necessário tratamento urgente', NULL, '2024-01-08 10:00:00')
ON CONFLICT (id) DO NOTHING;

-- Comentário: Dados completos inseridos
-- Total: 15 vistorias com diferentes status e tipos
-- 10 itens de vistoria de exemplo para demonstrar funcionalidades