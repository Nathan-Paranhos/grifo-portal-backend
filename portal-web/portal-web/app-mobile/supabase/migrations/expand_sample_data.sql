-- Expandir dados de exemplo com mais fotos e vistorias realistas
-- Usar apenas usuários existentes para evitar problemas de foreign key

-- Adicionar mais imóveis para demonstrar variedade
INSERT INTO imoveis (id, endereco, tipo, cep, cidade, estado, empresa_id, codigo) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'Rua das Palmeiras, 456 - Jardim Botânico', 'Casa', '22461-000', 'Rio de Janeiro', 'RJ', (SELECT id FROM empresas WHERE nome = 'Vistoria Tech'), 'IMV-2024-004'),
('660e8400-e29b-41d4-a716-446655440002', 'Av. Paulista, 1000 - Bela Vista', 'Apartamento', '01310-100', 'São Paulo', 'SP', (SELECT id FROM empresas WHERE nome = 'Vistoria Tech'), 'IMV-2024-005'),
('660e8400-e29b-41d4-a716-446655440003', 'Rua do Comércio, 789 - Centro', 'Loja', '30112-000', 'Belo Horizonte', 'MG', (SELECT id FROM empresas WHERE nome = 'Inspeções Premium'), 'IMP-2024-003'),
('660e8400-e29b-41d4-a716-446655440004', 'Av. Beira Mar, 2000 - Copacabana', 'Cobertura', '22070-900', 'Rio de Janeiro', 'RJ', (SELECT id FROM empresas WHERE nome = 'Vistoria Tech'), 'IMV-2024-006'),
('660e8400-e29b-41d4-a716-446655440005', 'Rua Industrial, 500 - Distrito Industrial', 'Galpão', '06460-040', 'Barueri', 'SP', (SELECT id FROM empresas WHERE nome = 'Inspeções Premium'), 'IMP-2024-004'),
('660e8400-e29b-41d4-a716-446655440006', 'Rua Residencial, 123 - Vila Madalena', 'Casa', '05433-000', 'São Paulo', 'SP', (SELECT id FROM empresas WHERE nome = 'Vistoria Tech'), 'IMV-2024-007')
ON CONFLICT (id) DO NOTHING;

-- Adicionar mais vistorias com diferentes status (usando usuário existente)
INSERT INTO vistorias (id, imovel_id, empresa_id, vistoriador_id, status, tipo_vistoria, observacoes, data_vistoria) VALUES
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', (SELECT id FROM empresas WHERE nome = 'Vistoria Tech'), (SELECT id FROM users WHERE email = 'admin@vistoriatech.com'), 'em_andamento', 'Entrada', 'Vistoria de entrada para novo inquilino', '2024-01-20 09:00:00+00'),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', (SELECT id FROM empresas WHERE nome = 'Vistoria Tech'), NULL, 'pendente', 'Saída', 'Vistoria de saída - verificar danos', '2024-01-22 14:00:00+00'),
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003', (SELECT id FROM empresas WHERE nome = 'Inspeções Premium'), NULL, 'finalizada', 'Cautelar', 'Vistoria cautelar para seguro', '2024-01-18 10:30:00+00'),
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440004', (SELECT id FROM empresas WHERE nome = 'Vistoria Tech'), NULL, 'pendente', 'Entrada', 'Cobertura de luxo - atenção especial aos acabamentos', '2024-01-25 16:00:00+00'),
('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440005', (SELECT id FROM empresas WHERE nome = 'Inspeções Premium'), NULL, 'pendente', 'Cautelar', 'Galpão industrial - verificar estrutura e equipamentos', '2024-01-24 08:00:00+00'),
('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440006', (SELECT id FROM empresas WHERE nome = 'Vistoria Tech'), (SELECT id FROM users WHERE email = 'admin@vistoriatech.com'), 'em_andamento', 'Saída', 'Casa em Vila Madalena - inquilino saindo', '2024-01-21 11:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Adicionar fotos de exemplo com metadados otimizados
INSERT INTO fotos (id, vistoria_id, url, descricao, ambiente, tamanho_arquivo, formato, comprimida, largura, altura, hash_arquivo) VALUES
-- Fotos da vistoria em andamento (Jardim Botânico)
('990e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20living%20room%20with%20sofa%20and%20coffee%20table%20bright%20lighting&image_size=landscape_16_9', 'Sala de estar em bom estado', 'Sala', 245760, 'jpg', true, 1920, 1080, 'hash_sala_001'),
('990e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440001', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20kitchen%20with%20white%20cabinets%20granite%20countertop%20stainless%20appliances&image_size=landscape_16_9', 'Cozinha com armários novos', 'Cozinha', 198432, 'jpg', true, 1920, 1080, 'hash_cozinha_001'),
('990e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440001', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=bedroom%20with%20double%20bed%20wardrobe%20natural%20lighting%20clean&image_size=landscape_16_9', 'Quarto principal limpo', 'Quarto', 223104, 'jpg', true, 1920, 1080, 'hash_quarto_001'),
('990e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440001', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=bathroom%20with%20white%20tiles%20shower%20mirror%20clean%20modern&image_size=portrait_4_3', 'Banheiro em perfeito estado', 'Banheiro', 187392, 'jpg', true, 1440, 1920, 'hash_banheiro_001'),
('990e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440001', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=house%20entrance%20hall%20wooden%20floor%20good%20condition&image_size=landscape_16_9', 'Hall de entrada', 'Hall', 212992, 'jpg', true, 1920, 1080, 'hash_hall_001'),

-- Fotos da vistoria finalizada (Loja)
('990e8400-e29b-41d4-a716-446655440006', '770e8400-e29b-41d4-a716-446655440003', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=commercial%20store%20interior%20empty%20shelves%20good%20lighting%20clean%20floor&image_size=landscape_16_9', 'Área principal da loja', 'Área Principal', 267264, 'jpg', true, 1920, 1080, 'hash_loja_001'),
('990e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440003', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=store%20stockroom%20shelving%20units%20organized%20clean%20storage&image_size=landscape_16_9', 'Estoque organizado', 'Estoque', 234816, 'jpg', true, 1920, 1080, 'hash_estoque_001'),
('990e8400-e29b-41d4-a716-446655440008', '770e8400-e29b-41d4-a716-446655440003', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=store%20entrance%20glass%20door%20good%20condition%20street%20view&image_size=portrait_4_3', 'Entrada da loja', 'Entrada', 201728, 'jpg', true, 1440, 1920, 'hash_entrada_001'),
('990e8400-e29b-41d4-a716-446655440009', '770e8400-e29b-41d4-a716-446655440003', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=store%20cashier%20counter%20clean%20organized%20retail%20space&image_size=landscape_16_9', 'Balcão de atendimento', 'Balcão', 189440, 'jpg', true, 1920, 1080, 'hash_balcao_001'),

-- Fotos da vistoria em andamento (Vila Madalena)
('990e8400-e29b-41d4-a716-446655440010', '770e8400-e29b-41d4-a716-446655440006', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=house%20exterior%20facade%20garden%20front%20yard%20residential%20street&image_size=landscape_16_9', 'Fachada da casa', 'Exterior', 289792, 'jpg', true, 1920, 1080, 'hash_fachada_001'),
('990e8400-e29b-41d4-a716-446655440011', '770e8400-e29b-41d4-a716-446655440006', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=living%20room%20with%20wear%20marks%20on%20walls%20used%20furniture%20natural%20light&image_size=landscape_16_9', 'Sala com marcas de uso', 'Sala', 256512, 'jpg', true, 1920, 1080, 'hash_sala_002'),
('990e8400-e29b-41d4-a716-446655440012', '770e8400-e29b-41d4-a716-446655440006', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=kitchen%20with%20minor%20damage%20cabinet%20door%20scratched%20countertop&image_size=landscape_16_9', 'Cozinha com pequenos danos', 'Cozinha', 243648, 'jpg', true, 1920, 1080, 'hash_cozinha_002'),
('990e8400-e29b-41d4-a716-446655440013', '770e8400-e29b-41d4-a716-446655440006', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=bedroom%20with%20wall%20stains%20worn%20carpet%20needs%20maintenance&image_size=landscape_16_9', 'Quarto com desgaste', 'Quarto', 234560, 'jpg', true, 1920, 1080, 'hash_quarto_002'),
('990e8400-e29b-41d4-a716-446655440014', '770e8400-e29b-41d4-a716-446655440006', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=bathroom%20with%20cracked%20tiles%20old%20fixtures%20needs%20repair&image_size=portrait_4_3', 'Banheiro com danos', 'Banheiro', 198720, 'jpg', true, 1440, 1920, 'hash_banheiro_002'),

-- Fotos adicionais para demonstrar volume
('990e8400-e29b-41d4-a716-446655440015', '770e8400-e29b-41d4-a716-446655440002', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=apartment%20balcony%20city%20view%20good%20condition%20modern&image_size=landscape_16_9', 'Varanda com vista', 'Varanda', 278528, 'jpg', true, 1920, 1080, 'hash_varanda_001'),
('990e8400-e29b-41d4-a716-446655440016', '770e8400-e29b-41d4-a716-446655440004', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=luxury%20penthouse%20living%20room%20high%20end%20finishes%20marble%20floor&image_size=landscape_16_9', 'Sala da cobertura', 'Sala', 312320, 'jpg', true, 1920, 1080, 'hash_cobertura_001'),
('990e8400-e29b-41d4-a716-446655440017', '770e8400-e29b-41d4-a716-446655440005', 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20warehouse%20interior%20high%20ceiling%20concrete%20floor%20storage&image_size=landscape_16_9', 'Interior do galpão', 'Área Industrial', 345088, 'jpg', true, 1920, 1080, 'hash_galpao_001')
ON CONFLICT (id) DO NOTHING;

-- Adicionar itens de vistoria detalhados
INSERT INTO itens_vistoria (id, vistoria_id, ambiente, item, estado, observacoes) VALUES
-- Itens da casa no Jardim Botânico
('aa0e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'Sala', 'Piso laminado', 'Bom', 'Sem riscos ou danos visíveis'),
('aa0e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440001', 'Sala', 'Paredes', 'Ótimo', 'Pintura recente, sem manchas'),
('aa0e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440001', 'Cozinha', 'Armários', 'Ótimo', 'Armários novos, todas as portas funcionando'),
('aa0e8400-e29b-41d4-a716-446655440004', '770e8400-e29b-41d4-a716-446655440001', 'Cozinha', 'Pia', 'Bom', 'Granito em bom estado, torneira funcionando'),
('aa0e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440001', 'Quarto', 'Guarda-roupa', 'Bom', 'Todas as portas e gavetas funcionando'),
('aa0e8400-e29b-41d4-a716-446655440006', '770e8400-e29b-41d4-a716-446655440001', 'Banheiro', 'Azulejos', 'Ótimo', 'Azulejos limpos, sem trincas'),

-- Itens da loja (finalizada)
('aa0e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440003', 'Área Principal', 'Piso cerâmico', 'Bom', 'Algumas peças com pequenos riscos'),
('aa0e8400-e29b-41d4-a716-446655440008', '770e8400-e29b-41d4-a716-446655440003', 'Área Principal', 'Iluminação', 'Ótimo', 'Todas as lâmpadas LED funcionando'),
('aa0e8400-e29b-41d4-a716-446655440009', '770e8400-e29b-41d4-a716-446655440003', 'Estoque', 'Prateleiras', 'Bom', 'Estrutura sólida, sem danos'),
('aa0e8400-e29b-41d4-a716-446655440010', '770e8400-e29b-41d4-a716-446655440003', 'Entrada', 'Porta de vidro', 'Bom', 'Vidro sem trincas, fechadura funcionando'),

-- Itens da casa Vila Madalena (com alguns danos)
('aa0e8400-e29b-41d4-a716-446655440011', '770e8400-e29b-41d4-a716-446655440006', 'Sala', 'Paredes', 'Regular', 'Marcas de móveis e pequenos furos de pregos'),
('aa0e8400-e29b-41d4-a716-446655440012', '770e8400-e29b-41d4-a716-446655440006', 'Sala', 'Piso de madeira', 'Bom', 'Alguns riscos superficiais'),
('aa0e8400-e29b-41d4-a716-446655440013', '770e8400-e29b-41d4-a716-446655440006', 'Cozinha', 'Porta do armário', 'Regular', 'Uma porta com dobradiça solta'),
('aa0e8400-e29b-41d4-a716-446655440014', '770e8400-e29b-41d4-a716-446655440006', 'Cozinha', 'Bancada', 'Regular', 'Pequenos riscos na superfície'),
('aa0e8400-e29b-41d4-a716-446655440015', '770e8400-e29b-41d4-a716-446655440006', 'Quarto', 'Carpete', 'Ruim', 'Manchas e desgaste visível'),
('aa0e8400-e29b-41d4-a716-446655440016', '770e8400-e29b-41d4-a716-446655440006', 'Banheiro', 'Azulejos', 'Regular', 'Algumas peças trincadas')
ON CONFLICT (id) DO NOTHING;

-- Inserir configuração de storage otimizada
INSERT INTO storage_config (max_file_size, compression_quality, thumbnail_size, auto_compress)
VALUES (15728640, 85, 400, true) -- 15MB, qualidade 85%, thumbnail 400px
ON CONFLICT DO NOTHING;

-- Atualizar usuário existente com novos tipos
UPDATE users SET 
  user_type = 'empresa_admin',
  can_create_vistorias = true,
  can_view_all_company_data = true
WHERE email = 'admin@vistoriatech.com';

-- Estatísticas finais
DO $$
DECLARE
    total_empresas INTEGER;
    total_usuarios INTEGER;
    total_imoveis INTEGER;
    total_vistorias INTEGER;
    total_fotos INTEGER;
    total_itens INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_empresas FROM empresas;
    SELECT COUNT(*) INTO total_usuarios FROM users;
    SELECT COUNT(*) INTO total_imoveis FROM imoveis;
    SELECT COUNT(*) INTO total_vistorias FROM vistorias;
    SELECT COUNT(*) INTO total_fotos FROM fotos;
    SELECT COUNT(*) INTO total_itens FROM itens_vistoria;
    
    RAISE NOTICE '=== DADOS DE EXEMPLO EXPANDIDOS ===';
    RAISE NOTICE 'Empresas: %', total_empresas;
    RAISE NOTICE 'Usuários: %', total_usuarios;
    RAISE NOTICE 'Imóveis: %', total_imoveis;
    RAISE NOTICE 'Vistorias: %', total_vistorias;
    RAISE NOTICE 'Fotos: %', total_fotos;
    RAISE NOTICE 'Itens de Vistoria: %', total_itens;
    RAISE NOTICE '=================================';
END $$;