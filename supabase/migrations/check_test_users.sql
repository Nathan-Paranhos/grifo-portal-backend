-- Verificar se os usuários de teste foram criados corretamente
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data,
  aud,
  role
FROM auth.users 
WHERE email IN ('vistoriador.teste@grifo.com', 'gestor.teste@grifo.com')
ORDER BY created_at DESC;