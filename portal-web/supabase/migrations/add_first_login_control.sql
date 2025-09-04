-- Adicionar campos para controle de primeiro login
-- Adiciona campos nas tabelas app_users, portal_users e users para controlar primeiro login

-- Adicionar campo first_login_completed na tabela app_users
ALTER TABLE app_users 
ADD COLUMN IF NOT EXISTS first_login_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Adicionar campo first_login_completed na tabela portal_users
ALTER TABLE portal_users 
ADD COLUMN IF NOT EXISTS first_login_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Adicionar campo first_login_completed na tabela users (se necessário)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_login_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;

-- Comentários para documentar os campos
COMMENT ON COLUMN app_users.first_login_completed IS 'Indica se o usuário já completou o primeiro login e definiu sua senha';
COMMENT ON COLUMN app_users.password_changed_at IS 'Data da última alteração de senha';
COMMENT ON COLUMN app_users.last_login IS 'Data do último login do usuário';

COMMENT ON COLUMN portal_users.first_login_completed IS 'Indica se o usuário já completou o primeiro login e definiu sua senha';
COMMENT ON COLUMN portal_users.password_changed_at IS 'Data da última alteração de senha';
COMMENT ON COLUMN portal_users.last_login IS 'Data do último login do usuário';

COMMENT ON COLUMN users.first_login_completed IS 'Indica se o usuário já completou o primeiro login e definiu sua senha';
COMMENT ON COLUMN users.password_changed_at IS 'Data da última alteração de senha';

-- Atualizar usuários existentes para marcar como primeiro login já completado
-- (assumindo que usuários existentes já têm senhas definidas)
UPDATE app_users SET first_login_completed = TRUE WHERE auth_user_id IS NOT NULL;
UPDATE portal_users SET first_login_completed = TRUE WHERE auth_user_id IS NOT NULL;
UPDATE users SET first_login_completed = TRUE WHERE auth_user_id IS NOT NULL;