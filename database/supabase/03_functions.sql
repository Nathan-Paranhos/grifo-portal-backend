-- Grifo Vistorias - Funções Auxiliares
-- Baseado na arquitetura multi-tenant especificada no prompt.md

-- Função para gerar slug único para empresas
CREATE OR REPLACE FUNCTION generate_unique_slug(company_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Gera slug base removendo acentos e caracteres especiais
  base_slug := lower(trim(regexp_replace(
    unaccent(company_name), 
    '[^a-zA-Z0-9\s]', '', 'g'
  )));
  
  -- Substitui espaços por hífens
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  
  -- Remove hífens duplos
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  
  -- Remove hífens no início e fim
  base_slug := trim(base_slug, '-');
  
  -- Limita a 50 caracteres
  base_slug := left(base_slug, 50);
  
  final_slug := base_slug;
  
  -- Verifica se o slug já existe e adiciona contador se necessário
  WHILE EXISTS(SELECT 1 FROM companies WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Função para criar usuário e vinculá-lo a uma empresa
CREATE OR REPLACE FUNCTION create_user_with_company(
  p_supabase_uid TEXT,
  p_email TEXT,
  p_name TEXT,
  p_phone TEXT,
  p_company_id UUID,
  p_role user_role DEFAULT 'attendant'
)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Insere ou atualiza o usuário
  INSERT INTO users (supabase_uid, email, name, phone)
  VALUES (p_supabase_uid, p_email, p_name, p_phone)
  ON CONFLICT (supabase_uid) 
  DO UPDATE SET 
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    updated_at = NOW()
  RETURNING id INTO user_id;
  
  -- Cria o vínculo com a empresa se não existir
  INSERT INTO company_members (company_id, user_id, role)
  VALUES (p_company_id, user_id, p_role)
  ON CONFLICT (company_id, user_id) 
  DO UPDATE SET role = EXCLUDED.role;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql;

-- Função para obter estatísticas do dashboard de uma empresa
CREATE OR REPLACE FUNCTION get_company_dashboard_stats(p_company_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'properties', (
      SELECT json_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE status = 'active'),
        'inactive', COUNT(*) FILTER (WHERE status != 'active')
      )
      FROM properties 
      WHERE company_id = p_company_id
    ),
    'inspections', (
      SELECT json_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status = 'pending'),
        'scheduled', COUNT(*) FILTER (WHERE status = 'scheduled'),
        'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'canceled', COUNT(*) FILTER (WHERE status = 'canceled')
      )
      FROM inspections 
      WHERE company_id = p_company_id
    ),
    'contestations', (
      SELECT json_build_object(
        'total', COUNT(*),
        'open', COUNT(*) FILTER (WHERE status = 'open'),
        'in_review', COUNT(*) FILTER (WHERE status = 'in_review'),
        'resolved', COUNT(*) FILTER (WHERE status = 'resolved'),
        'rejected', COUNT(*) FILTER (WHERE status = 'rejected')
      )
      FROM contestations 
      WHERE company_id = p_company_id
    ),
    'users', (
      SELECT json_build_object(
        'total', COUNT(*),
        'admins', COUNT(*) FILTER (WHERE role = 'admin'),
        'managers', COUNT(*) FILTER (WHERE role = 'manager'),
        'attendants', COUNT(*) FILTER (WHERE role = 'attendant'),
        'inspectors', COUNT(*) FILTER (WHERE role = 'inspector'),
        'viewers', COUNT(*) FILTER (WHERE role = 'viewer')
      )
      FROM company_members 
      WHERE company_id = p_company_id
    ),
    'recent_activity', (
      SELECT json_agg(
        json_build_object(
          'type', 'inspection',
          'id', i.id,
          'title', p.title,
          'status', i.status,
          'created_at', i.created_at,
          'updated_at', i.updated_at
        )
      )
      FROM inspections i
      JOIN properties p ON p.id = i.property_id
      WHERE i.company_id = p_company_id
      ORDER BY i.updated_at DESC
      LIMIT 10
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Função para notificar inspetores sobre nova vistoria
CREATE OR REPLACE FUNCTION notify_inspectors_new_inspection(
  p_inspection_id UUID
)
RETURNS VOID AS $$
DECLARE
  inspection_record RECORD;
  inspector_record RECORD;
BEGIN
  -- Busca dados da vistoria
  SELECT 
    i.id,
    i.company_id,
    c.name as company_name,
    c.slug as tenant,
    p.title as property_title,
    p.address as property_address
  INTO inspection_record
  FROM inspections i
  JOIN companies c ON c.id = i.company_id
  JOIN properties p ON p.id = i.property_id
  WHERE i.id = p_inspection_id;
  
  -- Notifica todos os inspetores da empresa
  FOR inspector_record IN
    SELECT u.id as user_id
    FROM company_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.company_id = inspection_record.company_id
    AND cm.role = 'inspector'
    AND u.is_active = true
  LOOP
    INSERT INTO notifications (
      company_id,
      user_id,
      title,
      body,
      data
    ) VALUES (
      inspection_record.company_id,
      inspector_record.user_id,
      'Nova Vistoria Disponível',
      'Uma nova vistoria foi solicitada para ' || inspection_record.property_title,
      json_build_object(
        'inspection_id', inspection_record.id,
        'company_name', inspection_record.company_name,
        'tenant', inspection_record.tenant,
        'property_title', inspection_record.property_title,
        'property_address', inspection_record.property_address
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função para marcar notificações como lidas
CREATE OR REPLACE FUNCTION mark_notifications_as_read(
  p_user_id UUID,
  p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Marca todas as notificações do usuário como lidas
    UPDATE notifications 
    SET is_read = true 
    WHERE user_id = p_user_id AND is_read = false;
  ELSE
    -- Marca apenas as notificações especificadas como lidas
    UPDATE notifications 
    SET is_read = true 
    WHERE user_id = p_user_id 
    AND id = ANY(p_notification_ids) 
    AND is_read = false;
  END IF;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Função para limpar notificações antigas
CREATE OR REPLACE FUNCTION cleanup_old_notifications(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications 
  WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep
  AND is_read = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para validar endereço JSON
CREATE OR REPLACE FUNCTION validate_address_json(address_json JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    address_json ? 'street' AND
    address_json ? 'number' AND
    address_json ? 'city' AND
    address_json ? 'state' AND
    address_json ? 'zip' AND
    length(address_json->>'street') > 0 AND
    length(address_json->>'city') > 0 AND
    length(address_json->>'state') > 0 AND
    length(address_json->>'zip') > 0
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar endereços ao inserir/atualizar propriedades
CREATE OR REPLACE FUNCTION validate_property_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT validate_address_json(NEW.address) THEN
    RAISE EXCEPTION 'Endereço inválido. Campos obrigatórios: street, number, city, state, zip';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_property_address_trigger
  BEFORE INSERT OR UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION validate_property_address();

-- Trigger para notificar inspetores automaticamente
CREATE OR REPLACE FUNCTION auto_notify_inspectors()
RETURNS TRIGGER AS $$
BEGIN
  -- Só notifica quando uma nova vistoria é criada
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    PERFORM notify_inspectors_new_inspection(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_notify_inspectors_trigger
  AFTER INSERT ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION auto_notify_inspectors();