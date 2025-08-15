-- Criar usuário diretamente na tabela portal_users com o ID correto do Supabase Auth

-- Primeiro, verificar empresas existentes
SELECT 'EXISTING COMPANIES' as status, id, nome, cnpj FROM empresas LIMIT 5;

-- Verificar se usuário já existe
SELECT 'EXISTING USER CHECK' as status, id, auth_user_id, email, ativo
FROM portal_users 
WHERE auth_user_id = '424e8e60-5b18-46d4-91e2-80baa090f523';

-- Deletar se existir (para recriar)
DELETE FROM portal_users 
WHERE auth_user_id = '424e8e60-5b18-46d4-91e2-80baa090f523';

-- Criar o usuário na tabela portal_users usando a primeira empresa existente
INSERT INTO portal_users (
  id,
  auth_user_id,
  email,
  nome,
  empresa_id,
  role,
  permissions,
  can_create_vistorias,
  can_edit_vistorias,
  can_view_all_company_data,
  ativo
) 
SELECT 
  gen_random_uuid(),
  '424e8e60-5b18-46d4-91e2-80baa090f523',
  'grifo.admin@teste.com',
  'Admin Grifo Teste',
  e.id,
  'gestor',
  '{}',
  true,
  true,
  true,
  true
FROM empresas e
LIMIT 1;

-- Verificar se foi criado corretamente
SELECT 'CREATED USER' as status, 
       pu.id, pu.auth_user_id, pu.email, pu.nome, pu.ativo, pu.empresa_id,
       e.nome as empresa_nome
FROM portal_users pu
INNER JOIN empresas e ON pu.empresa_id = e.id
WHERE pu.auth_user_id = '424e8e60-5b18-46d4-91e2-80baa090f523';