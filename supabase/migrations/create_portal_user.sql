-- Primeiro, vamos ver se já existe um usuário portal com esse email
SELECT * FROM portal_users WHERE email = 'paranhoscontato.n@gmail.com';

-- Se não existir, vamos criar um usuário portal sem auth_user_id por enquanto
INSERT INTO portal_users (
  email,
  nome,
  role,
  permissions,
  ativo,
  first_login_completed
) VALUES (
  'paranhoscontato.n@gmail.com',
  'Super Admin',
  'super_admin',
  '{"all": true}'::jsonb,
  true,
  true
)
ON CONFLICT (email) DO UPDATE SET
  nome = EXCLUDED.nome,
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  ativo = EXCLUDED.ativo,
  first_login_completed = EXCLUDED.first_login_completed;

-- Verificar o resultado
SELECT * FROM portal_users WHERE email = 'paranhoscontato.n@gmail.com';