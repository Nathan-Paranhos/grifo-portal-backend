const express = require('express');
const { z } = require('zod');
const { supabase } = require('../../config/supabase.js');
const {
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  AuthorizationError
} = require('../../middleware/errorHandler.js');
const { validateRequest, commonSchemas } = require('../../middleware/validation.js');
const { authSupabase, requireRole } = require('../../middleware/auth.js');
const { notifyRequestDecision, notifyInspectionScheduled } = require('../../utils/notifications');

// Função utilitária para criar vistoria após aprovação
const createInspectionFromRequest = async (requestId, inspectorId, scheduledDate, approvedBy) => {
  try {
    // Buscar dados da solicitação
    const { data: request, error: requestError } = await supabase
      .from('inspection_requests')
      .select(`
        *,
        clients!inner(company_id)
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      throw new Error('Solicitação não encontrada');
    }

    // Criar propriedade se não existir
    let propertyId;
    const { data: existingProperty } = await supabase
      .from('properties')
      .select('id')
      .eq('address', request.property_address)
      .eq('company_id', request.clients.company_id)
      .single();

    if (existingProperty) {
      propertyId = existingProperty.id;
    } else {
      const { data: newProperty, error: propertyError } = await supabase
        .from('properties')
        .insert({
          address: request.property_address,
          property_type: request.property_type,
          owner_name: request.clients.name || 'Cliente',
          owner_phone: request.contact_phone,
          owner_email: request.contact_email,
          company_id: request.clients.company_id,
          status: 'active'
        })
        .select('id')
        .single();

      if (propertyError) {
        throw new Error('Erro ao criar propriedade: ' + propertyError.message);
      }
      propertyId = newProperty.id;
    }

    // Criar vistoria
    const { data: inspection, error: inspectionError } = await supabase
      .from('inspections')
      .insert({
        property_id: propertyId,
        inspector_id: inspectorId,
        scheduled_date: scheduledDate,
        notes: request.description,
        company_id: request.clients.company_id,
        created_by: approvedBy,
        status: 'pending',
        inspection_request_id: requestId
      })
      .select('id')
      .single();

    if (inspectionError) {
      throw new Error('Erro ao criar vistoria: ' + inspectionError.message);
    }

    return inspection;
  } catch (error) {
    console.error('Erro ao criar vistoria a partir da solicitação:', error);
    throw error;
  }
};

const router = express.Router();

// Validation schemas
const processWorkflowSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes'], {
    errorMap: () => ({ message: 'Ação inválida' })
  }),
  comment: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  inspector_id: z.string().uuid().optional(),
  scheduled_date: z.string().datetime().optional()
});

const approvalSchemas = {
  processRequest: {
    params: z.object({
      requestId: commonSchemas.uuid
    }),
    body: z.object({
      action: z.enum(['approve', 'reject', 'request_changes']),
      notes: z.string().min(1, 'Notas são obrigatórias'),
      assigned_to: commonSchemas.uuid.optional(),
      scheduled_date: z.string().datetime().optional()
    })
  },
  updateWorkflow: {
    params: z.object({
      workflowId: commonSchemas.uuid
    }),
    body: z.object({
      step_name: z.string().min(1, 'Nome do passo é obrigatório'),
      status: z.enum(['pending', 'in_progress', 'completed', 'rejected']),
      notes: z.string().optional(),
      assigned_to: commonSchemas.uuid.optional()
    })
  }
};

/**
 * @swagger
 * /api/v1/approval-workflow/requests:
 *   get:
 *     tags: [Approval Workflow]
 *     summary: Listar solicitações de vistoria pendentes de aprovação
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, in_progress]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de solicitações de vistoria
 */
router.get(
  '/requests',
  authSupabase,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status = 'pending',
      priority,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    const userTenant = req.user.tenant_slug;

    let query = supabase
      .from('portal_admin_dashboard')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Filtrar por tenant do usuário
    if (userTenant) {
      query = query.eq('empresa_nome', userTenant);
    }

    // Aplicar filtros
    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    if (search) {
      query = query.or(
        `property_address.ilike.%${search}%,client_name.ilike.%${search}%`
      );
    }

    const { data: requests, error, count } = await query;

    if (error) {
      console.error('Error fetching inspection requests:', error);
      throw new AppError('Erro ao buscar solicitações de vistoria', 500);
    }

    res.json({
      success: true,
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/approval-workflow/requests/{requestId}:
 *   get:
 *     tags: [Approval Workflow]
 *     summary: Obter detalhes de uma solicitação de vistoria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalhes da solicitação
 */
router.get(
  '/requests/:requestId',
  authSupabase,
  requireRole(['admin', 'manager', 'inspector']),
  validateRequest({ params: z.object({ requestId: commonSchemas.uuid }) }),
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;

    // Buscar detalhes da solicitação
    const { data: request, error: requestError } = await supabase
      .from('inspection_requests')
      .select(`
        *,
        clients!inner(
          id,
          name,
          email,
          phone,
          tenant
        )
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      throw new NotFoundError('Solicitação de vistoria não encontrada');
    }

    // Buscar workflow de aprovação
    const { data: workflow, error: workflowError } = await supabase
      .from('approval_workflow')
      .select('*')
      .eq('inspection_request_id', requestId)
      .order('step_order', { ascending: true });

    if (workflowError) {
      console.error('Error fetching workflow:', workflowError);
    }

    // Buscar arquivos anexados
    const { data: files, error: filesError } = await supabase
      .from('inspection_files')
      .select('*')
      .eq('inspection_request_id', requestId);

    if (filesError) {
      console.error('Error fetching files:', filesError);
    }

    // Buscar comentários
    const { data: comments, error: commentsError } = await supabase
      .from('inspection_comments')
      .select(`
        *,
        users!inner(
          name,
          user_type
        )
      `)
      .eq('inspection_request_id', requestId)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
    }

    res.json({
      success: true,
      data: {
        request,
        workflow: workflow || [],
        files: files || [],
        comments: comments || []
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/approval-workflow/requests/{requestId}/process:
 *   post:
 *     tags: [Approval Workflow]
 *     summary: Processar solicitação de vistoria (aprovar/rejeitar)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject, request_changes]
 *               notes:
 *                 type: string
 *               assigned_to:
 *                 type: string
 *                 format: uuid
 *               scheduled_date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Solicitação processada com sucesso
 */
router.post(
  '/requests/:requestId/process',
  authSupabase,
  requireRole(['admin', 'manager']),
  validateRequest({ body: processWorkflowSchema }),
  asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { action, comment, priority, inspector_id, scheduled_date } = req.body;
    const userId = req.user.id;

    // Verificar se a solicitação existe
    const { data: request, error: requestError } = await supabase
      .from('inspection_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      throw new NotFoundError('Solicitação de vistoria não encontrada');
    }

    // Determinar novo status baseado na ação
    let newStatus;
    switch (action) {
      case 'approve':
        newStatus = 'approved';
        
        // Criar vistoria automaticamente se aprovada e dados fornecidos
        if (inspector_id && scheduled_date) {
          try {
            const inspection = await createInspectionFromRequest(
              requestId,
              inspector_id,
              scheduled_date,
              userId
            );
            
            // Atualizar status para 'scheduled' se vistoria foi criada
            newStatus = 'scheduled';
            
            console.log('Vistoria criada automaticamente:', {
              requestId,
              inspectionId: inspection.id,
              approvedBy: userId
            });
          } catch (inspectionError) {
            console.error('Erro ao criar vistoria automaticamente:', inspectionError);
            // Manter status como 'approved' mesmo se falhar a criação da vistoria
          }
        }
        break;
      case 'reject':
        newStatus = 'rejected';
        break;
      case 'request_changes':
        newStatus = 'changes_requested';
        break;
      default:
        throw new ValidationError('Ação inválida');
    }

    // Atualizar status da solicitação
    const { error: updateError } = await supabase
      .from('inspection_requests')
      .update({
        status: newStatus,
        assigned_to: assigned_to || null,
        scheduled_date: scheduled_date || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating request:', updateError);
      throw new AppError('Erro ao atualizar solicitação', 500);
    }

    // Adicionar comentário com a decisão
    if (comment) {
      const { error: commentError } = await supabase
        .from('inspection_comments')
        .insert({
          inspection_request_id: requestId,
          user_id: userId,
          comment: comment,
          comment_type: 'admin_decision',
          created_at: new Date().toISOString()
        });

      if (commentError) {
         console.error('Error adding comment:', commentError);
       }
     }

    // Atualizar workflow de aprovação
    const { error: workflowError } = await supabase
      .from('approval_workflow')
      .update({
        status: newStatus === 'approved' ? 'completed' : 'rejected',
        notes: notes,
        assigned_to: userId,
        updated_at: new Date().toISOString()
      })
      .eq('inspection_request_id', requestId)
      .eq('step_name', 'admin_review');

    if (workflowError) {
      console.error('Error updating workflow:', workflowError);
    }

    // Enviar notificação para o cliente
    try {
      await notifyRequestDecision(
        request.client_id,
        action,
        {
          id: requestId,
          property_address: request.property_address || 'Endereço não informado'
        },
        comment
      );
      
      // Se vistoria foi criada automaticamente, notificar agendamento
      if (newStatus === 'scheduled' && inspector_id && scheduled_date) {
        await notifyInspectionScheduled(
          request.client_id,
          {
            id: requestId,
            scheduled_date: scheduled_date,
            property_address: request.property_address || 'Endereço não informado',
            inspector_name: 'Inspetor designado'
          }
        );
      }
    } catch (notificationError) {
      console.error('Erro ao enviar notificações:', notificationError);
    }

    res.json({
      success: true,
      message: `Solicitação ${action === 'approve' ? 'aprovada' : action === 'reject' ? 'rejeitada' : 'marcada para alterações'} com sucesso`,
      data: {
        requestId,
        newStatus,
        action,
        processedBy: userId,
        processedAt: new Date().toISOString()
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/approval-workflow/dashboard:
 *   get:
 *     tags: [Approval Workflow]
 *     summary: Dashboard do fluxo de aprovação
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas do dashboard
 */
router.get(
  '/dashboard',
  authSupabase,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const userTenant = req.user.tenant_slug;

    // Buscar estatísticas usando a view
    const { data: stats, error: statsError } = await supabase
      .from('approval_workflow_status')
      .select('*')
      .eq('empresa_nome', userTenant);

    if (statsError) {
      console.error('Error fetching workflow stats:', statsError);
      throw new AppError('Erro ao buscar estatísticas', 500);
    }

    // Contar por status
    const statusCounts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      in_progress: 0,
      changes_requested: 0
    };

    stats.forEach(item => {
      if (statusCounts.hasOwnProperty(item.status)) {
        statusCounts[item.status]++;
      }
    });

    // Buscar solicitações recentes
    const { data: recentRequests, error: recentError } = await supabase
      .from('portal_admin_dashboard')
      .select('*')
      .eq('empresa_nome', userTenant)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Error fetching recent requests:', recentError);
    }

    res.json({
      success: true,
      data: {
        statusCounts,
        recentRequests: recentRequests || [],
        totalRequests: stats.length
      }
    });
  })
);

module.exports = router;