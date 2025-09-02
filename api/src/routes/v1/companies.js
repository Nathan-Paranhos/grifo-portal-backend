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

const router = express.Router();

// Validation schemas
const companySchemas = {
  getCompany: {
    params: z.object({
      id: commonSchemas.uuid
    })
  },
  updateCompany: {
    params: z.object({
      id: commonSchemas.uuid
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
      settings: z.object({}).optional()
    })
  },
  createMember: {
    params: z.object({
      id: commonSchemas.uuid
    }),
    body: z.object({
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      email: commonSchemas.email,
      role: z.enum(['admin', 'manager', 'inspector', 'viewer']),
      permissions: z.array(z.string()).optional(),
      phone: z.string().optional()
    })
  },
  updateMember: {
    params: z.object({
      id: commonSchemas.uuid,
      memberId: commonSchemas.uuid
    }),
    body: z.object({
      name: z
        .string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .optional(),
      role: z.enum(['admin', 'manager', 'inspector', 'viewer']).optional(),
      permissions: z.array(z.string()).optional(),
      phone: z.string().optional(),
      status: z.enum(['active', 'inactive']).optional()
    })
  }
};

/**
 * @swagger
 * /api/v1/companies/{id}:
 *   get:
 *     tags: [Companies]
 *     summary: Obter dados da empresa
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
 *         description: Dados da empresa
 *       404:
 *         description: Empresa não encontrada
 */
router.get(
  '/:id',
  authSupabase,
  validateRequest(companySchemas.getCompany),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: company, error } = await supabase
      .from('empresas')
      .select(
        `
        id,
        nome,
        cnpj,
        endereco,
        telefone,
        email,
        created_at,
        updated_at
      `
      )
      .eq('id', id)
      .single();

    if (error || !company) {
      throw new NotFoundError('Empresa não encontrada');
    }

    res.json({
      success: true,
      data: company
    });
  })
);

/**
 * @swagger
 * /api/v1/companies/{id}:
 *   put:
 *     tags: [Companies]
 *     summary: Atualizar dados da empresa
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
 *         description: Empresa atualizada com sucesso
 */
router.put(
  '/:id',
  authSupabase,
  requireRole(['admin', 'super_admin']),
  validateRequest(companySchemas.updateCompany),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    // Check if company exists
    const { data: existingCompany, error: fetchError } = await supabase
      .from('empresas')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingCompany) {
      throw new NotFoundError('Empresa não encontrada');
    }

    const { data: company, error } = await supabase
      .from('empresas')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating company:', error);
      throw new AppError('Erro ao atualizar empresa', 500);
    }

    console.log('Company updated successfully', {
      companyId: id,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Empresa atualizada com sucesso',
      data: company
    });
  })
);

/**
 * @swagger
 * /api/v1/companies/{id}/members:
 *   get:
 *     tags: [Companies]
 *     summary: Listar membros da empresa
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
 *         description: Lista de membros da empresa
 */
router.get(
  '/:id/members',
  authSupabase,
  validateRequest({ params: z.object({ id: commonSchemas.uuid }) }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 10, search, role, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('portal_users')
      .select(
        `
        id,
        name,
        email,
        role,
        permissions,
        status,
        phone,
        last_login,
        created_at
      `,
        { count: 'exact' }
      )
      .eq('empresa_id', id)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (role) {
      query = query.eq('role', role);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: members, error, count } = await query;

    if (error) {
      console.error('Error fetching company members:', error);
      throw new AppError('Erro ao buscar membros da empresa', 500);
    }

    res.json({
      success: true,
      data: members,
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
 * /api/v1/companies/{id}/members:
 *   post:
 *     tags: [Companies]
 *     summary: Adicionar membro à empresa
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
 *         description: Membro adicionado com sucesso
 */
router.post(
  '/:id/members',
  authSupabase,
  requireRole(['admin', 'super_admin']),
  validateRequest(companySchemas.createMember),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const memberData = req.body;

    // Check if email already exists in this company
    const { data: existingMember } = await supabase
      .from('portal_users')
      .select('id')
      .eq('email', memberData.email)
      .eq('empresa_id', id)
      .single();

    if (existingMember) {
      throw new ValidationError('Email já está em uso nesta empresa');
    }

    // Create user in Supabase Auth first
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: memberData.email,
        password: Math.random().toString(36).slice(-8), // Temporary password
        email_confirm: true
      });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw new AppError('Erro ao criar usuário de autenticação', 500);
    }

    // Create portal user
    const { data: member, error } = await supabase
      .from('portal_users')
      .insert({
        ...memberData,
        empresa_id: id,
        auth_user_id: authUser.user.id,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      // Cleanup auth user if portal user creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      console.error('Error creating portal user:', error);
      throw new AppError('Erro ao criar membro da empresa', 500);
    }

    console.log('Company member created successfully', {
      memberId: member.id,
      companyId: id,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Membro adicionado com sucesso',
      data: member
    });
  })
);

/**
 * @swagger
 * /api/v1/companies/{id}/members/{memberId}:
 *   put:
 *     tags: [Companies]
 *     summary: Atualizar membro da empresa
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
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Membro atualizado com sucesso
 */
router.put(
  '/:id/members/:memberId',
  authSupabase,
  requireRole(['admin', 'super_admin']),
  validateRequest(companySchemas.updateMember),
  asyncHandler(async (req, res) => {
    const { id, memberId } = req.params;
    const updateData = req.body;

    // Check if member exists and belongs to the company
    const { data: existingMember, error: fetchError } = await supabase
      .from('portal_users')
      .select('id')
      .eq('id', memberId)
      .eq('empresa_id', id)
      .single();

    if (fetchError || !existingMember) {
      throw new NotFoundError('Membro não encontrado');
    }

    const { data: member, error } = await supabase
      .from('portal_users')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId)
      .eq('empresa_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating company member:', error);
      throw new AppError('Erro ao atualizar membro da empresa', 500);
    }

    console.log('Company member updated successfully', {
      memberId,
      companyId: id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Membro atualizado com sucesso',
      data: member
    });
  })
);

/**
 * @swagger
 * /api/v1/companies/{id}/members/{memberId}:
 *   delete:
 *     tags: [Companies]
 *     summary: Remover membro da empresa
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
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Membro removido com sucesso
 */
router.delete(
  '/:id/members/:memberId',
  authSupabase,
  requireRole(['admin', 'super_admin']),
  validateRequest({
    params: z.object({ id: commonSchemas.uuid, memberId: commonSchemas.uuid })
  }),
  asyncHandler(async (req, res) => {
    const { id, memberId } = req.params;

    // Check if member exists and belongs to the company
    const { data: existingMember, error: fetchError } = await supabase
      .from('portal_users')
      .select('id, auth_user_id')
      .eq('id', memberId)
      .eq('empresa_id', id)
      .single();

    if (fetchError || !existingMember) {
      throw new NotFoundError('Membro não encontrado');
    }

    // Prevent self-deletion
    if (req.userType === 'portal_user' && req.user.id === memberId) {
      throw new AuthorizationError('Você não pode remover a si mesmo');
    }

    // Delete from portal_users table
    const { error: deleteError } = await supabase
      .from('portal_users')
      .delete()
      .eq('id', memberId)
      .eq('empresa_id', id);

    if (deleteError) {
      console.error('Error deleting company member:', deleteError);
      throw new AppError('Erro ao remover membro da empresa', 500);
    }

    // Delete from Supabase Auth
    if (existingMember.auth_user_id) {
      await supabase.auth.admin.deleteUser(existingMember.auth_user_id);
    }

    console.log('Company member deleted successfully', {
      memberId,
      companyId: id,
      deletedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Membro removido com sucesso'
    });
  })
);

/**
 * @swagger
 * /api/v1/companies/{id}/stats:
 *   get:
 *     tags: [Companies]
 *     summary: Obter estatísticas da empresa
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
 *         description: Estatísticas da empresa
 */
router.get(
  '/:id/stats',
  authSupabase,
  validateRequest({ params: z.object({ id: commonSchemas.uuid }) }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get various stats in parallel
    const [membersResult, propertiesResult, inspectionsResult, appUsersResult] =
      await Promise.all([
        supabase
          .from('portal_users')
          .select('id', { count: 'exact' })
          .eq('empresa_id', id)
          .eq('status', 'active'),
        supabase
          .from('imoveis')
          .select('id', { count: 'exact' })
          .eq('empresa_id', id),
        supabase
          .from('vistorias')
          .select('id', { count: 'exact' })
          .eq('empresa_id', id),
        supabase
          .from('app_users')
          .select('id', { count: 'exact' })
          .eq('empresa_id', id)
          .eq('status', 'active')
      ]);

    const stats = {
      members: membersResult.count || 0,
      properties: propertiesResult.count || 0,
      inspections: inspectionsResult.count || 0,
      app_users: appUsersResult.count || 0
    };

    res.json({
      success: true,
      data: stats
    });
  })
);

module.exports = router;

