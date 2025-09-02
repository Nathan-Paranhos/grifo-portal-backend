-- Criar usuário de teste no Supabase Auth e nas tabelas de usuários

-- Primeiro, criar empresa de teste
INSERT INTO empresas (
  id,
  nome,
  endereco,
  telefone,
  email,
  created_at,
  updated_at
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  'Empresa Teste',
  'Rua Teste, 123',
  '(11) 99999-9999',
  'empresa@test.com',
  NOW(),
  NOW()
);

-- Inserir na tabela auth.users (Supabase Auth)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@test.com',
  '$2a$10$8K1p/a0dUrZBvHEHdBVKoOuVYXqb67uL/XALzjSwVeSWJbQd6Ba8m', -- password: 'password'
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Inserir usuário admin na tabela app_users
INSERT INTO app_users (
  id,
  nome,
  email,
  empresa_id,
  role,
  ativo,
  auth_user_id,
  created_at,
  updated_at
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Admin Teste',
  'admin@test.com',
  '44444444-4444-4444-4444-444444444444',
  'admin',
  true,
  '11111111-1111-1111-1111-111111111111',
  NOW(),
  NOW()
);

-- Inserir usuário cliente na tabela clients
INSERT INTO clients (
  id,
  name,
  email,
  tenant,
  password_hash,
  is_active,
  created_at,
  updated_at
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  'Cliente Teste',
  'cliente@test.com',
  'tenant_123',
  '$2a$10$8K1p/a0dUrZBvHEHdBVKoOuVYXqb67uL/XALzjSwVeSWJbQd6Ba8m',
  true,
  NOW(),
  NOW()
);

-- Criar segundo usuário no Supabase Auth para o cliente
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'cliente@test.com',
  '$2a$10$8K1p/a0dUrZBvHEHdBVKoOuVYXqb67uL/XALzjSwVeSWJbQd6Ba8m', -- password: 'password'
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);