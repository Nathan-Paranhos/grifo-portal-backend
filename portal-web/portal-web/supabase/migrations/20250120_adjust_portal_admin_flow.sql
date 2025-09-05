-- Migration: Ajuste para o novo fluxo portal-administrativo
-- Data: 2025-01-20
-- Descrição: Reestruturação para o fluxo Cliente → Portal ADM → Retorno manual

-- =====================================================
-- 1. AJUSTES NA TABELA DE SOLICITAÇÕES (inspection_requests)
-- =====================================================

-- Adicionar campos necessários para o novo fluxo
ALTER TABLE inspection_requests 
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente')),
ADD COLUMN IF NOT EXISTS estimated_completion_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES portal_users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Atualizar enum de status para incluir novos estados
ALTER TABLE inspection_requests 
DROP CONSTRAINT IF EXISTS inspection_requests_status_check;

ALTER TABLE inspection_requests 
ADD CONSTRAINT inspection_requests_status_check 
CHECK (status IN ('pendente', 'em_analise', 'aprovada', 'rejeitada', 'em_execucao', 'concluida', 'entregue'));

-- =====================================================
-- 2. AJUSTES NA TABELA DE VISTORIAS
-- =====================================================

-- Adicionar campos para controle manual pelo portal ADM
ALTER TABLE vistorias 
ADD COLUMN IF NOT EXISTS manual_completion BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS completed_by_admin UUID REFERENCES portal_users(id),
ADD COLUMN IF NOT EXISTS admin_completion_notes TEXT,
ADD COLUMN IF NOT EXISTS client_notification_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMP WITH TIME ZONE;

-- Atualizar enum de status para incluir novos estados do fluxo manual
ALTER TABLE vistorias 
DROP CONSTRAINT IF EXISTS vistorias_status_check;

ALTER TABLE vistorias 
ADD CONSTRAINT vistorias_status_check 
CHECK (status IN ('pendente', 'atribuida', 'em_andamento', 'aguardando_revisao', 'em_revisao', 'concluida', 'entregue', 'contestada', 'cancelada'));

-- =====================================================
-- 3. NOVA TABELA PARA WORKFLOW DE APROVAÇÃO
-- =====================================================

CREATE TABLE IF NOT EXISTS approval_workflow (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_request_id UUID NOT NULL REFERENCES inspection_requests(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    step_name VARCHAR(50) NOT NULL,
    step_order INTEGER NOT NULL,
    assigned_to UUID REFERENCES portal_users(id),
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'rejeitada')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_approval_workflow_request ON approval_workflow(inspection_request_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflow_empresa ON approval_workflow(empresa_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflow_assigned ON approval_workflow(assigned_to);

-- =====================================================
-- 4. TABELA PARA TEMPLATES DE RETORNO MANUAL
-- =====================================================

CREATE TABLE IF NOT EXISTS manual_completion_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    template_fields JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES portal_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. TABELA PARA HISTÓRICO DE AÇÕES DO PORTAL ADM
-- =====================================================

CREATE TABLE IF NOT EXISTS portal_admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'inspection_request', 'vistoria', etc.
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    notes TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_portal_actions_empresa ON portal_admin_actions(empresa_id);
CREATE INDEX IF NOT EXISTS idx_portal_actions_user ON portal_admin_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_actions_entity ON portal_admin_actions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_portal_actions_date ON portal_admin_actions(created_at);

-- =====================================================
-- 6. AJUSTES NA TABELA DE NOTIFICAÇÕES
-- =====================================================

-- Adicionar tipos de notificação para o novo fluxo
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('solicitacao_recebida', 'solicitacao_aprovada', 'solicitacao_rejeitada', 'vistoria_atribuida', 'vistoria_concluida', 'laudo_disponivel', 'contestacao_recebida', 'lembrete_prazo', 'sistema'));

-- =====================================================
-- 7. CONFIGURAÇÕES ESPECÍFICAS PARA EMPRESAS
-- =====================================================

-- Adicionar coluna configuracoes se não existir
ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS configuracoes JSONB DEFAULT '{}'::jsonb;

-- Adicionar outras colunas necessárias para empresas
ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS google_drive_config JSONB,
ADD COLUMN IF NOT EXISTS docusign_config JSONB,
ADD COLUMN IF NOT EXISTS plano VARCHAR(20) DEFAULT 'basico',
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- Adicionar configurações do novo fluxo na tabela empresas
UPDATE empresas 
SET configuracoes = COALESCE(configuracoes, '{}'::jsonb) || jsonb_build_object(
    'portal_admin_flow', jsonb_build_object(
        'auto_approve_requests', false,
        'require_manual_completion', true,
        'default_completion_template', null,
        'notification_settings', jsonb_build_object(
            'notify_on_new_request', true,
            'notify_on_completion', true,
            'email_notifications', true,
            'sms_notifications', false
        ),
        'workflow_steps', jsonb_build_array(
            jsonb_build_object('name', 'analise_inicial', 'order', 1, 'required', true),
            jsonb_build_object('name', 'aprovacao', 'order', 2, 'required', true),
            jsonb_build_object('name', 'execucao', 'order', 3, 'required', true),
            jsonb_build_object('name', 'revisao', 'order', 4, 'required', true),
            jsonb_build_object('name', 'entrega', 'order', 5, 'required', true)
        )
    )
)
WHERE configuracoes IS NULL OR NOT configuracoes ? 'portal_admin_flow';

-- =====================================================
-- 8. FUNÇÕES PARA AUTOMAÇÃO DO WORKFLOW
-- =====================================================

-- Função para criar workflow automático quando uma solicitação é criada
CREATE OR REPLACE FUNCTION create_approval_workflow()
RETURNS TRIGGER AS $$
DECLARE
    empresa_uuid UUID;
BEGIN
    -- Buscar empresa_id através do tenant do cliente
    SELECT e.id INTO empresa_uuid
    FROM empresas e
    JOIN clients c ON c.tenant = e.nome
    WHERE c.id = NEW.client_id;
    
    -- Criar steps do workflow baseado na configuração da empresa
    INSERT INTO approval_workflow (inspection_request_id, empresa_id, step_name, step_order)
    SELECT 
        NEW.id,
        empresa_uuid,
        step->>'name',
        (step->>'order')::integer
    FROM (
        SELECT jsonb_array_elements(
            COALESCE(
                (SELECT configuracoes->'portal_admin_flow'->'workflow_steps' 
                 FROM empresas WHERE id = empresa_uuid),
                '[{"name": "analise_inicial", "order": 1}, {"name": "aprovacao", "order": 2}]'::jsonb
            )
        ) as step
    ) steps
    WHERE empresa_uuid IS NOT NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar workflow automaticamente
DROP TRIGGER IF EXISTS trigger_create_approval_workflow ON inspection_requests;
CREATE TRIGGER trigger_create_approval_workflow
    AFTER INSERT ON inspection_requests
    FOR EACH ROW
    EXECUTE FUNCTION create_approval_workflow();

-- =====================================================
-- 9. VIEWS PARA FACILITAR CONSULTAS DO PORTAL ADM
-- =====================================================

-- View para dashboard do portal administrativo
CREATE OR REPLACE VIEW portal_admin_dashboard AS
SELECT 
    e.id as empresa_id,
    e.nome as empresa_nome,
    COUNT(DISTINCT ir.id) as total_solicitacoes,
    COUNT(DISTINCT CASE WHEN ir.status = 'pending' THEN ir.id END) as solicitacoes_pendentes,
    COUNT(DISTINCT CASE WHEN ir.status = 'approved' THEN ir.id END) as solicitacoes_aprovadas,
    COUNT(DISTINCT CASE WHEN ir.status = 'rejected' THEN ir.id END) as solicitacoes_rejeitadas,
    COUNT(DISTINCT v.id) as total_vistorias,
    COUNT(DISTINCT CASE WHEN v.status = 'em_andamento' THEN v.id END) as vistorias_andamento,
    COUNT(DISTINCT CASE WHEN v.status = 'concluida' THEN v.id END) as vistorias_concluidas,
    COUNT(DISTINCT CASE WHEN v.manual_completion = true THEN v.id END) as vistorias_manuais
FROM empresas e
LEFT JOIN clients c ON c.tenant = e.nome
LEFT JOIN inspection_requests ir ON ir.client_id = c.id
LEFT JOIN vistorias v ON v.empresa_id = e.id
GROUP BY e.id, e.nome;

-- View para status do workflow de aprovação
CREATE OR REPLACE VIEW approval_workflow_status AS
SELECT 
    aw.id,
    aw.inspection_request_id,
    ir.property_address,
    ir.client_id,
    aw.step_name,
    aw.step_order,
    aw.status,
    aw.assigned_to,
    aw.created_at,
    aw.updated_at,
    CASE 
        WHEN aw.status = 'completed' THEN 100
        WHEN aw.step_name = 'analise_inicial' THEN 20
        WHEN aw.step_name = 'aprovacao' THEN 40
        WHEN aw.step_name = 'execucao' THEN 60
        WHEN aw.step_name = 'revisao' THEN 80
        ELSE 0
    END as progress_percentage
FROM approval_workflow aw
JOIN inspection_requests ir ON ir.id = aw.inspection_request_id
ORDER BY aw.step_order;

-- =====================================================
-- 10. POLÍTICAS RLS PARA SEGURANÇA
-- =====================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE approval_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_completion_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_admin_actions ENABLE ROW LEVEL SECURITY;

-- Políticas para approval_workflow
CREATE POLICY "Users can view workflow from their company" ON approval_workflow
    FOR SELECT USING (
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    );

CREATE POLICY "Users can update workflow from their company" ON approval_workflow
    FOR UPDATE USING (
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    );

-- Políticas para manual_completion_templates
CREATE POLICY "Users can manage templates from their company" ON manual_completion_templates
    FOR ALL USING (
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    );

-- Políticas para portal_admin_actions
CREATE POLICY "Users can view actions from their company" ON portal_admin_actions
    FOR SELECT USING (
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
    );

CREATE POLICY "Users can insert their own actions" ON portal_admin_actions
    FOR INSERT WITH CHECK (
        empresa_id = (auth.jwt() ->> 'empresa_id')::uuid AND
        user_id = (auth.jwt() ->> 'user_id')::uuid
    );

-- =====================================================
-- 11. GRANTS DE PERMISSÃO
-- =====================================================

-- Conceder permissões para as roles anon e authenticated
GRANT SELECT, INSERT, UPDATE ON approval_workflow TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON manual_completion_templates TO authenticated;
GRANT SELECT, INSERT ON portal_admin_actions TO authenticated;

GRANT SELECT ON portal_admin_dashboard TO authenticated;
GRANT SELECT ON approval_workflow_status TO authenticated;

-- Permissões básicas para anon (apenas leitura limitada)
GRANT SELECT ON inspection_requests TO anon;
GRANT SELECT ON vistorias TO anon;

-- =====================================================
-- 12. DADOS INICIAIS PARA TESTE
-- =====================================================

-- Inserir templates padrão para empresas existentes
INSERT INTO manual_completion_templates (empresa_id, name, description, template_fields)
SELECT 
    e.id,
    'Template Padrão - Vistoria Residencial',
    'Template padrão para conclusão manual de vistorias residenciais',
    jsonb_build_object(
        'campos_obrigatorios', jsonb_build_array('estado_geral', 'observacoes_tecnicas'),
        'campos_opcionais', jsonb_build_array('recomendacoes', 'prazo_revisao'),
        'categorias_avaliacao', jsonb_build_array(
            'estrutural', 'eletrica', 'hidraulica', 'acabamentos', 'seguranca'
        )
    )
FROM empresas e
WHERE NOT EXISTS (
    SELECT 1 FROM manual_completion_templates mct 
    WHERE mct.empresa_id = e.id
);

-- =====================================================
-- COMENTÁRIOS FINAIS
-- =====================================================

-- Esta migração ajusta o sistema para o novo fluxo:
-- 1. Cliente solicita vistoria pelo portal
-- 2. Equipe administrativa recebe no portal ADM
-- 3. Retorno manual da vistoria pelo Luiz via portal ADM
--
-- Principais mudanças:
-- - Workflow de aprovação estruturado
-- - Controle manual de conclusão
-- - Templates para padronização
-- - Auditoria completa de ações
-- - Dashboard específico para portal ADM
-- - Notificações integradas ao novo fluxo

COMMIT;