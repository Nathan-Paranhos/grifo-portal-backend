-- Verificar se os usuários de teste foram criados corretamente
-- Verificar usuários no Supabase Auth
SELECT 
  'auth.users' as tabela,
  id::text,
  email,
  email_confirmed_at::text,
  created_at::text
FROM auth.users 
WHERE email IN ('vistoriador.teste@grifo.com', 'gestor.teste@grifo.com')

UNION ALL

-- Verificar usuários na tabela portal_users
SELECT 
  'portal_users' as tabela,
  id::text,
  email,
  created_at::text,
  updated_at::text
FROM portal_users 
WHERE email IN ('vistoriador.teste@grifo.com', 'gestor.teste@grifo.com')

ORDER BY tabela, email;