-- =====================================================
-- CORREÇÃO DA FUNÇÃO DE GERAÇÃO DE TOKEN
-- =====================================================
-- Corrige a ambiguidade na coluna 'token' na função generate_contest_token

-- Função para gerar token único (corrigida)
CREATE OR REPLACE FUNCTION generate_contest_token()
RETURNS TEXT AS $$
DECLARE
  new_token TEXT;
  exists_token BOOLEAN;
BEGIN
  LOOP
    -- Gerar token de 32 caracteres
    new_token := encode(gen_random_bytes(24), 'base64');
    -- Remover caracteres especiais e deixar apenas alfanuméricos
    new_token := regexp_replace(new_token, '[^a-zA-Z0-9]', '', 'g');
    -- Garantir que tem pelo menos 32 caracteres
    IF length(new_token) < 32 THEN
      new_token := new_token || encode(gen_random_bytes(8), 'hex');
    END IF;
    -- Truncar para 32 caracteres
    new_token := substring(new_token from 1 for 32);
    
    -- Verificar se o token já existe
    SELECT EXISTS(SELECT 1 FROM contest_links WHERE contest_links.token = new_token) INTO exists_token;
    
    -- Se não existe, sair do loop
    IF NOT exists_token THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN new_token;
END;
$$ LANGUAGE plpgsql;