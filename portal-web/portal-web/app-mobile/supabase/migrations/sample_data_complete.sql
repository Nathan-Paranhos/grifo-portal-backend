-- Dados de exemplo para demonstração do aplicativo
-- Inserir apenas empresas e imóveis (usuários devem ser criados via autenticação)

-- Inserir empresas de exemplo
INSERT INTO empresas (id, nome, cnpj, endereco, telefone, email, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Grifo Vistorias Ltda', '12.345.678/0001-90', 'Rua Augusta, 1234 - Consolação, São Paulo - SP, 01305-100', '(11) 3456-7890', 'contato@grifovistorias.com.br', NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'Vistoria Express', '23.456.789/0001-01', 'Av. Paulista, 2000 - Bela Vista, São Paulo - SP, 01310-200', '(11) 2345-6789', 'info@vistoriaexpress.com.br', NOW()),
('550e8400-e29b-41d4-a716-446655440003', 'Inspeções RJ', '34.567.890/0001-12', 'Rua das Laranjeiras, 300 - Laranjeiras, Rio de Janeiro - RJ, 22240-000', '(21) 3456-7890', 'contato@inspecoesrj.com.br', NOW())
ON CONFLICT (id) DO NOTHING;

-- Inserir imóveis residenciais
INSERT INTO imoveis (id, codigo, endereco, tipo, cep, cidade, estado, empresa_id, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440021', 'RES-001', 'Rua das Flores, 123 - Vila Madalena', 'residencial', '05433-010', 'São Paulo', 'SP', '550e8400-e29b-41d4-a716-446655440001', NOW()),
('550e8400-e29b-41d4-a716-446655440022', 'RES-002', 'Av. Brigadeiro Faria Lima, 4567 - Itaim Bibi', 'residencial', '04538-133', 'São Paulo', 'SP', '550e8400-e29b-41d4-a716-446655440001', NOW()),
('550e8400-e29b-41d4-a716-446655440023', 'RES-003', 'Rua Oscar Freire, 890 - Jardins', 'residencial', '01426-001', 'São Paulo', 'SP', '550e8400-e29b-41d4-a716-446655440001', NOW()),
('550e8400-e29b-41d4-a716-446655440024', 'RES-004', 'Rua Harmonia, 456 - Vila Madalena', 'residencial', '05435-000', 'São Paulo', 'SP', '550e8400-e29b-41d4-a716-446655440002', NOW()),
('550e8400-e29b-41d4-a716-446655440025', 'RES-005', 'Av. Atlântica, 2000 - Copacabana', 'residencial', '22021-001', 'Rio de Janeiro', 'RJ', '550e8400-e29b-41d4-a716-446655440003', NOW())
ON CONFLICT (id) DO NOTHING;

-- Inserir imóveis comerciais
INSERT INTO imoveis (id, codigo, endereco, tipo, cep, cidade, estado, empresa_id, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440026', 'COM-001', 'Av. Paulista, 1500 - Bela Vista', 'comercial', '01310-100', 'São Paulo', 'SP', '550e8400-e29b-41d4-a716-446655440001', NOW()),
('550e8400-e29b-41d4-a716-446655440027', 'COM-002', 'Rua 25 de Março, 800 - Centro', 'comercial', '01021-000', 'São Paulo', 'SP', '550e8400-e29b-41d4-a716-446655440002', NOW()),
('550e8400-e29b-41d4-a716-446655440028', 'COM-003', 'Rua da Carioca, 150 - Centro', 'comercial', '20050-008', 'Rio de Janeiro', 'RJ', '550e8400-e29b-41d4-a716-446655440003', NOW()),
('550e8400-e29b-41d4-a716-446655440029', 'COM-004', 'Av. das Américas, 3000 - Barra da Tijuca', 'comercial', '22640-102', 'Rio de Janeiro', 'RJ', '550e8400-e29b-41d4-a716-446655440003', NOW())
ON CONFLICT (id) DO NOTHING;

-- Inserir imóveis industriais
INSERT INTO imoveis (id, codigo, endereco, tipo, cep, cidade, estado, empresa_id, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440030', 'IND-001', 'Rua Industrial, 1000 - Distrito Industrial', 'industrial', '07223-000', 'Guarulhos', 'SP', '550e8400-e29b-41d4-a716-446655440001', NOW()),
('550e8400-e29b-41d4-a716-446655440031', 'IND-002', 'Av. dos Metalúrgicos, 500', 'industrial', '09750-000', 'São Bernardo do Campo', 'SP', '550e8400-e29b-41d4-a716-446655440002', NOW()),
('550e8400-e29b-41d4-a716-446655440032', 'IND-003', 'Estrada do Porto, 2500 - Sepetiba', 'industrial', '23775-000', 'Rio de Janeiro', 'RJ', '550e8400-e29b-41d4-a716-446655440003', NOW())
ON CONFLICT (id) DO NOTHING;

-- Comentário: Dados básicos inseridos
-- Total: 3 empresas e 12 imóveis variados
-- Usuários devem ser criados via sistema de autenticação
-- Vistorias serão criadas conforme uso do aplicativo