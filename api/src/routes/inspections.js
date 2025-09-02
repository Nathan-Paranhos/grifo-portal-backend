const express = require('express');
const { supabase } = require('../config/supabase.js');
// const { logger } = require('../config/logger.js');
const {
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError
} = require('../middleware/errorHandler.js');
const authModule = require('../middleware/auth.js');
const {
  validateRequest,
  inspectionSchemas,
  commonSchemas
} = require('../middleware/validation.js');
const { authMiddleware } = authModule;

const router = express.Router();

// All inspection routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/inspections:
 *   get:
 *     tags: [Inspections]
 *     summary: Listar vistorias
 *     description: |
 *       Lista todas as vistorias da empresa com paginação e filtros.
 *       Suporta busca por endereço da propriedade, status e período.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por endereço da propriedade
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, completed, cancelled]
 *       - in: query
 *         name: inspector_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por inspetor
 *       - in: query
 *         name: property_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por propriedade
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, scheduled_date, completed_date, status]
 *           default: scheduled_date
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lista de vistorias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     inspections:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Inspection'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 */
router.get(
  '/',
  validateRequest({
    query: {
      ...commonSchemas.pagination,
      ...commonSchemas.search,
      status: inspectionSchemas.status.optional(),
      inspector_id: commonSchemas.uuid.optional(),
      property_id: commonSchemas.uuid.optional(),
      date_from: commonSchemas.date.optional(),
      date_to: commonSchemas.date.optional(),
      sortBy: inspectionSchemas.sortBy.optional(),
      sortOrder: commonSchemas.sortOrder.optional()
    }
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const {
      page = 1,
      limit = 20,
      search,
      status,
      inspector_id: inspectorId,
      property_id: propertyId,
      date_from: dateFrom,
      date_to: dateTo,
      sortBy = 'scheduled_date',
      sortOrder = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;

    try {
      let query = supabase
        .from('vistorias')
        .select(
          `
          id,
          status,
          data_agendamento,
          data_conclusao,
          observacoes_vistoriador,
          feedback_cliente,
          avaliacao,
          created_at,
          updated_at,
          imoveis!inner(
            id,
            endereco,
            cidade,
            estado,
            proprietario_nome,
            tipo_imovel
          ),
          users!inner(
            id,
            name,
            email,
            role
          ),
          contestacoes!left(
            id,
            status,
            motivo
          )
        `,
          { count: 'exact' }
        )
        .eq('empresa_id', user.company_id);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (inspectorId) {
        query = query.eq('vistoriador_id', inspectorId);
      }

      if (propertyId) {
        query = query.eq('imovel_id', propertyId);
      }

      if (dateFrom) {
        query = query.gte('data_agendamento', dateFrom);
      }

      if (dateTo) {
        query = query.lte('data_agendamento', dateTo);
      }

      if (search) {
        query = query.or(`
          imoveis.endereco.ilike.%${search}%,
          imoveis.proprietario_nome.ilike.%${search}%,
          imoveis.cidade.ilike.%${search}%
        `);
      }

      // Role-based filtering
      if (user.role === 'inspector') {
        query = query.eq('vistoriador_id', user.id);
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: inspections, error, count } = await query;

      if (error) {
        console.error('Inspections list error:', error);
        throw new AppError('Erro ao carregar vistorias');
      }

      const totalPages = Math.ceil(count / limit);

      console.log('Inspections listed', {
        userId: user.id,
        companyId: user.company_id,
        count,
        page,
        limit,
        filters: { status, inspectorId, propertyId, search }
      });

      res.json({
        success: true,
        data: {
          inspections,
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: count,
            pages: totalPages
          }
        }
      });
    } catch (error) {
      console.error('Inspections list error:', error);
      throw new AppError('Erro ao carregar vistorias');
    }
  })
);

/**
 * @swagger
 * /api/inspections/{id}:
 *   get:
 *     tags: [Inspections]
 *     summary: Obter vistoria por ID
 *     description: Retorna os detalhes completos de uma vistoria específica
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
 *         description: Detalhes da vistoria
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     inspection:
 *                       $ref: '#/components/schemas/Inspection'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    try {
      let query = supabase
        .from('vistorias')
        .select(
          `
          *,
          imoveis!inner(
            id,
            endereco,
            cep,
            cidade,
            estado,
            bairro,
            proprietario_nome,
            proprietario_email,
            proprietario_telefone,
            tipo_imovel,
            area
          ),
          users!inner(
            id,
            name,
            email,
            phone,
            role
          ),
          contestacoes!left(
            id,
            status,
            motivo,
            descricao,
            created_at,
            data_resolucao,
            observacoes_resolucao
          )
        `
        )
        .eq('id', id)
        .eq('empresa_id', user.company_id);

      // Role-based filtering
      if (user.role === 'inspector') {
        query = query.eq('vistoriador_id', user.id);
      }

      const { data: inspection, error } = await query.single();

      if (error || !inspection) {
        throw new NotFoundError('Vistoria não encontrada');
      }

      console.log('Inspection retrieved', {
        userId: user.id,
        inspectionId: id,
        companyId: user.company_id
      });

      res.json({
        success: true,
        data: {
          inspection
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('Inspection get error:', error);
      throw new AppError('Erro ao carregar vistoria');
    }
  })
);

/**
 * @swagger
 * /api/inspections:
 *   post:
 *     tags: [Inspections]
 *     summary: Criar nova vistoria
 *     description: Cria uma nova vistoria no sistema
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - property_id
 *               - inspector_id
 *               - scheduled_date
 *             properties:
 *               property_id:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               inspector_id:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174001"
 *               scheduled_date:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T10:00:00Z"
 *               notes:
 *                 type: string
 *                 example: "Vistoria de rotina"
 *     responses:
 *       201:
 *         description: Vistoria criada com sucesso
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post(
  '/',
  validateRequest({ body: inspectionSchemas.create }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const {
      property_id: propertyId,
      inspector_id: inspectorId,
      scheduled_date: scheduledDate,
      notes
    } = req.body;

    // Only admins and managers can create inspections
    if (!['admin', 'manager'].includes(user.role)) {
      throw new ValidationError('Sem permissão para criar vistorias');
    }

    try {
      // Validate property exists and belongs to company
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('id, status')
        .eq('id', propertyId)
        .eq('company_id', user.company_id)
        .single();

      if (propertyError || !property) {
        throw new ValidationError('Propriedade não encontrada');
      }

      if (property.status !== 'active') {
        throw new ValidationError(
          'Não é possível criar vistoria para propriedade inativa'
        );
      }

      // Validate inspector exists and belongs to company
      const { data: inspector, error: inspectorError } = await supabase
        .from('users')
        .select('id, role, status')
        .eq('id', inspectorId)
        .eq('company_id', user.company_id)
        .single();

      if (inspectorError || !inspector) {
        throw new ValidationError('Inspetor não encontrado');
      }

      if (inspector.status !== 'active') {
        throw new ValidationError('Inspetor está inativo');
      }

      if (!['inspector', 'manager', 'admin'].includes(inspector.role)) {
        throw new ValidationError(
          'Usuário não tem permissão para realizar vistorias'
        );
      }

      // Check if there's already a pending inspection for this property
      const { data: existingInspection } = await supabase
        .from('inspections')
        .select('id')
        .eq('property_id', propertyId)
        .eq('company_id', user.company_id)
        .in('status', ['pending', 'in_progress'])
        .single();

      if (existingInspection) {
        throw new ValidationError(
          'Já existe uma vistoria pendente ou em andamento para esta propriedade'
        );
      }

      // Validate scheduled date is in the future
      const scheduledDateTime = new Date(scheduledDate);
      if (scheduledDateTime <= new Date()) {
        throw new ValidationError('Data da vistoria deve ser no futuro');
      }

      const { data: inspection, error } = await supabase
        .from('inspections')
        .insert({
          property_id: propertyId,
          inspector_id: inspectorId,
          scheduled_date: scheduledDate,
          notes,
          company_id: user.company_id,
          created_by: user.id,
          status: 'pending'
        })
        .select(
          `
          *,
          properties!inner(
            address,
            owner_name
          ),
          users!inner(
            name,
            email
          )
        `
        )
        .single();

      if (error) {
        console.error('Inspection creation error:', error);
        throw new AppError('Erro ao criar vistoria');
      }

      console.log('Inspection created', {
        userId: user.id,
        inspectionId: inspection.id,
        propertyId,
        inspectorId,
        companyId: user.company_id
      });

      res.status(201).json({
        success: true,
        message: 'Vistoria criada com sucesso',
        data: {
          inspection
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error('Inspection creation error:', error);
      throw new AppError('Erro ao criar vistoria');
    }
  })
);

/**
 * @swagger
 * /api/inspections/{id}:
 *   put:
 *     tags: [Inspections]
 *     summary: Atualizar vistoria
 *     description: Atualiza os dados de uma vistoria existente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               scheduled_date:
 *                 type: string
 *                 format: date-time
 *               inspector_id:
 *                 type: string
 *                 format: uuid
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed, cancelled]
 *               inspector_notes:
 *                 type: string
 *               client_feedback:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *     responses:
 *       200:
 *         description: Vistoria atualizada com sucesso
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:id',
  validateRequest({
    params: { id: commonSchemas.uuid },
    body: inspectionSchemas.update
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;
    const updateData = req.body;

    try {
      // Get current inspection
      let query = supabase
        .from('inspections')
        .select('*')
        .eq('id', id)
        .eq('company_id', user.company_id);

      // Role-based filtering
      if (user.role === 'inspector') {
        query = query.eq('inspector_id', user.id);
      }

      const { data: inspection, error: checkError } = await query.single();

      if (checkError || !inspection) {
        throw new NotFoundError('Vistoria não encontrada');
      }

      // Validate permissions for different updates
      if (updateData.status) {
        // Only inspectors can mark as in_progress or completed
        if (['in_progress', 'completed'].includes(updateData.status)) {
          if (
            user.role === 'inspector' &&
            inspection.inspector_id !== user.id
          ) {
            throw new ValidationError(
              'Apenas o inspetor responsável pode atualizar o status'
            );
          }
        }

        // Only admins and managers can cancel inspections
        if (
          updateData.status === 'cancelled' &&
          !['admin', 'manager'].includes(user.role)
        ) {
          throw new ValidationError('Sem permissão para cancelar vistorias');
        }

        // Set completed_date when marking as completed
        if (
          updateData.status === 'completed' &&
          inspection.status !== 'completed'
        ) {
          updateData.completed_date = new Date().toISOString();
        }
      }

      // Validate inspector change
      if (
        updateData.inspectorId &&
        updateData.inspectorId !== inspection.inspector_id
      ) {
        if (!['admin', 'manager'].includes(user.role)) {
          throw new ValidationError('Sem permissão para alterar inspetor');
        }

        // Validate new inspector
        const { data: newInspector, error: inspectorError } = await supabase
          .from('users')
          .select('id, role, status')
          .eq('id', updateData.inspectorId)
          .eq('company_id', user.company_id)
          .single();

        if (inspectorError || !newInspector) {
          throw new ValidationError('Novo inspetor não encontrado');
        }

        if (newInspector.status !== 'active') {
          throw new ValidationError('Novo inspetor está inativo');
        }

        if (!['inspector', 'manager', 'admin'].includes(newInspector.role)) {
          throw new ValidationError(
            'Usuário não tem permissão para realizar vistorias'
          );
        }
      }

      // Validate scheduled date change
      if (updateData.scheduledDate) {
        const newScheduledDate = new Date(updateData.scheduledDate);
        if (newScheduledDate <= new Date() && inspection.status === 'pending') {
          throw new ValidationError('Data da vistoria deve ser no futuro');
        }
      }

      const { data: updatedInspection, error } = await supabase
        .from('inspections')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', id)
        .eq('company_id', user.company_id)
        .select(
          `
          *,
          properties!inner(
            address,
            owner_name
          ),
          users!inner(
            name,
            email
          )
        `
        )
        .single();

      if (error) {
        console.error('Inspection update error:', error);
        throw new AppError('Erro ao atualizar vistoria');
      }

      console.log('Inspection updated', {
        userId: user.id,
        inspectionId: id,
        companyId: user.company_id,
        changes: Object.keys(updateData),
        newStatus: updateData.status
      });

      res.json({
        success: true,
        message: 'Vistoria atualizada com sucesso',
        data: {
          inspection: updatedInspection
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Inspection update error:', error);
      throw new AppError('Erro ao atualizar vistoria');
    }
  })
);

/**
 * @swagger
 * /api/inspections/{id}:
 *   delete:
 *     tags: [Inspections]
 *     summary: Excluir vistoria
 *     description: |
 *       Exclui uma vistoria do sistema.
 *       Apenas vistorias com status 'pending' podem ser excluídas.
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
 *         description: Vistoria excluída com sucesso
 *       400:
 *         description: Vistoria não pode ser excluída
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  '/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    // Only admins and managers can delete inspections
    if (!['admin', 'manager'].includes(user.role)) {
      throw new ValidationError('Sem permissão para excluir vistorias');
    }

    try {
      // Check if inspection exists and belongs to company
      const { data: inspection, error: checkError } = await supabase
        .from('inspections')
        .select(
          `
          id,
          status,
          properties!inner(address),
          contestations!left(id)
        `
        )
        .eq('id', id)
        .eq('company_id', user.company_id)
        .single();

      if (checkError || !inspection) {
        throw new NotFoundError('Vistoria não encontrada');
      }

      // Only allow deletion of pending inspections
      if (inspection.status !== 'pending') {
        throw new ValidationError(
          'Apenas vistorias pendentes podem ser excluídas. ' +
            'Para vistorias em andamento ou concluídas, use o cancelamento.'
        );
      }

      // Check if inspection has contestations
      if (inspection.contestations && inspection.contestations.length > 0) {
        throw new ValidationError(
          'Não é possível excluir vistoria que possui contestações.'
        );
      }

      const { error: deleteError } = await supabase
        .from('inspections')
        .delete()
        .eq('id', id)
        .eq('company_id', user.company_id);

      if (deleteError) {
        console.error('Inspection deletion error:', deleteError);
        throw new AppError('Erro ao excluir vistoria');
      }

      console.log('Inspection deleted', {
        userId: user.id,
        inspectionId: id,
        companyId: user.company_id,
        propertyAddress: inspection.properties.address
      });

      res.json({
        success: true,
        message: 'Vistoria excluída com sucesso'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Inspection deletion error:', error);
      throw new AppError('Erro ao excluir vistoria');
    }
  })
);

module.exports = router;
