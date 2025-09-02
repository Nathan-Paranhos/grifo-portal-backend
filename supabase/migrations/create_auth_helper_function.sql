-- Função para buscar usuário por email no auth.users
CREATE OR REPLACE FUNCTION get_auth_user_by_email(user_email text)
RETURNS TABLE(
  id uuid,
  email text,
  created_at timestamptz
)
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT 
    au.id,
    au.email::text,
    au.created_at
  FROM auth.users au
  WHERE au.email = user_email
  AND au.deleted_at IS NULL;
$$;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION get_auth_user_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_user_by_email(text) TO anon;
GRANT EXECUTE ON FUNCTION get_auth_user_by_email(text) TO service_role;