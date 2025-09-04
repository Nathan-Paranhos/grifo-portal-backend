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
  propertySchemas,
  commonSchemas
} = require('../middleware/validation.js');
const { authMiddleware } = authModule;

const router = express.Router();

// All property routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/properties:
 *   get:
 *     tags: [Properties]
 *     summary: Listar propriedades
 *     description: |
 *       Lista todas as propriedades da empresa com paginação e filtros.
 *       Suporta busca por endereço, CEP, proprietário e filtros por status.
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
 *         description: Busca por endereço, CEP ou proprietário
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, address, owner_name]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lista de propriedades
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
 *                     properties:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Property'
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
      status: propertySchemas.status.optional(),
      sortBy: propertySchemas.sortBy.optional(),
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
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;

    try {
      let query = supabase
        .from('imoveis')
        .select(
          `
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
          area,
          status,
          observacoes,
          created_at,
          updated_at,
          vistorias!left(
            id,
            status,
            data_agendamento
          )
        `,
          { count: 'exact' }
        )
        .eq('empresa_id', user.company_id);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`
          endereco.ilike.%${search}%,
          cep.ilike.%${search}%,
          proprietario_nome.ilike.%${search}%,
          proprietario_email.ilike.%${search}%,
          cidade.ilike.%${search}%,
          bairro.ilike.%${search}%
        `);
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: properties, error, count } = await query;

      if (error) {
        console.error('Properties list error:', error);
        throw new AppError('Erro ao carregar propriedades');
      }

      // Process properties to add inspection counts
      const processedProperties = properties.map(property => {
        const inspectionCounts = {
          total: property.vistorias.length,
          pending: property.vistorias.filter(i => i.status === 'pendente')
            .length,
          completed: property.vistorias.filter(i => i.status === 'concluida')
            .length
        };

        const lastInspection = property.vistorias.sort(
          (a, b) => new Date(b.data_agendamento) - new Date(a.data_agendamento)
        )[0];

        return {
          ...property,
          inspection_counts: inspectionCounts,
          last_inspection: lastInspection || null,
          vistorias: undefined // Remove detailed inspections from response
        };
      });

      const totalPages = Math.ceil(count / limit);

      console.log('Properties listed', {
        userId: user.id,
        companyId: user.company_id,
        count,
        page,
        limit,
        search,
        status
      });

      res.json({
        success: true,
        data: {
          properties: processedProperties,
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: count,
            pages: totalPages
          }
        }
      });
    } catch (error) {
      console.error('Properties list error:', error);
      throw new AppError('Erro ao carregar propriedades');
    }
  })
);

/**
 * @swagger
 * /api/properties/{id}:
 *   get:
 *     tags: [Properties]
 *     summary: Obter propriedade por ID
 *     description: Retorna os detalhes completos de uma propriedade específica
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
 *         description: Detalhes da propriedade
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
 *                     property:
 *                       $ref: '#/components/schemas/Property'
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
      const { data: property, error } = await supabase
        .from('imoveis')
        .select(
          `
          *,
          vistorias!left(
            id,
            status,
            data_agendamento,
            data_conclusao,
            observacoes_vistoriador,
            users!inner(
              name,
              email
            )
          )
        `
        )
        .eq('id', id)
        .eq('empresa_id', user.company_id)
        .single();

      if (error || !property) {
        throw new NotFoundError('Propriedade não encontrada');
      }

      // Sort inspections by date
      if (property.vistorias) {
        property.vistorias.sort(
          (a, b) => new Date(b.data_agendamento) - new Date(a.data_agendamento)
        );
      }

      console.log('Property retrieved', {
        userId: user.id,
        propertyId: id,
        companyId: user.company_id
      });

      res.json({
        success: true,
        data: {
          property
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('Property get error:', error);
      throw new AppError('Erro ao carregar propriedade');
    }
  })
);

/**
 * @swagger
 * /api/properties:
 *   post:
 *     tags: [Properties]
 *     summary: Criar nova propriedade
 *     description: Cria uma nova propriedade no sistema
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *               - cep
 *               - city
 *               - state
 *               - owner_name
 *               - property_type
 *             properties:
 *               address:
 *                 type: string
 *                 example: "Rua das Flores, 123"
 *               cep:
 *                 type: string
 *                 pattern: '^\d{5}-?\d{3}$'
 *                 example: "01234-567"
 *               city:
 *                 type: string
 *                 example: "São Paulo"
 *               state:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 2
 *                 example: "SP"
 *               neighborhood:
 *                 type: string
 *                 example: "Centro"
 *               owner_name:
 *                 type: string
 *                 example: "João Silva"
 *               owner_email:
 *                 type: string
 *                 format: email
 *                 example: "joao@exemplo.com"
 *               owner_phone:
 *                 type: string
 *                 example: "(11) 99999-9999"
 *               property_type:
 *                 type: string
 *                 enum: [residential, commercial, industrial, rural]
 *                 example: "residential"
 *               area:
 *                 type: number
 *                 minimum: 0
 *                 example: 120.5
 *               notes:
 *                 type: string
 *                 example: "Casa com 3 quartos"
 *     responses:
 *       201:
 *         description: Propriedade criada com sucesso
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post(
  '/',
  validateRequest({ body: propertySchemas.create }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const propertyData = req.body;

    // Only admins and managers can create properties
    if (!['admin', 'manager'].includes(user.role)) {
      throw new ValidationError('Sem permissão para criar propriedades');
    }

    try {
      // Check if property with same address already exists
      const { data: existingProperty } = await supabase
        .from('imoveis')
        .select('id')
        .eq('empresa_id', user.company_id)
        .eq('endereco', propertyData.endereco)
        .eq('cep', propertyData.cep)
        .single();

      if (existingProperty) {
        throw new ValidationError(
          'Já existe uma propriedade com este endereço e CEP'
        );
      }

      const { data: property, error } = await supabase
        .from('imoveis')
        .insert({
          ...propertyData,
          empresa_id: user.company_id,
          created_by: user.id,
          status: 'ativo'
        })
        .select()
        .single();

      if (error) {
        console.error('Property creation error:', error);
        throw new AppError('Erro ao criar propriedade');
      }

      console.log('Property created', {
        userId: user.id,
        propertyId: property.id,
        companyId: user.company_id,
        endereco: property.endereco
      });

      res.status(201).json({
        success: true,
        message: 'Propriedade criada com sucesso',
        data: {
          property
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error('Property creation error:', error);
      throw new AppError('Erro ao criar propriedade');
    }
  })
);

/**
 * @swagger
 * /api/properties/{id}:
 *   put:
 *     tags: [Properties]
 *     summary: Atualizar propriedade
 *     description: Atualiza os dados de uma propriedade existente
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
 *               address:
 *                 type: string
 *               cep:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               neighborhood:
 *                 type: string
 *               owner_name:
 *                 type: string
 *               owner_email:
 *                 type: string
 *               owner_phone:
 *                 type: string
 *               property_type:
 *                 type: string
 *               area:
 *                 type: number
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Propriedade atualizada com sucesso
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:id',
  validateRequest({
    params: { id: commonSchemas.uuid },
    body: propertySchemas.update
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;
    const updateData = req.body;

    // Only admins and managers can update properties
    if (!['admin', 'manager'].includes(user.role)) {
      throw new ValidationError('Sem permissão para atualizar propriedades');
    }

    try {
      // Check if property exists and belongs to company
      const { data: existingProperty, error: checkError } = await supabase
        .from('imoveis')
        .select('id, endereco, cep')
        .eq('id', id)
        .eq('empresa_id', user.company_id)
        .single();

      if (checkError || !existingProperty) {
        throw new NotFoundError('Propriedade não encontrada');
      }

      // If address or CEP is being changed, check for duplicates
      if (updateData.endereco || updateData.cep) {
        const newAddress = updateData.endereco || existingProperty.endereco;
        const newCep = updateData.cep || existingProperty.cep;

        const { data: duplicateProperty } = await supabase
          .from('imoveis')
          .select('id')
          .eq('empresa_id', user.company_id)
          .eq('endereco', newAddress)
          .eq('cep', newCep)
          .neq('id', id)
          .single();

        if (duplicateProperty) {
          throw new ValidationError(
            'Já existe uma propriedade com este endereço e CEP'
          );
        }
      }

      const { data: property, error } = await supabase
        .from('imoveis')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', id)
        .eq('empresa_id', user.company_id)
        .select()
        .single();

      if (error) {
        console.error('Property update error:', error);
        throw new AppError('Erro ao atualizar propriedade');
      }

      console.log('Property updated', {
        userId: user.id,
        propertyId: id,
        companyId: user.company_id,
        changes: Object.keys(updateData)
      });

      res.json({
        success: true,
        message: 'Propriedade atualizada com sucesso',
        data: {
          property
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Property update error:', error);
      throw new AppError('Erro ao atualizar propriedade');
    }
  })
);

/**
 * @swagger
 * /api/properties/{id}:
 *   delete:
 *     tags: [Properties]
 *     summary: Excluir propriedade
 *     description: |
 *       Exclui uma propriedade do sistema.
 *       Apenas propriedades sem vistorias podem ser excluídas.
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
 *         description: Propriedade excluída com sucesso
 *       400:
 *         description: Propriedade possui vistorias e não pode ser excluída
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  '/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    // Only admins can delete properties
    if (user.role !== 'admin') {
      throw new ValidationError('Sem permissão para excluir propriedades');
    }

    try {
      // Check if property exists and belongs to company
      const { data: property, error: checkError } = await supabase
        .from('properties')
        .select(
          `
          id,
          address,
          inspections!left(id)
        `
        )
        .eq('id', id)
        .eq('company_id', user.company_id)
        .single();

      if (checkError || !property) {
        throw new NotFoundError('Propriedade não encontrada');
      }

      // Check if property has inspections
      if (property.inspections && property.inspections.length > 0) {
        throw new ValidationError(
          'Não é possível excluir propriedade que possui vistorias. ' +
            'Exclua as vistorias primeiro ou desative a propriedade.'
        );
      }

      const { error: deleteError } = await supabase
        .from('properties')
        .delete()
        .eq('id', id)
        .eq('company_id', user.company_id);

      if (deleteError) {
        console.error('Property deletion error:', deleteError);
        throw new AppError('Erro ao excluir propriedade');
      }

      console.log('Property deleted', {
        userId: user.id,
        propertyId: id,
        companyId: user.company_id,
        address: property.address
      });

      res.json({
        success: true,
        message: 'Propriedade excluída com sucesso'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Property deletion error:', error);
      throw new AppError('Erro ao excluir propriedade');
    }
  })
);

module.exports = router;

