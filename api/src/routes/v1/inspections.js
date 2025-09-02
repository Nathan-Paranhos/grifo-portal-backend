const express = require('express');
const { z } = require('zod');
const { supabase } = require('../../config/supabase.js');
// const { logger } = require('../../config/logger.js');
const {
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  AuthorizationError
} = require('../../middleware/errorHandler.js');
const { validateRequest, commonSchemas } = require('../../middleware/validation.js');
const { authSupabase, requireRole } = require('../../middleware/auth.js');
const { notifyInspectionStatusChange, notifyReportAvailable } = require('../../utils/notifications');

const router = express.Router();

// Validation schemas
const inspectionSchemas = {
  getInspection: {
    params: z.object({
      id: commonSchemas.uuid
    })
  },
  createInspection: {
    body: z.object({
      imovel_id: commonSchemas.uuid,
      tipo_vistoria: z.enum(['entrada', 'saida', 'periodica', 'manutencao']),
      data_vistoria: z.string().datetime('Data deve estar no formato ISO'),
      vistoriador_id: commonSchemas.uuid.optional(),
      solicitante_id: commonSchemas.uuid.optional(),
      observacoes: z.string().optional(),
      prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']).default('media')
    })
  },
  updateInspection: {
    params: z.object({
      id: commonSchemas.uuid
    }),
    body: z.object({
      tipo_vistoria: z
        .enum(['entrada', 'saida', 'periodica', 'manutencao'])
        .optional(),
      data_vistoria: z
        .string()
        .datetime('Data deve estar no formato ISO')
        .optional(),
      vistoriador_id: commonSchemas.uuid.optional(),
      observacoes: z.string().optional(),
      prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
      status: z
        .enum(['agendada', 'em_andamento', 'concluida', 'cancelada'])
        .optional()
    })
  },
  updateStatus: {
    params: z.object({
      id: commonSchemas.uuid
    }),
    body: z.object({
      status: z.enum(['agendada', 'em_andamento', 'concluida', 'cancelada']),
      observacoes: z.string().optional()
    })
  },
  addItem: {
    params: z.object({
      id: commonSchemas.uuid
    }),
    body: z.object({
      categoria: z.string().min(1, 'Categoria é obrigatória'),
      item: z.string().min(1, 'Item é obrigatório'),
      estado: z.enum(['otimo', 'bom', 'regular', 'ruim', 'pessimo']),
      observacoes: z.string().optional(),
      foto_url: z.string().url().optional()
    })
  },
  updateItem: {
    params: z.object({
      id: commonSchemas.uuid,
      itemId: commonSchemas.uuid
    }),
    body: z.object({
      categoria: z.string().min(1, 'Categoria é obrigatória').optional(),
      item: z.string().min(1, 'Item é obrigatório').optional(),
      estado: z.enum(['otimo', 'bom', 'regular', 'ruim', 'pessimo']).optional(),
      observacoes: z.string().optional(),
      foto_url: z.string().url().optional()
    })
  }
};

/**
 * @swagger
 * /api/v1/inspections:
 *   get:
 *     tags: [Inspections]
 *     summary: Listar vistorias
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
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [agendada, em_andamento, concluida, cancelada]
 *       - in: query
 *         name: tipo_vistoria
 *         schema:
 *           type: string
 *           enum: [entrada, saida, periodica, manutencao]
 *     responses:
 *       200:
 *         description: Lista de vistorias
 */
router.get(
  '/',
  authSupabase,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      status,
      tipo_vistoria: tipoVistoria,
      vistoriador_id: vistoriadorId,
      search
    } = req.query;
    const offset = (page - 1) * limit;
    const empresaId = req.user.empresa_id || req.company?.id;
    const userType = req.userType;
    const userData = req.user;

    let query = supabase
      .from('vistorias')
      .select(
        `
        id,
        data_vistoria,
        status,
        tipo_vistoria,
        prioridade,
        observacoes,
        created_at,
        updated_at,
        imoveis!inner(
          id,
          endereco,
          cidade,
          estado,
          cep,
          tipo
        ),
        users!vistorias_vistoriador_id_fkey(
          id,
          nome,
          email
        )
      `,
        { count: 'exact' }
      )
      .eq('empresa_id', empresaId)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Filter by user type and permissions
    if (userType === 'app_user') {
      // App users can only see their own inspections
      query = query.eq('solicitante_id', userData.id);
    } else if (userType === 'portal_user' && userData.role === 'inspector') {
      // Inspectors can only see inspections assigned to them
      query = query.eq('vistoriador_id', userData.id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (tipoVistoria) {
      query = query.eq('tipo_vistoria', tipoVistoria);
    }

    if (vistoriadorId && ['admin', 'manager'].includes(userData.role)) {
      query = query.eq('vistoriador_id', vistoriadorId);
    }

    if (search) {
      query = query.or(
        `observacoes.ilike.%${search}%,imoveis.endereco.ilike.%${search}%`
      );
    }

    const { data: inspections, error, count } = await query;

    if (error) {
      console.error('Error fetching inspections:', error);
      throw new AppError('Erro ao buscar vistorias', 500);
    }

    res.json({
      success: true,
      data: inspections,
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
 * /api/v1/inspections/{id}:
 *   get:
 *     tags: [Inspections]
 *     summary: Obter vistoria por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Dados da vistoria
 */
router.get(
  '/:id',
  authSupabase,
  validateRequest(inspectionSchemas.getInspection),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const empresaId = req.user.empresa_id || req.company?.id;
    const userType = req.userType;
    const userData = req.user;

    let query = supabase
      .from('vistorias')
      .select(
        `
        id,
        data_vistoria,
        status,
        tipo_vistoria,
        observacoes,
        created_at,
        updated_at,
        imoveis!inner(
          id,
          endereco,
          cidade,
          estado,
          cep,
          tipo
        ),
        users!vistorias_vistoriador_id_fkey(
          id,
          nome,
          email
        ),
        itens_vistoria(
          id,
          categoria,
          item,
          estado,
          observacoes,
          foto_url,
          created_at
        ),
        fotos(
          id,
          url,
          descricao,
          created_at
        )
      `
      )
      .eq('id', id)
      .eq('empresa_id', empresaId);

    // Apply user-specific filters
    if (userType === 'app_user') {
      query = query.eq('solicitante_id', userData.id);
    } else if (userType === 'portal_user' && userData.role === 'inspector') {
      query = query.eq('vistoriador_id', userData.id);
    }

    const { data: inspection, error } = await query.single();

    if (error || !inspection) {
      throw new NotFoundError('Vistoria não encontrada');
    }

    res.json({
      success: true,
      data: inspection
    });
  })
);

/**
 * @swagger
 * /api/v1/inspections:
 *   post:
 *     tags: [Inspections]
 *     summary: Criar nova vistoria
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Vistoria criada com sucesso
 */
router.post(
  '/',
  authSupabase,
  validateRequest(inspectionSchemas.createInspection),
  asyncHandler(async (req, res) => {
    const inspectionData = req.body;
    const empresaId = req.user.empresa_id || req.company?.id;
    const userId = req.user.id;
    const userType = req.userType;

    // Verify property belongs to company
    const { data: property, error: propertyError } = await supabase
      .from('imoveis')
      .select('id')
      .eq('id', inspectionData.imovel_id)
      .eq('empresa_id', empresaId)
      .single();

    if (propertyError || !property) {
      throw new ValidationError(
        'Propriedade não encontrada ou não pertence à empresa'
      );
    }

    // Set solicitante_id based on user type
    if (userType === 'app_user') {
      inspectionData.solicitante_id = userId;
    }

    // Verify vistoriador belongs to company if specified
    if (inspectionData.vistoriador_id) {
      const { data: vistoriador, error: vistoriadorError } = await supabase
        .from('portal_users')
        .select('id')
        .eq('id', inspectionData.vistoriador_id)
        .eq('empresa_id', empresaId)
        .eq('status', 'active')
        .single();

      if (vistoriadorError || !vistoriador) {
        throw new ValidationError(
          'Vistoriador não encontrado ou não pertence à empresa'
        );
      }
    }

    const { data: inspection, error } = await supabase
      .from('vistorias')
      .insert({
        ...inspectionData,
        empresa_id: empresaId,
        created_by: userId,
        status: 'agendada',
        created_at: new Date().toISOString()
      })
      .select(
        `
        id,
        data_vistoria,
        status,
        tipo_vistoria,
        prioridade,
        observacoes,
        created_at,
        imoveis!inner(
          id,
          endereco,
          cidade,
          tipo_imovel
        ),
        portal_users!vistorias_vistoriador_id_fkey(
          id,
          name,
          email
        )
      `
      )
      .single();

    if (error) {
      console.error('Error creating inspection:', error);
      throw new AppError('Erro ao criar vistoria', 500);
    }

    console.log('Inspection created successfully', {
      inspectionId: inspection.id,
      createdBy: userId,
      empresaId
    });

    res.status(201).json({
      success: true,
      message: 'Vistoria criada com sucesso',
      data: inspection
    });
  })
);

/**
 * @swagger
 * /api/v1/inspections/{id}:
 *   put:
 *     tags: [Inspections]
 *     summary: Atualizar vistoria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Vistoria atualizada com sucesso
 */
router.put(
  '/:id',
  authSupabase,
  validateRequest(inspectionSchemas.updateInspection),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const empresaId = req.user.empresa_id || req.company?.id;
    const userId = req.user.id;
    const userType = req.userType;
    const userData = req.user;

    // Get current inspection
    const { data: currentInspection, error: fetchError } = await supabase
      .from('vistorias')
      .select('id, status, vistoriador_id, solicitante_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (fetchError || !currentInspection) {
      throw new NotFoundError('Vistoria não encontrada');
    }

    // Check permissions
    const canUpdate =
      ['admin', 'manager'].includes(userData.role) ||
      (userType === 'portal_user' &&
        userData.role === 'inspector' &&
        currentInspection.vistoriador_id === userId) ||
      (userType === 'app_user' &&
        currentInspection.solicitante_id === userId &&
        currentInspection.status === 'agendada');

    if (!canUpdate) {
      throw new AuthorizationError(
        'Sem permissão para atualizar esta vistoria'
      );
    }

    // Restrict what app users can update
    if (userType === 'app_user') {
      const allowedFields = ['observacoes'];
      Object.keys(updateData).forEach(key => {
        if (!allowedFields.includes(key)) {
          delete updateData[key];
        }
      });
    }

    // Verify vistoriador belongs to company if being updated
    if (updateData.vistoriador_id) {
      const { data: vistoriador, error: vistoriadorError } = await supabase
        .from('portal_users')
        .select('id')
        .eq('id', updateData.vistoriador_id)
        .eq('empresa_id', empresaId)
        .eq('status', 'active')
        .single();

      if (vistoriadorError || !vistoriador) {
        throw new ValidationError(
          'Vistoriador não encontrado ou não pertence à empresa'
        );
      }
    }

    const { data: inspection, error } = await supabase
      .from('vistorias')
      .update({
        ...updateData,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select(
        `
        id,
        data_vistoria,
        status,
        tipo_vistoria,
        prioridade,
        observacoes,
        updated_at,
        imoveis!inner(
          id,
          endereco,
          cidade,
          tipo_imovel
        ),
        portal_users!vistorias_vistoriador_id_fkey(
          id,
          name,
          email
        )
      `
      )
      .single();

    if (error) {
      console.error('Error updating inspection:', error);
      throw new AppError('Erro ao atualizar vistoria', 500);
    }

    console.log('Inspection updated successfully', {
      inspectionId: id,
      updatedBy: userId,
      empresaId
    });

    res.json({
      success: true,
      message: 'Vistoria atualizada com sucesso',
      data: inspection
    });
  })
);

/**
 * @swagger
 * /api/v1/inspections/{id}/status:
 *   patch:
 *     tags: [Inspections]
 *     summary: Atualizar status da vistoria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 */
router.patch(
  '/:id/status',
  authSupabase,
  validateRequest(inspectionSchemas.updateStatus),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, observacoes } = req.body;
    const empresaId = req.user.empresa_id || req.company?.id;
    const userId = req.user.id;
    const userType = req.userType;
    const userData = req.user;

    // Get current inspection
    const { data: currentInspection, error: fetchError } = await supabase
      .from('vistorias')
      .select('id, status, vistoriador_id, solicitante_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (fetchError || !currentInspection) {
      throw new NotFoundError('Vistoria não encontrada');
    }

    // Check permissions for status changes
    const canChangeStatus =
      ['admin', 'manager'].includes(userData.role) ||
      (userType === 'portal_user' &&
        userData.role === 'inspector' &&
        currentInspection.vistoriador_id === userId);

    if (!canChangeStatus) {
      throw new AuthorizationError(
        'Sem permissão para alterar o status desta vistoria'
      );
    }

    // Validate status transitions
    const validTransitions = {
      agendada: ['em_andamento', 'cancelada'],
      em_andamento: ['concluida', 'cancelada'],
      concluida: [], // Cannot change from completed
      cancelada: ['agendada'] // Can reschedule cancelled inspections
    };

    if (!validTransitions[currentInspection.status].includes(status)) {
      throw new ValidationError(
        `Não é possível alterar status de '${currentInspection.status}' para '${status}'`
      );
    }

    const updateData = {
      status,
      updated_by: userId,
      updated_at: new Date().toISOString()
    };

    if (observacoes) {
      updateData.observacoes = observacoes;
    }

    // Set completion date if status is completed
    if (status === 'concluida') {
      updateData.data_conclusao = new Date().toISOString();
    }

    const { data: inspection, error } = await supabase
      .from('vistorias')
      .update(updateData)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (error) {
      console.error('Error updating inspection status:', error);
      throw new AppError('Erro ao atualizar status da vistoria', 500);
    }

    // Notificar cliente sobre mudança de status
    if (currentInspection.solicitante_id) {
      await notifyInspectionStatusChange(
        id,
        currentInspection.solicitante_id,
        status,
        currentInspection.vistoriador_id
      );
    }

    // Se a vistoria foi concluída, notificar sobre disponibilidade do relatório
    if (status === 'concluida' && currentInspection.solicitante_id) {
      await notifyReportAvailable(id, currentInspection.solicitante_id);
    }

    console.log('Inspection status updated successfully', {
      inspectionId: id,
      newStatus: status,
      updatedBy: userId,
      empresaId
    });

    res.json({
      success: true,
      message: 'Status da vistoria atualizado com sucesso',
      data: inspection
    });
  })
);

/**
 * @swagger
 * /api/v1/inspections/{id}/items:
 *   post:
 *     tags: [Inspections]
 *     summary: Adicionar item à vistoria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       201:
 *         description: Item adicionado com sucesso
 */
router.post(
  '/:id/items',
  authSupabase,

  requireRole(['admin', 'manager', 'inspector']),
  validateRequest(inspectionSchemas.addItem),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const itemData = req.body;
    const empresaId = req.userData.empresa_id;
    const userId = req.userData.id;
    const userData = req.userData;

    // Verify inspection exists and user has permission
    const { data: inspection, error: inspectionError } = await supabase
      .from('vistorias')
      .select('id, status, vistoriador_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (inspectionError || !inspection) {
      throw new NotFoundError('Vistoria não encontrada');
    }

    // Check if user can add items to this inspection
    const canAddItems =
      ['admin', 'manager'].includes(userData.role) ||
      (userData.role === 'inspector' && inspection.vistoriador_id === userId);

    if (!canAddItems) {
      throw new AuthorizationError(
        'Sem permissão para adicionar itens a esta vistoria'
      );
    }

    // Only allow adding items to inspections in progress
    if (inspection.status !== 'em_andamento') {
      throw new ValidationError(
        'Só é possível adicionar itens a vistorias em andamento'
      );
    }

    const { data: item, error } = await supabase
      .from('itens_vistoria')
      .insert({
        ...itemData,
        vistoria_id: id,
        created_by: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding inspection item:', error);
      throw new AppError('Erro ao adicionar item à vistoria', 500);
    }

    console.log('Inspection item added successfully', {
      itemId: item.id,
      inspectionId: id,
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      message: 'Item adicionado com sucesso',
      data: item
    });
  })
);

/**
 * @swagger
 * /api/v1/inspections/{id}/items/{itemId}:
 *   put:
 *     tags: [Inspections]
 *     summary: Atualizar item da vistoria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Item atualizado com sucesso
 */
router.put(
  '/:id/items/:itemId',
  authSupabase,

  requireRole(['admin', 'manager', 'inspector']),
  validateRequest(inspectionSchemas.updateItem),
  asyncHandler(async (req, res) => {
    const { id, itemId } = req.params;
    const updateData = req.body;
    const empresaId = req.userData.empresa_id;
    const userId = req.userData.id;
    const userData = req.userData;

    // Verify inspection and item exist
    const { data: inspection, error: inspectionError } = await supabase
      .from('vistorias')
      .select('id, status, vistoriador_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (inspectionError || !inspection) {
      throw new NotFoundError('Vistoria não encontrada');
    }

    const { data: item, error: itemError } = await supabase
      .from('itens_vistoria')
      .select('id')
      .eq('id', itemId)
      .eq('vistoria_id', id)
      .single();

    if (itemError || !item) {
      throw new NotFoundError('Item não encontrado');
    }

    // Check permissions
    const canUpdateItems =
      ['admin', 'manager'].includes(userData.role) ||
      (userData.role === 'inspector' && inspection.vistoriador_id === userId);

    if (!canUpdateItems) {
      throw new AuthorizationError(
        'Sem permissão para atualizar itens desta vistoria'
      );
    }

    const { data: updatedItem, error } = await supabase
      .from('itens_vistoria')
      .update({
        ...updateData,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .eq('vistoria_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating inspection item:', error);
      throw new AppError('Erro ao atualizar item da vistoria', 500);
    }

    console.log('Inspection item updated successfully', {
      itemId,
      inspectionId: id,
      updatedBy: userId
    });

    res.json({
      success: true,
      message: 'Item atualizado com sucesso',
      data: updatedItem
    });
  })
);

/**
 * @swagger
 * /api/v1/inspections/stats:
 *   get:
 *     tags: [Inspections]
 *     summary: Obter estatísticas das vistorias
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas das vistorias
 */
router.get(
  '/stats',
  authSupabase,
  asyncHandler(async (req, res) => {
    const empresaId = req.user.app_metadata.empresa_id;
    const userType = req.userType;
    const userData = req.user;

    let baseQuery = supabase
      .from('vistorias')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresaId);

    // Apply user-specific filters
    if (userType === 'app_user') {
      baseQuery = baseQuery.eq('solicitante_id', userData.id);
    } else if (userType === 'portal_user' && userData.role === 'inspector') {
      baseQuery = baseQuery.eq('vistoriador_id', userData.id);
    }

    // Get various stats in parallel
    const [
      totalResult,
      agendadasResult,
      emAndamentoResult,
      concluidasResult,
      canceladasResult
    ] = await Promise.all([
      baseQuery,
      supabase
        .from('vistorias')
        .select('id', { count: 'exact' })
        .eq('empresa_id', empresaId)
        .eq('status', 'agendada'),
      supabase
        .from('vistorias')
        .select('id', { count: 'exact' })
        .eq('empresa_id', empresaId)
        .eq('status', 'em_andamento'),
      supabase
        .from('vistorias')
        .select('id', { count: 'exact' })
        .eq('empresa_id', empresaId)
        .eq('status', 'concluida'),
      supabase
        .from('vistorias')
        .select('id', { count: 'exact' })
        .eq('empresa_id', empresaId)
        .eq('status', 'cancelada')
    ]);

    const stats = {
      total: totalResult.count || 0,
      agendadas: agendadasResult.count || 0,
      em_andamento: emAndamentoResult.count || 0,
      concluidas: concluidasResult.count || 0,
      canceladas: canceladasResult.count || 0
    };

    res.json({
      success: true,
      data: stats
    });
  })
);

module.exports = router;

