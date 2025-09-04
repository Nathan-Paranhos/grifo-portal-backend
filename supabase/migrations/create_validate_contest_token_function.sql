-- Remover função existente se houver
DROP FUNCTION IF EXISTS validate_contest_token(TEXT);

-- Função para validar token de contestação
CREATE OR REPLACE FUNCTION validate_contest_token(p_token TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  contest_link_id UUID,
  vistoria_id UUID,
  empresa_id UUID,
  expires_at TIMESTAMPTZ,
  is_used BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN cl.id IS NULL THEN FALSE
      WHEN cl.expires_at < NOW() THEN FALSE
      WHEN cl.is_used = TRUE THEN FALSE
      ELSE TRUE
    END as is_valid,
    cl.id as contest_link_id,
    cl.vistoria_id,
    cl.empresa_id,
    cl.expires_at,
    COALESCE(cl.is_used, FALSE) as is_used
  FROM contest_links cl
  WHERE cl.token = p_token;
  
  -- Se não encontrou nenhum registro, retorna um registro com is_valid = FALSE
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      FALSE as is_valid,
      NULL::UUID as contest_link_id,
      NULL::UUID as vistoria_id,
      NULL::UUID as empresa_id,
      NULL::TIMESTAMPTZ as expires_at,
      FALSE as is_used;
  END IF;
END;
$$;

-- Testar a função com o token criado
SELECT * FROM validate_contest_token('test-token-abc123');