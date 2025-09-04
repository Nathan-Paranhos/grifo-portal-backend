const express = require('express');
const { z } = require('zod');
const { supabase } = require('../../config/supabase');
// const { logger } = require('../../config/logger.js');
const {
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError
} = require('../../middleware/errorHandler.js');
const { validateRequest, commonSchemas } = require('../../middleware/validation.js');
const { authSupabase, requireRole } = require('../../middleware/auth.js');

const router = express.Router();

// Validation schemas
const tenantSchemas = {
  getTenant: {
    params: z.object({
      slug: z.string().min(1, 'Slug é obrigatório')
    })
  },
  createTenant: {
    body: z.object({
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      slug: z
        .string()
        .min(2, 'Slug deve ter pelo menos 2 caracteres')
        .regex(
          /^[a-z0-9-]+$/,
          'Slug deve conter apenas letras minúsculas, números e hífens'
        ),
      email: commonSchemas.email,
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip_code: z.string().optional(),
      settings: z.object({}).optional()
    })
  },
  updateTenant: {
    params: z.object({
      slug: z.string().min(1, 'Slug é obrigatório')
    }),
    body: z.object({
      name: z
        .string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .optional(),
      email: commonSchemas.email.optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip_code: z.string().optional(),
      settings: z.object({}).optional(),
      status: z.enum(['active', 'inactive', 'suspended']).optional()
    })
  }
};

/**
 * @swagger
 * /api/v1/tenants/{slug}:
 *   get:
 *     tags: [Tenants]
 *     summary: Buscar tenant por slug
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tenant encontrado
 *       404:
 *         description: Tenant não encontrado
 */
router.get(
  '/:slug',
  validateRequest(tenantSchemas.getTenant),
  asyncHandler(async (req, res) => {
    const { slug } = req.params;

    const { data: tenant, error } = await supabase
      .from('empresas')
      .select(
        `
        id,
        name,
        slug,
        email,
        phone,
        address,
        city,
        state,
        zip_code,
        status,
        settings,
        created_at
      `
      )
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (error || !tenant) {
      throw new NotFoundError('Tenant não encontrado');
    }

    res.json({
      success: true,
      data: tenant
    });
  })
);

/**
 * @swagger
 * /api/v1/tenants:
 *   get:
 *     tags: [Tenants]
 *     summary: Listar todos os tenants
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tenants
 */
router.get(
  '/',
  authSupabase,
  requireRole(['super_admin']),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('empresas')
      .select(
        `
        id,
        name,
        slug,
        email,
        phone,
        city,
        state,
        status,
        created_at
      `,
        { count: 'exact' }
      )
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,slug.ilike.%${search}%`
      );
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: tenants, error, count } = await query;

    if (error) {
      console.error('Error fetching tenants:', error);
      throw new AppError('Erro ao buscar tenants', 500);
    }

    res.json({
      success: true,
      data: tenants,
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
 * /api/v1/tenants:
 *   post:
 *     tags: [Tenants]
 *     summary: Criar novo tenant
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       201:
 *         description: Tenant criado com sucesso
 */
router.post(
  '/',
  authSupabase,
  requireRole(['super_admin']),
  validateRequest(tenantSchemas.createTenant),
  asyncHandler(async (req, res) => {
    const tenantData = req.body;

    // Check if slug already exists
    const { data: existingTenant } = await supabase
      .from('empresas')
      .select('id')
      .eq('slug', tenantData.slug)
      .single();

    if (existingTenant) {
      throw new ValidationError('Slug já está em uso');
    }

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('empresas')
      .select('id')
      .eq('email', tenantData.email)
      .single();

    if (existingEmail) {
      throw new ValidationError('Email já está em uso');
    }

    const { data: tenant, error } = await supabase
      .from('empresas')
      .insert({
        ...tenantData,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tenant:', error);
      throw new AppError('Erro ao criar tenant', 500);
    }

    console.log('Tenant created successfully', {
      tenantId: tenant.id,
      slug: tenant.slug
    });

    res.status(201).json({
      success: true,
      message: 'Tenant criado com sucesso',
      data: tenant
    });
  })
);

/**
 * @swagger
 * /api/v1/tenants/{slug}:
 *   put:
 *     tags: [Tenants]
 *     summary: Atualizar tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tenant atualizado com sucesso
 */
router.put(
  '/:slug',
  authSupabase,
  requireRole(['super_admin']),
  validateRequest(tenantSchemas.updateTenant),
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const updateData = req.body;

    // Check if tenant exists
    const { data: existingTenant, error: fetchError } = await supabase
      .from('empresas')
      .select('id')
      .eq('slug', slug)
      .single();

    if (fetchError || !existingTenant) {
      throw new NotFoundError('Tenant não encontrado');
    }

    const { data: tenant, error } = await supabase
      .from('empresas')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('slug', slug)
      .select()
      .single();

    if (error) {
      console.error('Error updating tenant:', error);
      throw new AppError('Erro ao atualizar tenant', 500);
    }

    console.log('Tenant updated successfully', { tenantId: tenant.id, slug });

    res.json({
      success: true,
      message: 'Tenant atualizado com sucesso',
      data: tenant
    });
  })
);

module.exports = router;
