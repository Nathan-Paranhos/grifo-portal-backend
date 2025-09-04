-- Ajustar fluxo: empresas cadastram vistorias, usuários do app apenas recebem
-- Implementar roles e permissões adequadas

-- Criar enum para tipos de usuário
CREATE TYPE user_type AS ENUM ('empresa_admin', 'empresa_user', 'vistoriador_app');

-- Adicionar campo user_type na tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_type user_type DEFAULT 'vistoriador_app',
ADD COLUMN IF NOT EXISTS can_create_vistorias BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_edit_vistorias BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_view_all_company_data BOOLEAN DEFAULT false;

-- Atualizar usuários existentes baseado no role atual
UPDATE users 
SET 
  user_type = CASE 
    WHEN role = 'admin' THEN 'empresa_admin'::user_type
    WHEN role = 'empresa' THEN 'empresa_user'::user_type
    ELSE 'vistoriador_app'::user_type
  END,
  can_create_vistorias = CASE 
    WHEN role IN ('admin', 'empresa') THEN true
    ELSE false
  END,
  can_view_all_company_data = CASE 
    WHEN role = 'admin' THEN true
    ELSE false
  END;

-- Criar tabela para controle de atribuição de vistorias
CREATE TABLE IF NOT EXISTS vistoria_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vistoria_id UUID REFERENCES vistorias(id) ON DELETE CASCADE,
    vistoriador_id UUID REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'in_progress', 'completed', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(vistoria_id, vistoriador_id)
);

-- Criar tabela para notificações
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    data JSONB,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar função para notificar vistoriador quando receber nova vistoria
CREATE OR REPLACE FUNCTION notify_vistoriador_new_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Inserir notificação para o vistoriador
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
        NEW.vistoriador_id,
        'Nova Vistoria Atribuída',
        'Você recebeu uma nova vistoria para realizar.',
        'info',
        jsonb_build_object(
            'vistoria_id', NEW.vistoria_id,
            'assignment_id', NEW.id,
            'action', 'view_vistoria'
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para notificações
DROP TRIGGER IF EXISTS trigger_notify_new_assignment ON vistoria_assignments;
CREATE TRIGGER trigger_notify_new_assignment
    AFTER INSERT ON vistoria_assignments
    FOR EACH ROW
    EXECUTE FUNCTION notify_vistoriador_new_assignment();

-- Atualizar RLS policies para o novo fluxo

-- Policy para vistorias: empresas podem criar, vistoriadores apenas visualizar as suas
DROP POLICY IF EXISTS "vistorias_policy" ON vistorias;
CREATE POLICY "vistorias_policy" ON vistorias
    FOR ALL USING (
        -- Empresa pode ver todas as vistorias da sua empresa
        (auth.uid() IN (
            SELECT id FROM users 
            WHERE empresa_id = vistorias.empresa_id 
            AND user_type IN ('empresa_admin', 'empresa_user')
        ))
        OR
        -- Vistoriador pode ver apenas vistorias atribuídas a ele
        (auth.uid() = vistoriador_id)
        OR
        -- Vistoriador pode ver vistorias através de assignments
        (auth.uid() IN (
            SELECT vistoriador_id FROM vistoria_assignments 
            WHERE vistoria_id = vistorias.id
        ))
    )
    WITH CHECK (
        -- Apenas empresas podem criar vistorias
        auth.uid() IN (
            SELECT id FROM users 
            WHERE empresa_id = vistorias.empresa_id 
            AND can_create_vistorias = true
        )
    );

-- Policy para vistoria_assignments
CREATE POLICY "assignments_policy" ON vistoria_assignments
    FOR ALL USING (
        -- Empresa pode ver todos os assignments da sua empresa
        auth.uid() IN (
            SELECT u.id FROM users u
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE v.id = vistoria_assignments.vistoria_id
            AND u.user_type IN ('empresa_admin', 'empresa_user')
        )
        OR
        -- Vistoriador pode ver apenas seus próprios assignments
        auth.uid() = vistoriador_id
    )
    WITH CHECK (
        -- Apenas empresas podem criar assignments
        auth.uid() IN (
            SELECT u.id FROM users u
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE v.id = vistoria_assignments.vistoria_id
            AND u.can_create_vistorias = true
        )
    );

-- Policy para notificações
CREATE POLICY "notifications_policy" ON notifications
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy para fotos: vistoriadores podem adicionar, empresas podem ver todas
DROP POLICY IF EXISTS "fotos_policy" ON fotos;
CREATE POLICY "fotos_policy" ON fotos
    FOR ALL USING (
        -- Empresa pode ver todas as fotos das vistorias da sua empresa
        auth.uid() IN (
            SELECT u.id FROM users u
            JOIN vistorias v ON v.empresa_id = u.empresa_id
            WHERE v.id = fotos.vistoria_id
            AND u.user_type IN ('empresa_admin', 'empresa_user')
        )
        OR
        -- Vistoriador pode ver fotos das vistorias atribuídas a ele
        auth.uid() IN (
            SELECT v.vistoriador_id FROM vistorias v
            WHERE v.id = fotos.vistoria_id
        )
        OR
        -- Vistoriador pode ver através de assignments
        auth.uid() IN (
            SELECT va.vistoriador_id FROM vistoria_assignments va
            WHERE va.vistoria_id = fotos.vistoria_id
        )
    )
    WITH CHECK (
        -- Vistoriadores podem adicionar fotos às suas vistorias
        auth.uid() IN (
            SELECT v.vistoriador_id FROM vistorias v
            WHERE v.id = fotos.vistoria_id
        )
        OR
        auth.uid() IN (
            SELECT va.vistoriador_id FROM vistoria_assignments va
            WHERE va.vistoria_id = fotos.vistoria_id
        )
    );

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_vistoria_assignments_vistoria_id ON vistoria_assignments(vistoria_id);
CREATE INDEX IF NOT EXISTS idx_vistoria_assignments_vistoriador_id ON vistoria_assignments(vistoriador_id);
CREATE INDEX IF NOT EXISTS idx_vistoria_assignments_status ON vistoria_assignments(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_empresa_id_user_type ON users(empresa_id, user_type);

-- Garantir permissões para as novas tabelas
GRANT ALL PRIVILEGES ON vistoria_assignments TO authenticated;
GRANT ALL PRIVILEGES ON notifications TO authenticated;
GRANT SELECT ON vistoria_assignments TO anon;
GRANT SELECT ON notifications TO anon;

-- Criar função para obter vistorias disponíveis para um vistoriador
CREATE OR REPLACE FUNCTION get_available_vistorias_for_vistoriador(vistoriador_uuid UUID)
RETURNS TABLE (
    vistoria_id UUID,
    endereco TEXT,
    tipo_vistoria TEXT,
    status TEXT,
    data_vistoria TIMESTAMPTZ,
    empresa_nome TEXT,
    assignment_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id as vistoria_id,
        i.endereco,
        v.tipo_vistoria,
        v.status,
        v.data_vistoria,
        e.nome as empresa_nome,
        COALESCE(va.status, 'not_assigned') as assignment_status
    FROM vistorias v
    JOIN imoveis i ON v.imovel_id = i.id
    JOIN empresas e ON v.empresa_id = e.id
    LEFT JOIN vistoria_assignments va ON v.id = va.vistoria_id AND va.vistoriador_id = vistoriador_uuid
    WHERE 
        v.vistoriador_id = vistoriador_uuid
        OR va.vistoriador_id = vistoriador_uuid
    ORDER BY v.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função para empresas atribuírem vistorias
CREATE OR REPLACE FUNCTION assign_vistoria_to_vistoriador(
    p_vistoria_id UUID,
    p_vistoriador_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    assignment_id UUID;
    empresa_user_id UUID;
BEGIN
    -- Verificar se o usuário atual pode atribuir vistorias
    SELECT id INTO empresa_user_id
    FROM users
    WHERE id = auth.uid() AND can_create_vistorias = true;
    
    IF empresa_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não tem permissão para atribuir vistorias';
    END IF;
    
    -- Criar assignment
    INSERT INTO vistoria_assignments (vistoria_id, vistoriador_id, assigned_by, notes)
    VALUES (p_vistoria_id, p_vistoriador_id, auth.uid(), p_notes)
    RETURNING id INTO assignment_id;
    
    -- Atualizar vistoria com o vistoriador
    UPDATE vistorias 
    SET vistoriador_id = p_vistoriador_id, updated_at = now()
    WHERE id = p_vistoria_id;
    
    RETURN assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários para documentação
COMMENT ON TYPE user_type IS 'Tipos de usuário: empresa_admin (admin da empresa), empresa_user (usuário da empresa), vistoriador_app (usuário do app móvel)';
COMMENT ON TABLE vistoria_assignments IS 'Controla a atribuição de vistorias para vistoriadores';
COMMENT ON TABLE notifications IS 'Sistema de notificações para usuários';
COMMENT ON FUNCTION get_available_vistorias_for_vistoriador IS 'Retorna vistorias disponíveis/atribuídas para um vistoriador específico';
COMMENT ON FUNCTION assign_vistoria_to_vistoriador IS 'Permite que empresas atribuam vistorias para vistoriadores';