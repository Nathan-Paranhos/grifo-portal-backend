-- Corrigir senha do usuário de teste
-- Atualizar senha do usuário vistoriador.teste@grifo.com

UPDATE auth.users 
SET 
  encrypted_password = crypt('123456', gen_salt('bf')),
  email_confirmed_at = now(),
  updated_at = now()
WHERE email = 'vistoriador.teste@grifo.com';

-- Atualizar senha do usuário gestor.teste@grifo.com
UPDATE auth.users 
SET 
  encrypted_password = crypt('123456', gen_salt('bf')),
  email_confirmed_at = now(),
  updated_at = now()
WHERE email = 'gestor.teste@grifo.com';

-- Verificar se as atualizações foram aplicadas
SELECT 
  email,
  email_confirmed_at IS NOT NULL as email_confirmed,
  created_at
FROM auth.users 
WHERE email IN ('vistoriador.teste@grifo.com', 'gestor.teste@grifo.com');