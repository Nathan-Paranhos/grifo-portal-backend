-- Debug: Verificar usuários de teste no Supabase Auth
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  last_sign_in_at,
  encrypted_password IS NOT NULL as has_password
FROM auth.users 
WHERE email IN ('vistoriador.teste@grifo.com', 'gestor.teste@grifo.com')
ORDER BY email;

-- Verificar usuários na tabela portal_users
SELECT 
  pu.id,
  pu.email,
  pu.nome,
  pu.auth_user_id,
  pu.ativo,
  pu.empresa_id,
  e.nome as empresa_nome
FROM portal_users pu
LEFT JOIN empresas e ON pu.empresa_id = e.id
WHERE pu.email IN ('vistoriador.teste@grifo.com', 'gestor.teste@grifo.com')
ORDER BY pu.email;