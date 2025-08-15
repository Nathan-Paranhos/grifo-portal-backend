-- Grifo Vistorias - Dados Iniciais (Seeds)
-- Baseado na arquitetura multi-tenant especificada no prompt.md

-- Inserir empresa de exemplo
INSERT INTO companies (
  id,
  name,
  slug,
  email,
  phone,
  address,
  settings
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Grifo Vistorias Demo',
  'grifo-demo',
  'contato@grifodemo.com.br',
  '(11) 99999-9999',
  '{
    "street": "Rua das Flores, 123",
    "number": "123",
    "complement": "Sala 456",
    "neighborhood": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "zip": "01234-567",
    "country": "Brasil"
  }'::jsonb,
  '{
    "notifications": {
      "email": true,
      "push": true,
      "sms": false
    },
    "inspection_settings": {
      "auto_assign": false,
      "require_photos": true,
      "max_photos_per_inspection": 50,
      "allow_video": true
    },
    "business_hours": {
      "monday": {"start": "08:00", "end": "18:00", "enabled": true},
      "tuesday": {"start": "08:00", "end": "18:00", "enabled": true},
      "wednesday": {"start": "08:00", "end": "18:00", "enabled": true},
      "thursday": {"start": "08:00", "end": "18:00", "enabled": true},
      "friday": {"start": "08:00", "end": "18:00", "enabled": true},
      "saturday": {"start": "08:00", "end": "12:00", "enabled": false},
      "sunday": {"start": "08:00", "end": "12:00", "enabled": false}
    }
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Inserir usuários de exemplo
-- Admin da empresa
INSERT INTO users (
  id,
  supabase_uid,
  email,
  name,
  phone
) VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  'admin-demo-uid-123',
  'admin@grifodemo.com.br',
  'João Silva',
  '(11) 98888-8888'
)
ON CONFLICT (supabase_uid) DO NOTHING;

-- Manager da empresa
INSERT INTO users (
  id,
  supabase_uid,
  email,
  name,
  phone
) VALUES (
  '660e8400-e29b-41d4-a716-446655440002',
  'manager-demo-uid-456',
  'manager@grifodemo.com.br',
  'Maria Santos',
  '(11) 97777-7777'
)
ON CONFLICT (supabase_uid) DO NOTHING;

-- Inspetor da empresa
INSERT INTO users (
  id,
  supabase_uid,
  email,
  name,
  phone
) VALUES (
  '660e8400-e29b-41d4-a716-446655440003',
  'inspector-demo-uid-789',
  'inspetor@grifodemo.com.br',
  'Carlos Oliveira',
  '(11) 96666-6666'
)
ON CONFLICT (supabase_uid) DO NOTHING;

-- Atendente da empresa
INSERT INTO users (
  id,
  supabase_uid,
  email,
  name,
  phone
) VALUES (
  '660e8400-e29b-41d4-a716-446655440004',
  'attendant-demo-uid-101',
  'atendente@grifodemo.com.br',
  'Ana Costa',
  '(11) 95555-5555'
)
ON CONFLICT (supabase_uid) DO NOTHING;

-- Vincular usuários à empresa
INSERT INTO company_members (
  company_id,
  user_id,
  role
) VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 'admin'),
  ('550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440002', 'manager'),
  ('550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440003', 'inspector'),
  ('550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440004', 'attendant')
ON CONFLICT (company_id, user_id) DO NOTHING;

-- Inserir propriedades de exemplo
INSERT INTO properties (
  id,
  company_id,
  title,
  description,
  address,
  property_type,
  metadata
) VALUES 
  (
    '770e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440000',
    'Apartamento Centro - Edifício São Paulo',
    'Apartamento de 2 dormitórios no centro da cidade',
    '{
      "street": "Rua Augusta",
      "number": "1500",
      "complement": "Apto 45",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "zip": "01305-100",
      "country": "Brasil"
    }'::jsonb,
    'apartment',
    '{
      "bedrooms": 2,
      "bathrooms": 1,
      "area": 65,
      "floor": 4,
      "building": "Edifício São Paulo",
      "parking_spaces": 1,
      "furnished": false
    }'::jsonb
  ),
  (
    '770e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440000',
    'Casa Jardins - Residencial Premium',
    'Casa térrea com jardim e piscina',
    '{
      "street": "Rua dos Jardins",
      "number": "789",
      "complement": "",
      "neighborhood": "Jardins",
      "city": "São Paulo",
      "state": "SP",
      "zip": "01234-567",
      "country": "Brasil"
    }'::jsonb,
    'house',
    '{
      "bedrooms": 3,
      "bathrooms": 2,
      "area": 180,
      "lot_area": 300,
      "garage": true,
      "pool": true,
      "garden": true
    }'::jsonb
  ),
  (
    '770e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440000',
    'Sala Comercial - Edifício Corporate',
    'Sala comercial para escritório',
    '{
      "street": "Avenida Paulista",
      "number": "2000",
      "complement": "Sala 1205",
      "neighborhood": "Bela Vista",
      "city": "São Paulo",
      "state": "SP",
      "zip": "01310-100",
      "country": "Brasil"
    }'::jsonb,
    'commercial',
    '{
      "area": 45,
      "floor": 12,
      "building": "Edifício Corporate",
      "parking_spaces": 2,
      "air_conditioning": true,
      "furnished": true
    }'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Inserir vistorias de exemplo
INSERT INTO inspections (
  id,
  company_id,
  property_id,
  inspector_id,
  requester_name,
  requester_email,
  requester_phone,
  inspection_type,
  status,
  scheduled_date,
  notes,
  metadata
) VALUES 
  (
    '880e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440000',
    '770e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440003',
    'Pedro Almeida',
    'pedro@email.com',
    '(11) 94444-4444',
    'entry',
    'completed',
    NOW() - INTERVAL '2 days',
    'Vistoria de entrada realizada com sucesso',
    '{
      "priority": "normal",
      "estimated_duration": 120,
      "special_requirements": ["Chaves com porteiro", "Horário comercial"]
    }'::jsonb
  ),
  (
    '880e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440000',
    '770e8400-e29b-41d4-a716-446655440002',
    '660e8400-e29b-41d4-a716-446655440003',
    'Lucia Ferreira',
    'lucia@email.com',
    '(11) 93333-3333',
    'exit',
    'scheduled',
    NOW() + INTERVAL '1 day',
    'Vistoria de saída agendada',
    '{
      "priority": "high",
      "estimated_duration": 90,
      "special_requirements": ["Verificar piscina", "Jardim"]
    }'::jsonb
  ),
  (
    '880e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440000',
    '770e8400-e29b-41d4-a716-446655440003',
    NULL,
    'Roberto Silva',
    'roberto@empresa.com',
    '(11) 92222-2222',
    'maintenance',
    'pending',
    NULL,
    'Vistoria para manutenção preventiva',
    '{
      "priority": "normal",
      "estimated_duration": 60,
      "special_requirements": ["Acesso ao prédio comercial"]
    }'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Inserir uploads de exemplo
INSERT INTO uploads (
  id,
  company_id,
  inspection_id,
  uploaded_by,
  file_name,
  file_path,
  file_type,
  file_size,
  metadata
) VALUES 
  (
    '990e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440000',
    '880e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440003',
    'foto_sala_principal.jpg',
    '550e8400-e29b-41d4-a716-446655440000/images/2024/01/15/880e8400-e29b-41d4-a716-446655440001/foto_sala_principal.jpg',
    'image',
    1024000,
    '{
      "width": 1920,
      "height": 1080,
      "camera_info": "iPhone 12 Pro",
      "location": "Sala Principal",
      "timestamp": "2024-01-15T10:30:00Z"
    }'::jsonb
  ),
  (
    '990e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440000',
    '880e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440003',
    'foto_cozinha.jpg',
    '550e8400-e29b-41d4-a716-446655440000/images/2024/01/15/880e8400-e29b-41d4-a716-446655440001/foto_cozinha.jpg',
    'image',
    856000,
    '{
      "width": 1920,
      "height": 1080,
      "camera_info": "iPhone 12 Pro",
      "location": "Cozinha",
      "timestamp": "2024-01-15T10:35:00Z"
    }'::jsonb
  ),
  (
    '990e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440000',
    '880e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440003',
    'relatorio_vistoria.pdf',
    '550e8400-e29b-41d4-a716-446655440000/documents/2024/01/15/880e8400-e29b-41d4-a716-446655440001/relatorio_vistoria.pdf',
    'document',
    2048000,
    '{
      "pages": 5,
      "generated_by": "Grifo Vistorias App",
      "template_version": "1.0",
      "timestamp": "2024-01-15T11:00:00Z"
    }'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Inserir notificações de exemplo
INSERT INTO notifications (
  id,
  company_id,
  user_id,
  title,
  body,
  data,
  is_read
) VALUES 
  (
    'aa0e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440003',
    'Nova Vistoria Agendada',
    'Você tem uma nova vistoria agendada para amanhã às 14:00',
    '{
      "inspection_id": "880e8400-e29b-41d4-a716-446655440002",
      "property_title": "Casa Jardins - Residencial Premium",
      "scheduled_date": "2024-01-16T14:00:00Z",
      "type": "inspection_scheduled"
    }'::jsonb,
    false
  ),
  (
    'aa0e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440001',
    'Vistoria Concluída',
    'A vistoria do Apartamento Centro foi concluída com sucesso',
    '{
      "inspection_id": "880e8400-e29b-41d4-a716-446655440001",
      "property_title": "Apartamento Centro - Edifício São Paulo",
      "completed_date": "2024-01-13T16:30:00Z",
      "type": "inspection_completed"
    }'::jsonb,
    true
  ),
  (
    'aa0e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440002',
    'Nova Solicitação de Vistoria',
    'Uma nova vistoria foi solicitada e está aguardando atribuição',
    '{
      "inspection_id": "880e8400-e29b-41d4-a716-446655440003",
      "property_title": "Sala Comercial - Edifício Corporate",
      "requested_date": "2024-01-15T09:00:00Z",
      "type": "inspection_requested"
    }'::jsonb,
    false
  )
ON CONFLICT (id) DO NOTHING;

-- Inserir configurações da empresa
INSERT INTO settings (
  id,
  company_id,
  category,
  key,
  value,
  description
) VALUES 
  (
    'bb0e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440000',
    'notifications',
    'email_enabled',
    'true',
    'Habilitar notificações por email'
  ),
  (
    'bb0e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440000',
    'notifications',
    'push_enabled',
    'true',
    'Habilitar notificações push'
  ),
  (
    'bb0e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440000',
    'inspections',
    'auto_assign_inspectors',
    'false',
    'Atribuir automaticamente inspetores às vistorias'
  ),
  (
    'bb0e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440000',
    'inspections',
    'require_photos',
    'true',
    'Exigir fotos nas vistorias'
  ),
  (
    'bb0e8400-e29b-41d4-a716-446655440005',
    '550e8400-e29b-41d4-a716-446655440000',
    'inspections',
    'max_photos_per_inspection',
    '50',
    'Número máximo de fotos por vistoria'
  )
ON CONFLICT (id) DO NOTHING;

-- Inserir contestação de exemplo
INSERT INTO contestations (
  id,
  company_id,
  inspection_id,
  submitted_by,
  reason,
  description,
  status,
  metadata
) VALUES (
  'cc0e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440000',
  '880e8400-e29b-41d4-a716-446655440001',
  '660e8400-e29b-41d4-a716-446655440004',
  'incorrect_damage_assessment',
  'O dano relatado na parede da sala não existia no momento da vistoria de entrada. Solicito revisão do laudo.',
  'open',
  '{
    "priority": "high",
    "evidence_files": ["foto_parede_entrada.jpg", "video_sala_completa.mp4"],
    "estimated_resolution_days": 5
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;