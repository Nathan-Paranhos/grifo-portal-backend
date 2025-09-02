-- Corrigir o status de primeiro login do usuário administrador
-- Marcar como primeiro login já completado

UPDATE portal_users 
SET first_login_completed = true,
    updated_at = NOW()
WHERE email = 'admin@grifo.com';