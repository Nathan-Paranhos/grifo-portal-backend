const express = require('express');
const { supabase } = require('../config/supabase.js');
// const { logger } = require('../config/logger.js'); // Temporarily disabled to avoid circular dependency
const {
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError
} = require('../middleware/errorHandler.js');
const authModule = require('../middleware/auth.js');
const { validateRequest, commonSchemas } = require('../middleware/validation.js');
const { z } = require('zod');
const { authMiddleware } = authModule;

// Contest validation schemas
const contestSchemas = {
  status: z.enum(['pending', 'under_review', 'resolved', 'rejected']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  sortBy: z.enum(['created_at', 'updated_at', 'priority', 'status']),
  create: z.object({
    inspection_id: commonSchemas.uuid,
    contestant_name: z.string().min(1, 'Nome do contestante é obrigatório'),
    contestant_email: commonSchemas.email,
    contestant_phone: z.string().optional(),
    contest_type: z.string().min(1, 'Tipo da contestação é obrigatório'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    description: z.string().min(1, 'Descrição é obrigatória')
  }),
  update: z.object({
    contestant_name: z
      .string()
      .min(1, 'Nome do contestante é obrigatório')
      .optional(),
    contestant_email: commonSchemas.email.optional(),
    contestant_phone: z.string().optional(),
    contest_type: z
      .string()
      .min(1, 'Tipo da contestação é obrigatório')
      .optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    description: z.string().min(1, 'Descrição é obrigatória').optional()
  }),
  resolve: z.object({
    resolution_notes: z.string().min(1, 'Notas de resolução são obrigatórias')
  }),
  reopen: z.object({
    reason: z.string().min(1, 'Motivo para reabertura é obrigatório')
  })
};

const router = express.Router();

// All contest routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/contests:
 *   get:
 *     tags: [Contests]
 *     summary: Listar contestações
 *     description: |
 *       Lista todas as contestações da empresa com filtros e paginação.
 *       Inspetores veem apenas contestações de suas vistorias.
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
 *         description: Busca por endereço da propriedade ou nome do contestante
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, under_review, resolved, rejected]
 *       - in: query
 *         name: inspection_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: property_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: created_from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: created_to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, priority, status]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lista de contestações
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
 *                     contests:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Contest'
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
      status: contestSchemas.status.optional(),
      inspection_id: commonSchemas.uuid.optional(),
      property_id: commonSchemas.uuid.optional(),
      priority: contestSchemas.priority.optional(),
      created_from: commonSchemas.date.optional(),
      created_to: commonSchemas.date.optional(),
      sortBy: contestSchemas.sortBy.optional(),
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
      inspection_id: inspectionId,
      property_id: propertyId,
      priority,
      created_from: createdFrom,
      created_to: createdTo,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;

    try {
      let query = supabase
        .from('contests')
        .select(
          `
          id,
          inspection_id,
          contestant_name,
          contestant_email,
          contestant_phone,
          contest_type,
          priority,
          status,
          description,
          created_at,
          updated_at,
          resolved_at,
          resolved_by,
          resolution_notes: resolutionNotes,
          inspections!inner(
            id,
            status as inspection_status,
            scheduled_date,
            inspector_id,
            properties!inner(
              id,
              address,
              city,
              state,
              cep,
              company_id
            ),
            users!inspections_inspector_id_fkey(
              id,
              name as inspector_name
            )
          ),
          users!contests_resolved_by_fkey(
            id,
            name as resolver_name
          )
        `,
          { count: 'exact' }
        )
        .eq('inspections.properties.company_id', user.company_id);

      // Inspectors can only see contests from their own inspections
      if (user.role === 'inspector') {
        query = query.eq('inspections.inspector_id', user.id);
      }

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (inspectionId) {
        query = query.eq('inspection_id', inspectionId);
      }

      if (propertyId) {
        query = query.eq('inspections.properties.id', propertyId);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      if (createdFrom) {
        query = query.gte('created_at', createdFrom);
      }

      if (createdTo) {
        const endDate = new Date(createdTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      if (search) {
        query = query.or(`
          contestant_name.ilike.%${search}%,
          contestant_email.ilike.%${search}%,
          inspections.properties.address.ilike.%${search}%
        `);
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: contests, error, count } = await query;

      if (error) {
        console.error('Contests list error:', error);
        throw new AppError('Erro ao carregar contestações');
      }

      // Process contests to flatten nested data
      const processedContests = contests.map(contest => {
        const inspection = contest.inspections;
        const property = inspection?.properties;
        const inspector = inspection?.users;
        const resolver = contest.users;

        return {
          ...contest,
          inspection: {
            id: inspection?.id,
            status: inspection?.inspection_status,
            scheduled_date: inspection?.scheduled_date,
            inspector: {
              id: inspection?.inspector_id,
              name: inspector?.inspector_name
            }
          },
          property: {
            id: property?.id,
            address: property?.address,
            city: property?.city,
            state: property?.state,
            cep: property?.cep
          },
          resolver: resolver
            ? {
                id: resolver.id,
                name: resolver.resolver_name
              }
            : null,
          inspections: undefined,
          users: undefined
        };
      });

      const totalPages = Math.ceil(count / limit);

      console.log('Contests listed', {
        userId: user.id,
        userRole: user.role,
        count,
        page,
        limit,
        filters: { status, inspectionId, propertyId, priority, search }
      });

      res.json({
        success: true,
        data: {
          contests: processedContests,
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: count,
            pages: totalPages
          }
        }
      });
    } catch (error) {
      console.error('Contests list error:', error);
      throw new AppError('Erro ao carregar contestações');
    }
  })
);

/**
 * @swagger
 * /api/contests/{id}:
 *   get:
 *     tags: [Contests]
 *     summary: Obter contestação por ID
 *     description: |
 *       Retorna os detalhes completos de uma contestação específica.
 *       Inspetores podem ver apenas contestações de suas vistorias.
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
 *         description: Detalhes da contestação
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
 *                     contest:
 *                       $ref: '#/components/schemas/Contest'
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
        .from('contests')
        .select(
          `
          *,
          inspections!inner(
            id,
            status as inspection_status,
            scheduled_date,
            completed_date,
            inspector_id,
            notes,
            properties!inner(
              id,
              address,
              number,
              complement,
              neighborhood,
              city,
              state,
              cep,
              property_type,
              company_id,
              owner_name,
              owner_email,
              owner_phone
            ),
            users!inspections_inspector_id_fkey(
              id,
              name as inspector_name,
              email as inspector_email
            )
          ),
          users!contests_resolved_by_fkey(
            id,
            name as resolver_name,
            email as resolver_email
          )
        `
        )
        .eq('id', id)
        .eq('inspections.properties.company_id', user.company_id);

      // Inspectors can only see contests from their own inspections
      if (user.role === 'inspector') {
        query = query.eq('inspections.inspector_id', user.id);
      }

      const { data: contest, error } = await query.single();

      if (error || !contest) {
        throw new NotFoundError('Contestação não encontrada');
      }

      // Process contest to flatten nested data
      const inspection = contest.inspections;
      const property = inspection?.properties;
      const inspector = inspection?.users;
      const resolver = contest.users;

      const processedContest = {
        ...contest,
        inspection: {
          id: inspection?.id,
          status: inspection?.inspection_status,
          scheduled_date: inspection?.scheduled_date,
          completed_date: inspection?.completed_date,
          notes: inspection?.notes,
          inspector: {
            id: inspection?.inspector_id,
            name: inspector?.inspector_name,
            email: inspector?.inspector_email
          }
        },
        property: {
          id: property?.id,
          address: property?.address,
          number: property?.number,
          complement: property?.complement,
          neighborhood: property?.neighborhood,
          city: property?.city,
          state: property?.state,
          cep: property?.cep,
          property_type: property?.property_type,
          owner: {
            name: property?.owner_name,
            email: property?.owner_email,
            phone: property?.owner_phone
          }
        },
        resolver: resolver
          ? {
              id: resolver.id,
              name: resolver.resolver_name,
              email: resolver.resolver_email
            }
          : null,
        inspections: undefined,
        users: undefined
      };

      console.log('Contest retrieved', {
        userId: user.id,
        contestId: id,
        userRole: user.role,
        inspectionId: contest.inspection_id
      });

      res.json({
        success: true,
        data: {
          contest: processedContest
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('Contest get error:', error);
      throw new AppError('Erro ao carregar contestação');
    }
  })
);

/**
 * @swagger
 * /api/contests:
 *   post:
 *     tags: [Contests]
 *     summary: Criar nova contestação
 *     description: |
 *       Cria uma nova contestação para uma vistoria.
 *       Apenas administradores e gerentes podem criar contestações.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inspection_id
 *               - contestant_name
 *               - contestant_email
 *               - contest_type
 *               - description
 *             properties:
 *               inspection_id:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               contestant_name:
 *                 type: string
 *                 minLength: 2
 *                 example: "João Silva"
 *               contestant_email:
 *                 type: string
 *                 format: email
 *                 example: "joao@email.com"
 *               contestant_phone:
 *                 type: string
 *                 example: "(11) 99999-9999"
 *               contest_type:
 *                 type: string
 *                 enum: [technical_error, procedural_error, access_denied, property_damage, other]
 *                 example: "technical_error"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *                 example: "medium"
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 example: "Descrição detalhada da contestação..."
 *               evidence_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 example: ["https://storage.com/evidence1.jpg"]
 *     responses:
 *       201:
 *         description: Contestação criada com sucesso
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: Vistoria não encontrada
 */
router.post(
  '/',
  validateRequest({ body: contestSchemas.create }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const contestData = req.body;

    try {
      // Verify inspection exists and belongs to company
      const { data: inspection, error: inspectionError } = await supabase
        .from('inspections')
        .select(
          `
          id,
          status,
          properties!inner(
            id,
            company_id
          )
        `
        )
        .eq('id', contestData.inspection_id)
        .eq('properties.company_id', user.company_id)
        .single();

      if (inspectionError || !inspection) {
        throw new NotFoundError('Vistoria não encontrada');
      }

      // Check if inspection is in a valid state for contests
      if (!['completed', 'in_progress'].includes(inspection.status)) {
        throw new ValidationError(
          'Contestações só podem ser criadas para vistorias em andamento ou concluídas'
        );
      }

      // Check if there's already an open contest for this inspection
      const { data: existingContest } = await supabase
        .from('contests')
        .select('id')
        .eq('inspection_id', contestData.inspection_id)
        .in('status', ['pending', 'under_review'])
        .single();

      if (existingContest) {
        throw new ValidationError(
          'Já existe uma contestação em aberto para esta vistoria'
        );
      }

      const { data: contest, error } = await supabase
        .from('contests')
        .insert({
          ...contestData,
          status: 'pending',
          created_by: user.id
        })
        .select(
          `
          *,
          inspections!inner(
            id,
            properties!inner(
              id,
              address,
              city
            )
          )
        `
        )
        .single();

      if (error) {
        console.error('Contest creation error:', error);
        throw new AppError('Erro ao criar contestação');
      }

      console.log('Contest created', {
        userId: user.id,
        contestId: contest.id,
        inspectionId: contestData.inspection_id,
        contestType: contestData.contest_type,
        priority: contestData.priority
      });

      res.status(201).json({
        success: true,
        message: 'Contestação criada com sucesso',
        data: {
          contest
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Contest creation error:', error);
      throw new AppError('Erro ao criar contestação');
    }
  })
);

/**
 * @swagger
 * /api/contests/{id}:
 *   put:
 *     tags: [Contests]
 *     summary: Atualizar contestação
 *     description: |
 *       Atualiza os dados de uma contestação existente.
 *       Apenas administradores e gerentes podem atualizar contestações.
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
 *               contestant_name:
 *                 type: string
 *               contestant_email:
 *                 type: string
 *                 format: email
 *               contestant_phone:
 *                 type: string
 *               contest_type:
 *                 type: string
 *                 enum: [technical_error, procedural_error, access_denied, property_damage, other]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               description:
 *                 type: string
 *               evidence_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *     responses:
 *       200:
 *         description: Contestação atualizada com sucesso
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:id',
  validateRequest({
    params: { id: commonSchemas.uuid },
    body: contestSchemas.update
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;
    const updateData = req.body;

    try {
      // Check if contest exists and belongs to company
      const { data: existingContest, error: checkError } = await supabase
        .from('contests')
        .select(
          `
          id,
          status,
          inspections!inner(
            properties!inner(
              company_id
            )
          )
        `
        )
        .eq('id', id)
        .eq('inspections.properties.company_id', user.company_id)
        .single();

      if (checkError || !existingContest) {
        throw new NotFoundError('Contestação não encontrada');
      }

      // Only allow updates to pending or under_review contests
      if (!['pending', 'under_review'].includes(existingContest.status)) {
        throw new ValidationError(
          'Apenas contestações pendentes ou em análise podem ser atualizadas'
        );
      }

      const { data: contest, error } = await supabase
        .from('contests')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Contest update error:', error);
        throw new AppError('Erro ao atualizar contestação');
      }

      console.log('Contest updated', {
        userId: user.id,
        contestId: id,
        changes: Object.keys(updateData)
      });

      res.json({
        success: true,
        message: 'Contestação atualizada com sucesso',
        data: {
          contest
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Contest update error:', error);
      throw new AppError('Erro ao atualizar contestação');
    }
  })
);

/**
 * @swagger
 * /api/contests/{id}/resolve:
 *   post:
 *     tags: [Contests]
 *     summary: Resolver contestação
 *     description: |
 *       Resolve uma contestação, marcando-a como resolvida ou rejeitada.
 *       Apenas administradores e gerentes podem resolver contestações.
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
 *             required:
 *               - resolution
 *               - resolution_notes
 *             properties:
 *               resolution:
 *                 type: string
 *                 enum: [resolved, rejected]
 *                 example: "resolved"
 *               resolution_notes:
 *                 type: string
 *                 minLength: 10
 *                 example: "Contestação procedente. Vistoria será refeita."
 *     responses:
 *       200:
 *         description: Contestação resolvida com sucesso
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  '/:id/resolve',
  validateRequest({
    params: { id: commonSchemas.uuid },
    body: contestSchemas.resolve
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;
    const { resolution, resolution_notes: resolutionNotes } = req.body;

    try {
      // Check if contest exists and belongs to company
      const { data: existingContest, error: checkError } = await supabase
        .from('contests')
        .select(
          `
          id,
          status,
          inspection_id,
          inspections!inner(
            properties!inner(
              company_id
            )
          )
        `
        )
        .eq('id', id)
        .eq('inspections.properties.company_id', user.company_id)
        .single();

      if (checkError || !existingContest) {
        throw new NotFoundError('Contestação não encontrada');
      }

      // Only allow resolution of pending or under_review contests
      if (!['pending', 'under_review'].includes(existingContest.status)) {
        throw new ValidationError(
          'Apenas contestações pendentes ou em análise podem ser resolvidas'
        );
      }

      const { data: contest, error } = await supabase
        .from('contests')
        .update({
          status: resolution,
          resolution_notes: resolutionNotes,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Contest resolution error:', error);
        throw new AppError('Erro ao resolver contestação');
      }

      console.log('Contest resolved', {
        userId: user.id,
        contestId: id,
        inspectionId: existingContest.inspection_id,
        resolution,
        resolverName: user.name
      });

      res.json({
        success: true,
        message: `Contestação ${resolution === 'resolved' ? 'resolvida' : 'rejeitada'} com sucesso`,
        data: {
          contest
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Contest resolution error:', error);
      throw new AppError('Erro ao resolver contestação');
    }
  })
);

/**
 * @swagger
 * /api/contests/{id}/reopen:
 *   post:
 *     tags: [Contests]
 *     summary: Reabrir contestação
 *     description: |
 *       Reabre uma contestação resolvida ou rejeitada.
 *       Apenas administradores podem reabrir contestações.
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
 *             required:
 *               - reopen_reason
 *             properties:
 *               reopen_reason:
 *                 type: string
 *                 minLength: 10
 *                 example: "Novas evidências foram apresentadas"
 *     responses:
 *       200:
 *         description: Contestação reaberta com sucesso
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  '/:id/reopen',
  validateRequest({
    params: { id: commonSchemas.uuid },
    body: contestSchemas.reopen
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;
    const { reopen_reason: reopenReason } = req.body;

    try {
      // Check if contest exists and belongs to company
      const { data: existingContest, error: checkError } = await supabase
        .from('contests')
        .select(
          `
          id,
          status,
          inspection_id,
          inspections!inner(
            properties!inner(
              company_id
            )
          )
        `
        )
        .eq('id', id)
        .eq('inspections.properties.company_id', user.company_id)
        .single();

      if (checkError || !existingContest) {
        throw new NotFoundError('Contestação não encontrada');
      }

      // Only allow reopening of resolved or rejected contests
      if (!['resolved', 'rejected'].includes(existingContest.status)) {
        throw new ValidationError(
          'Apenas contestações resolvidas ou rejeitadas podem ser reabertas'
        );
      }

      const { data: contest, error } = await supabase
        .from('contests')
        .update({
          status: 'under_review',
          resolution_notes: null,
          resolved_at: null,
          resolved_by: null,
          reopen_reason: reopenReason,
          reopened_at: new Date().toISOString(),
          reopened_by: user.id,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Contest reopen error:', error);
        throw new AppError('Erro ao reabrir contestação');
      }

      console.log('Contest reopened', {
        userId: user.id,
        contestId: id,
        inspectionId: existingContest.inspection_id,
        reopenReason
      });

      res.json({
        success: true,
        message: 'Contestação reaberta com sucesso',
        data: {
          contest
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Contest reopen error:', error);
      throw new AppError('Erro ao reabrir contestação');
    }
  })
);

module.exports = router;

