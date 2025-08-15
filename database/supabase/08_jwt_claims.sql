-- Grifo Vistorias - Configuração de JWT Claims Personalizados
-- Claims customizados para separar app_users e portal_users

-- Função para adicionar claims customizados ao JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_data jsonb;
  app_user_data record;
  portal_user_data record;
BEGIN
  -- Extrair claims existentes
  claims := event->'claims';
  
  -- Verificar se é app_user
  SELECT 
    au.id,
    au.empresa_id,
    au.role,
    au.nome,
    au.email,
    e.nome as empresa_nome,
    e.slug as empresa_slug
  INTO app_user_data
  FROM app_users au
  JOIN empresas e ON e.id = au.empresa_id
  WHERE au.auth_user_id = (event->>'user_id')::uuid
  AND au.ativo = true;
  
  IF FOUND THEN
    -- Adicionar claims para app_user
    claims := jsonb_set(claims, '{user_type}', '"app_user"');
    claims := jsonb_set(claims, '{user_id}', to_jsonb(app_user_data.id));
    claims := jsonb_set(claims, '{empresa_id}', to_jsonb(app_user_data.empresa_id));
    claims := jsonb_set(claims, '{empresa_slug}', to_jsonb(app_user_data.empresa_slug));
    claims := jsonb_set(claims, '{role}', to_jsonb(app_user_data.role));
    claims := jsonb_set(claims, '{nome}', to_jsonb(app_user_data.nome));
    claims := jsonb_set(claims, '{email}', to_jsonb(app_user_data.email));
    
    -- Adicionar permissões baseadas no role
    CASE app_user_data.role
      WHEN 'vistoriador' THEN
        claims := jsonb_set(claims, '{permissions}', '["view_inspections", "create_photos", "update_inspections", "view_properties"]');
      WHEN 'supervisor' THEN
        claims := jsonb_set(claims, '{permissions}', '["view_inspections", "create_photos", "update_inspections", "view_properties", "assign_inspections", "view_reports"]');
      ELSE
        claims := jsonb_set(claims, '{permissions}', '["view_inspections", "create_photos"]');
    END CASE;
    
  ELSE
    -- Verificar se é portal_user
    SELECT 
      pu.id,
      pu.empresa_id,
      pu.role,
      pu.nome,
      pu.email,
      e.nome as empresa_nome,
      e.slug as empresa_slug
    INTO portal_user_data
    FROM portal_users pu
    JOIN empresas e ON e.id = pu.empresa_id
    WHERE pu.auth_user_id = (event->>'user_id')::uuid
    AND pu.ativo = true;
    
    IF FOUND THEN
      -- Adicionar claims para portal_user
      claims := jsonb_set(claims, '{user_type}', '"portal_user"');
      claims := jsonb_set(claims, '{user_id}', to_jsonb(portal_user_data.id));
      claims := jsonb_set(claims, '{empresa_id}', to_jsonb(portal_user_data.empresa_id));
      claims := jsonb_set(claims, '{empresa_slug}', to_jsonb(portal_user_data.empresa_slug));
      claims := jsonb_set(claims, '{role}', to_jsonb(portal_user_data.role));
      claims := jsonb_set(claims, '{nome}', to_jsonb(portal_user_data.nome));
      claims := jsonb_set(claims, '{email}', to_jsonb(portal_user_data.email));
      
      -- Adicionar permissões baseadas no role
      CASE portal_user_data.role
        WHEN 'admin' THEN
          claims := jsonb_set(claims, '{permissions}', '["manage_company", "manage_users", "manage_properties", "manage_inspections", "view_reports", "manage_settings"]');
        WHEN 'manager' THEN
          claims := jsonb_set(claims, '{permissions}', '["manage_properties", "manage_inspections", "view_reports", "assign_inspections"]');
        WHEN 'atendente' THEN
          claims := jsonb_set(claims, '{permissions}', '["view_properties", "view_inspections", "create_inspections"]');
        ELSE
          claims := jsonb_set(claims, '{permissions}', '["view_inspections"]');
      END CASE;
    ELSE
      -- Usuário não encontrado em nenhuma tabela
      claims := jsonb_set(claims, '{user_type}', '"unknown"');
      claims := jsonb_set(claims, '{permissions}', '[]');
    END IF;
  END IF;
  
  -- Retornar evento com claims atualizados
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Função para validar JWT claims no lado do servidor
CREATE OR REPLACE FUNCTION validate_jwt_claims()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
  user_type text;
  user_id uuid;
  empresa_id uuid;
  role text;
BEGIN
  -- Extrair claims do JWT atual
  claims := auth.jwt();
  
  user_type := claims->>'user_type';
  user_id := (claims->>'user_id')::uuid;
  empresa_id := (claims->>'empresa_id')::uuid;
  role := claims->>'role';
  
  -- Validar se os claims ainda são válidos
  IF user_type = 'app_user' THEN
    IF NOT EXISTS (
      SELECT 1 FROM app_users 
      WHERE id = user_id 
      AND empresa_id = validate_jwt_claims.empresa_id
      AND role = validate_jwt_claims.role
      AND ativo = true
    ) THEN
      RAISE EXCEPTION 'Invalid JWT claims for app_user';
    END IF;
  ELSIF user_type = 'portal_user' THEN
    IF NOT EXISTS (
      SELECT 1 FROM portal_users 
      WHERE id = user_id 
      AND empresa_id = validate_jwt_claims.empresa_id
      AND role = validate_jwt_claims.role
      AND ativo = true
    ) THEN
      RAISE EXCEPTION 'Invalid JWT claims for portal_user';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown user type in JWT claims';
  END IF;
  
  RETURN claims;
END;
$$;

-- Função para verificar permissão específica
CREATE OR REPLACE FUNCTION has_permission(permission_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
  permissions jsonb;
BEGIN
  claims := auth.jwt();
  permissions := claims->'permissions';
  
  RETURN permissions ? permission_name;
END;
$$;

-- Função para obter dados do usuário atual do JWT
CREATE OR REPLACE FUNCTION get_current_user_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
BEGIN
  claims := auth.jwt();
  
  RETURN jsonb_build_object(
    'user_type', claims->>'user_type',
    'user_id', claims->>'user_id',
    'empresa_id', claims->>'empresa_id',
    'empresa_slug', claims->>'empresa_slug',
    'role', claims->>'role',
    'nome', claims->>'nome',
    'email', claims->>'email',
    'permissions', claims->'permissions'
  );
END;
$$;

-- Função para refresh de claims (quando dados do usuário mudam)
CREATE OR REPLACE FUNCTION refresh_user_claims(user_auth_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Esta função seria chamada quando dados do usuário são atualizados
  -- Para forçar regeneração do JWT na próxima requisição
  
  -- Atualizar timestamp de última modificação
  UPDATE app_users 
  SET updated_at = NOW() 
  WHERE auth_user_id = user_auth_id;
  
  UPDATE portal_users 
  SET updated_at = NOW() 
  WHERE auth_user_id = user_auth_id;
  
  -- Log da operação
  INSERT INTO public.audit_log (table_name, operation, user_id, details)
  VALUES (
    'jwt_claims', 
    'refresh', 
    user_auth_id, 
    jsonb_build_object('action', 'claims_refreshed', 'timestamp', NOW())
  );
END;
$$;

-- Trigger para refresh automático de claims quando usuário é atualizado
CREATE OR REPLACE FUNCTION trigger_refresh_claims()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Refresh claims quando role ou status muda
  IF (TG_OP = 'UPDATE' AND (OLD.role != NEW.role OR OLD.ativo != NEW.ativo)) THEN
    PERFORM refresh_user_claims(NEW.auth_user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplicar triggers
DROP TRIGGER IF EXISTS refresh_app_user_claims ON app_users;
CREATE TRIGGER refresh_app_user_claims
  AFTER UPDATE ON app_users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_claims();

DROP TRIGGER IF EXISTS refresh_portal_user_claims ON portal_users;
CREATE TRIGGER refresh_portal_user_claims
  AFTER UPDATE ON portal_users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_claims();

-- Criar tabela de audit_log se não existir
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,
  user_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT NOW()
);

-- Comentários
COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS 'Hook para adicionar claims customizados ao JWT';
COMMENT ON FUNCTION validate_jwt_claims() IS 'Valida se os claims do JWT ainda são válidos';
COMMENT ON FUNCTION has_permission(text) IS 'Verifica se o usuário atual tem uma permissão específica';
COMMENT ON FUNCTION get_current_user_data() IS 'Retorna dados do usuário atual extraídos do JWT';
COMMENT ON FUNCTION refresh_user_claims(uuid) IS 'Força refresh dos claims do usuário';