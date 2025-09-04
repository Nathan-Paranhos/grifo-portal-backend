const express = require('express');
const { z } = require('zod');
const { supabase } = require('../../config/supabase.js');
// const { logger } = require('../../config/logger.js');
const {
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError
} = require('../../middleware/errorHandler.js');
const { validateRequest, commonSchemas } = require('../../middleware/validation.js');
const { authSupabase, requireRole } = require('../../middleware/auth.js');

const router = express.Router();

// Validation schemas
const propertySchemas = {
  getProperty: {
    params: z.object({
      id: commonSchemas.uuid
    })
  },
  createProperty: {
    body: z.object({
      endereco: z.string().min(5, 'Endereço deve ter pelo menos 5 caracteres'),
      cidade: z.string().min(2, 'Cidade deve ter pelo menos 2 caracteres'),
      estado: z.string().length(2, 'Estado deve ter 2 caracteres'),
      cep: z
        .string()
        .regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato 00000-000'),
      tipo_imovel: z.enum([
        'casa',
        'apartamento',
        'comercial',
        'terreno',
        'outros'
      ]),
      area_total: z
        .number()
        .positive('Área total deve ser positiva')
        .optional(),
      area_construida: z
        .number()
        .positive('Área construída deve ser positiva')
        .optional(),
      quartos: z
        .number()
        .int()
        .min(0, 'Número de quartos deve ser positivo')
        .optional(),
      banheiros: z
        .number()
        .int()
        .min(0, 'Número de banheiros deve ser positivo')
        .optional(),
      vagas_garagem: z
        .number()
        .int()
        .min(0, 'Número de vagas deve ser positivo')
        .optional(),
      valor_estimado: z
        .number()
        .positive('Valor estimado deve ser positivo')
        .optional(),
      proprietario_nome: z
        .string()
        .min(2, 'Nome do proprietário deve ter pelo menos 2 caracteres')
        .optional(),
      proprietario_email: commonSchemas.email.optional(),
      proprietario_telefone: z.string().optional(),
      observacoes: z.string().optional(),
      coordenadas: z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180)
        })
        .optional()
    })
  },
  updateProperty: {
    params: z.object({
      id: commonSchemas.uuid
    }),
    body: z.object({
      endereco: z
        .string()
        .min(5, 'Endereço deve ter pelo menos 5 caracteres')
        .optional(),
      cidade: z
        .string()
        .min(2, 'Cidade deve ter pelo menos 2 caracteres')
        .optional(),
      estado: z.string().length(2, 'Estado deve ter 2 caracteres').optional(),
      cep: z
        .string()
        .regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato 00000-000')
        .optional(),
      tipo_imovel: z
        .enum(['casa', 'apartamento', 'comercial', 'terreno', 'outros'])
        .optional(),
      area_total: z
        .number()
        .positive('Área total deve ser positiva')
        .optional(),
      area_construida: z
        .number()
        .positive('Área construída deve ser positiva')
        .optional(),
      quartos: z
        .number()
        .int()
        .min(0, 'Número de quartos deve ser positivo')
        .optional(),
      banheiros: z
        .number()
        .int()
        .min(0, 'Número de banheiros deve ser positivo')
        .optional(),
      vagas_garagem: z
        .number()
        .int()
        .min(0, 'Número de vagas deve ser positivo')
        .optional(),
      valor_estimado: z
        .number()
        .positive('Valor estimado deve ser positivo')
        .optional(),
      proprietario_nome: z
        .string()
        .min(2, 'Nome do proprietário deve ter pelo menos 2 caracteres')
        .optional(),
      proprietario_email: commonSchemas.email.optional(),
      proprietario_telefone: z.string().optional(),
      observacoes: z.string().optional(),
      coordenadas: z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180)
        })
        .optional(),
      status: z.enum(['ativo', 'inativo', 'vendido', 'alugado']).optional()
    })
  }
};

/**
 * @swagger
 * /api/v1/properties:
 *   get:
 *     tags: [Properties]
 *     summary: Listar propriedades
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
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: tipo_imovel
 *         schema:
 *           type: string
 *           enum: [casa, apartamento, comercial, terreno, outros]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ativo, inativo, vendido, alugado]
 *     responses:
 *       200:
 *         description: Lista de propriedades
 */
router.get(
  '/',
  authSupabase,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search,
      tipo_imovel: tipoImovel,
      status,
      cidade,
      estado
    } = req.query;
    const offset = (page - 1) * limit;
    console.log('DEBUG - req.user:', req.user);
    console.log('DEBUG - req.user type:', typeof req.user);

    if (!req.user) {
      throw new AuthenticationError('Usuário não autenticado');
    }

    if (!req.user.empresa_id) {
      throw new AuthenticationError('Empresa não identificada para o usuário');
    }

    const empresaId = req.user.empresa_id;

    let query = supabase
      .from('imoveis')
      .select(
        `
        id,
        endereco,
        cidade,
        estado,
        cep,
        tipo,
        codigo,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .eq('empresa_id', empresaId)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(
        `endereco.ilike.%${search}%,cidade.ilike.%${search}%,proprietario_nome.ilike.%${search}%`
      );
    }

    if (tipoImovel) {
      query = query.eq('tipo_imovel', tipoImovel);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (cidade) {
      query = query.ilike('cidade', `%${cidade}%`);
    }

    if (estado) {
      query = query.eq('estado', estado);
    }

    console.log('Executing properties query with params:', {
      empresaId,
      page,
      limit,
      search,
      status
    });

    const { data: properties, error, count } = await query;

    if (error) {
      console.error('Supabase error details:', {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new AppError(`Erro ao buscar propriedades: ${error.message}`, 500);
    }

    res.json({
      success: true,
      data: properties,
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
 * /api/v1/properties/{id}:
 *   get:
 *     tags: [Properties]
 *     summary: Obter propriedade por ID
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
 *         description: Dados da propriedade
 *       404:
 *         description: Propriedade não encontrada
 */
router.get(
  '/:id',
  authSupabase,
  validateRequest(propertySchemas.getProperty),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;

    const { data: property, error } = await supabase
      .from('imoveis')
      .select(
        `
        id,
        endereco,
        cidade,
        estado,
        cep,
        tipo,
        codigo,
        created_at,
        updated_at,
        vistorias(
          id,
          data_vistoria,
          status,
          tipo_vistoria,
          vistoriador_id,
          portal_users!vistorias_vistoriador_id_fkey(
            name
          )
        )
      `
      )
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (error || !property) {
      throw new NotFoundError('Propriedade não encontrada');
    }

    res.json({
      success: true,
      data: property
    });
  })
);

/**
 * @swagger
 * /api/v1/properties:
 *   post:
 *     tags: [Properties]
 *     summary: Criar nova propriedade
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endereco
 *               - cidade
 *               - estado
 *               - cep
 *               - tipo_imovel
 *             properties:
 *               endereco:
 *                 type: string
 *               cidade:
 *                 type: string
 *               estado:
 *                 type: string
 *               cep:
 *                 type: string
 *               tipo_imovel:
 *                 type: string
 *                 enum: [casa, apartamento, comercial, terreno, outros]
 *     responses:
 *       201:
 *         description: Propriedade criada com sucesso
 */
router.post(
  '/',
  authSupabase,
  requireRole(['admin', 'manager', 'inspector']),
  validateRequest(propertySchemas.createProperty),
  asyncHandler(async (req, res) => {
    const propertyData = req.body;
    const empresaId = req.user.empresa_id;
    const userId = req.user.id;

    const { data: property, error } = await supabase
      .from('imoveis')
      .insert({
        ...propertyData,
        empresa_id: empresaId,
        created_by: userId,
        status: 'ativo',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating property:', error);
      throw new AppError('Erro ao criar propriedade', 500);
    }

    console.log('Property created successfully', {
      propertyId: property.id,
      createdBy: userId,
      empresaId
    });

    res.status(201).json({
      success: true,
      message: 'Propriedade criada com sucesso',
      data: property
    });
  })
);

/**
 * @swagger
 * /api/v1/properties/{id}:
 *   put:
 *     tags: [Properties]
 *     summary: Atualizar propriedade
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
 *         description: Propriedade atualizada com sucesso
 */
router.put(
  '/:id',
  authSupabase,
  requireRole(['admin', 'manager', 'inspector']),
  validateRequest(propertySchemas.updateProperty),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const empresaId = req.user.empresa_id;
    const userId = req.user.id;

    // Check if property exists and belongs to the company
    const { data: existingProperty, error: fetchError } = await supabase
      .from('imoveis')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (fetchError || !existingProperty) {
      throw new NotFoundError('Propriedade não encontrada');
    }

    const { data: property, error } = await supabase
      .from('imoveis')
      .update({
        ...updateData,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (error) {
      console.error('Error updating property:', error);
      throw new AppError('Erro ao atualizar propriedade', 500);
    }

    console.log('Property updated successfully', {
      propertyId: id,
      updatedBy: userId,
      empresaId
    });

    res.json({
      success: true,
      message: 'Propriedade atualizada com sucesso',
      data: property
    });
  })
);

/**
 * @swagger
 * /api/v1/properties/{id}:
 *   delete:
 *     tags: [Properties]
 *     summary: Excluir propriedade
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
 */
router.delete(
  '/:id',
  authSupabase,
  requireRole(['admin', 'manager']),
  validateRequest(propertySchemas.getProperty),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;
    const userId = req.user.id;

    // Check if property exists and belongs to the company
    const { data: existingProperty, error: fetchError } = await supabase
      .from('imoveis')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (fetchError || !existingProperty) {
      throw new NotFoundError('Propriedade não encontrada');
    }

    // Check if property has active inspections
    const { data: activeInspections, error: inspectionError } = await supabase
      .from('vistorias')
      .select('id')
      .eq('imovel_id', id)
      .in('status', ['agendada', 'em_andamento'])
      .limit(1);

    if (inspectionError) {
      console.error('Error checking active inspections:', inspectionError);
      throw new AppError('Erro ao verificar vistorias ativas', 500);
    }

    if (activeInspections && activeInspections.length > 0) {
      throw new ValidationError(
        'Não é possível excluir propriedade com vistorias ativas'
      );
    }

    const { error: deleteError } = await supabase
      .from('imoveis')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId);

    if (deleteError) {
      console.error('Error deleting property:', deleteError);
      throw new AppError('Erro ao excluir propriedade', 500);
    }

    console.log('Property deleted successfully', {
      propertyId: id,
      deletedBy: userId,
      empresaId
    });

    res.json({
      success: true,
      message: 'Propriedade excluída com sucesso'
    });
  })
);

/**
 * @swagger
 * /api/v1/properties/{id}/inspections:
 *   get:
 *     tags: [Properties]
 *     summary: Listar vistorias da propriedade
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
 *         description: Lista de vistorias da propriedade
 */
router.get(
  '/:id/inspections',
  authSupabase,
  validateRequest(propertySchemas.getProperty),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const empresaId = req.user.empresa_id;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    // Verify property belongs to company
    const { data: property, error: propertyError } = await supabase
      .from('imoveis')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (propertyError || !property) {
      throw new NotFoundError('Propriedade não encontrada');
    }

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
        portal_users!vistorias_vistoriador_id_fkey(
          id,
          name,
          email
        ),
        app_users!vistorias_solicitante_id_fkey(
          id,
          name,
          email
        )
      `,
        { count: 'exact' }
      )
      .eq('imovel_id', id)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: inspections, error, count } = await query;

    if (error) {
      console.error('Error fetching property inspections:', error);
      throw new AppError('Erro ao buscar vistorias da propriedade', 500);
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
 * /api/v1/properties/stats:
 *   get:
 *     tags: [Properties]
 *     summary: Obter estatísticas das propriedades
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas das propriedades
 */
router.get(
  '/stats',
  authSupabase,
  asyncHandler(async (req, res) => {
    const empresaId = req.user.empresa_id;

    // Get various stats in parallel
    const [totalResult, activeResult, typeStatsResult, cityStatsResult] =
      await Promise.all([
        supabase
          .from('imoveis')
          .select('id', { count: 'exact' })
          .eq('empresa_id', empresaId),
        supabase
          .from('imoveis')
          .select('id', { count: 'exact' })
          .eq('empresa_id', empresaId)
          .eq('status', 'ativo'),
        supabase
          .from('imoveis')
          .select('tipo_imovel', { count: 'exact' })
          .eq('empresa_id', empresaId),
        supabase
          .from('imoveis')
          .select('cidade', { count: 'exact' })
          .eq('empresa_id', empresaId)
      ]);

    // Process type statistics
    const typeStats = {};
    if (typeStatsResult.data) {
      typeStatsResult.data.forEach(item => {
        typeStats[item.tipo_imovel] = (typeStats[item.tipo_imovel] || 0) + 1;
      });
    }

    // Process city statistics (top 5)
    const cityStats = {};
    if (cityStatsResult.data) {
      cityStatsResult.data.forEach(item => {
        cityStats[item.cidade] = (cityStats[item.cidade] || 0) + 1;
      });
    }

    const topCities = Object.entries(cityStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([city, count]) => ({ city, count }));

    const stats = {
      total: totalResult.count || 0,
      active: activeResult.count || 0,
      by_type: typeStats,
      top_cities: topCities
    };

    res.json({
      success: true,
      data: stats
    });
  })
);

module.exports = router;

