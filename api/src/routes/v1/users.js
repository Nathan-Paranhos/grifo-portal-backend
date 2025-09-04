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

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     tags: [Users]
 *     summary: Listar todos os usuários (tabela unificada)
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
 *         name: user_type
 *         schema:
 *           type: string
 *           enum: [admin, super_admin, client]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: tenant_slug
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
router.get(
  '/',
  authSupabase,
  requireRole(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      user_type = 'client', 
      status, 
      tenant_slug 
    } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select(
        `
        id,
        nome,
        email,
        phone,
        user_type,
        status,
        tenant_slug,
        document,
        address,
        city,
        state,
        zip_code,
        last_login,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .eq('user_type', user_type)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('ativo', status === 'active');
    }

    if (tenant_slug) {
      query = query.eq('tenant_slug', tenant_slug);
    }

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      throw new AppError('Erro ao buscar usuários', 500);
    }

    // Remove sensitive data
    const sanitizedUsers = users.map(user => {
      const { password_hash, auth_user_id, ...safeUser } = user;
      return safeUser;
    });

    res.json({
      success: true,
      data: sanitizedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  })
);

// Validation schemas
const userSchemas = {
  getUser: {
    params: z.object({
      id: commonSchemas.uuid
    })
  },
  updateUser: {
    params: z.object({
      id: commonSchemas.uuid
    }),
    body: z.object({
      name: z
        .string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .optional(),
      phone: z.string().optional(),
      role: z.enum(['admin', 'manager', 'inspector', 'viewer']).optional(),
      permissions: z.array(z.string()).optional(),
      status: z.enum(['active', 'inactive']).optional()
    })
  },
  createAppUser: {
    body: z.object({
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      email: commonSchemas.email,
      phone: z.string().optional(),
      empresa_id: commonSchemas.uuid
    })
  },
  updateProfile: {
    body: z.object({
      name: z
        .string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .optional(),
      phone: z.string().optional()
    })
  },
  changePassword: {
    body: z
      .object({
        currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
        newPassword: z
          .string()
          .min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
        confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória')
      })
      .refine(data => data.newPassword === data.confirmPassword, {
        message: 'Senhas não coincidem',
        path: ['confirmPassword']
      })
  },
  createPortalUser: {
    body: z.object({
      nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      email: commonSchemas.email,
      password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
      role: z.enum(['admin', 'manager', 'inspector', 'viewer']).default('viewer'),
      empresa_id: commonSchemas.uuid.optional(),
      permissions: z.array(z.string()).optional()
    })
  }
};

/**
 * @swagger
 * /api/v1/users/app:
 *   get:
 *     tags: [Users - App]
 *     summary: Listar usuários do aplicativo
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuários do aplicativo
 */
router.get(
  '/app',
  authSupabase,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status } = req.query;
    const offset = (page - 1) * limit;
    const empresaId = req.user.empresa_id;

    let query = supabase
      .from('app_users')
      .select(
        `
        id,
        nome,
        email,
        phone,
        status,
        last_login,
        created_at
      `,
        { count: 'exact' }
      )
      .eq('empresa_id', empresaId)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('ativo', status === 'active');
    }

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching app users:', error);
      throw new AppError('Erro ao buscar usuários do aplicativo', 500);
    }

    res.json({
      success: true,
      data: users,
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
 * /api/v1/users/app:
 *   post:
 *     tags: [Users - App]
 *     summary: Criar usuário do aplicativo
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 */
router.post(
  '/app',
  authSupabase,
  requireRole(['admin', 'manager']),
  validateRequest(userSchemas.createAppUser),
  asyncHandler(async (req, res) => {
    const userData = req.body;

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('app_users')
      .select('id')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      throw new ValidationError('Email já está em uso');
    }

    // Create user in Supabase Auth first
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: userData.email,
        password: Math.random().toString(36).slice(-8), // Temporary password
        email_confirm: true
      });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw new AppError('Erro ao criar usuário de autenticação', 500);
    }

    // Create app user
    const { data: user, error } = await supabase
      .from('app_users')
      .insert({
        ...userData,
        auth_user_id: authUser.user.id,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      // Cleanup auth user if app user creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      console.error('Error creating app user:', error);
      throw new AppError('Erro ao criar usuário do aplicativo', 500);
    }

    console.log('App user created successfully', {
      userId: user.id,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: user
    });
  })
);

/**
 * @swagger
 * /api/v1/users/portal:
 *   get:
 *     tags: [Users - Portal]
 *     summary: Listar usuários do portal
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuários do portal
 */
router.get(
  '/portal',
  authSupabase,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    console.log('Portal users endpoint called');
    console.log('req.user exists:', !!req.user);
    console.log('req.user content:', req.user);
    
    const { page = 1, limit = 10, search, role, status } = req.query;
    const offset = (page - 1) * limit;
    
    if (!req.user) {
      console.log('No req.user found, throwing authentication error');
      throw new AuthenticationError('Usuário não autenticado');
    }
    
    const empresaId = req.user.empresa_id;
    console.log('empresaId from req.user:', empresaId);
    
    if (!empresaId) {
      console.log('No empresaId found, throwing authorization error');
      throw new AuthorizationError('Empresa não identificada para o usuário');
    }

    let query = supabase
      .from('portal_users')
      .select(
        `
        id,
        nome,
        email,
        role,
        permissions,
        ativo,
        last_login,
        created_at
      `,
        { count: 'exact' }
      )
      .eq('empresa_id', empresaId)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (role) {
      query = query.eq('role', role);
    }

    if (status) {
      query = query.eq('ativo', status === 'active');
    }

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching portal users:', error);
      throw new AppError('Erro ao buscar usuários do portal', 500);
    }

    res.json({
      success: true,
      data: users,
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
 * /api/v1/users/portal:
 *   post:
 *     tags: [Users - Portal]
 *     summary: Criar novo usuário do portal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 description: Nome completo do usuário
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email do usuário
 *               password:
 *                 type: string
 *                 description: Senha do usuário
 *               role:
 *                 type: string
 *                 enum: [admin, manager, inspector, viewer]
 *                 description: Papel do usuário
 *               empresa_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID da empresa
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Email já cadastrado
 */
router.post(
  '/portal',
  authSupabase,
  requireRole(['admin', 'super_admin']),
  validateRequest(userSchemas.createPortalUser),
  asyncHandler(async (req, res) => {
    const { nome, email, password, role = 'viewer', empresa_id, permissions } = req.body;
    const userData = req.user;

    console.log('Creating new portal user', {
      adminId: userData.id,
      userEmail: email,
      role
    });

    // Verificar se o email já existe
    const { data: existingUser } = await supabase
      .from('portal_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new ValidationError('Email já cadastrado');
    }

    // Usar empresa do usuário logado se não fornecida
    const finalEmpresaId = empresa_id || userData.empresa_id;

    // Verificar se a empresa existe
    if (finalEmpresaId) {
      const { data: empresa } = await supabase
        .from('empresas')
        .select('id')
        .eq('id', finalEmpresaId)
        .single();

      if (!empresa) {
        throw new ValidationError('Empresa não encontrada');
      }
    }

    // Criar usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome,
        role
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw new AppError('Erro ao criar usuário de autenticação', 500);
    }

    // Criar usuário do portal
    const { data: portalUser, error: portalError } = await supabase
      .from('portal_users')
      .insert({
        auth_user_id: authUser.user.id,
        nome,
        email,
        role,
        empresa_id: finalEmpresaId,
        permissions: permissions || [],
        ativo: true,
        first_login_completed: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (portalError) {
      // Se falhou ao criar usuário do portal, remover usuário de autenticação
      await supabase.auth.admin.deleteUser(authUser.user.id);
      console.error('Error creating portal user:', portalError);
      throw new AppError('Erro ao criar usuário do portal', 500);
    }

    console.log('Portal user created successfully', {
      userId: portalUser.id,
      createdBy: userData.id
    });

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        id: portalUser.id,
        nome: portalUser.nome,
        email: portalUser.email,
        role: portalUser.role,
        empresa_id: portalUser.empresa_id,
        ativo: portalUser.ativo,
        created_at: portalUser.created_at
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Obter dados do usuário
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
 *         description: Dados do usuário
 */
router.get(
  '/:id',
  authSupabase,
  validateRequest(userSchemas.getUser),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userType = req.userType;
    const userData = req.user;

    // Users can only view their own data unless they're admin/manager
    if (
      userData.id !== id &&
      !['admin', 'manager', 'super_admin'].includes(userData.role)
    ) {
      throw new AuthorizationError('Acesso negado');
    }

    let user;
    let tableName;

    // Determine which table to query based on user type or try both
    if (userType === 'app_user') {
      tableName = 'app_users';
    } else if (userType === 'portal_user') {
      tableName = 'portal_users';
    } else {
      // If user type is not determined, try both tables
      const { data: appUser } = await supabase
        .from('app_users')
        .select(
          `
          id,
          nome,
          email,
          phone,
          ativo,
          empresa_id,
          last_login,
          created_at,
          empresas!inner(nome, slug)
        `
        )
        .eq('id', id)
        .single();

      if (appUser) {
        user = { ...appUser, user_type: 'app_user' };
      } else {
        const { data: portalUser } = await supabase
          .from('portal_users')
          .select(
            `
            id,
            nome,
            email,
            role,
            permissions,
            ativo,
            empresa_id,
            last_login,
            created_at,
            empresas!inner(nome, slug)
          `
          )
          .eq('id', id)
          .single();

        if (portalUser) {
          user = { ...portalUser, user_type: 'portal_user' };
        }
      }
    }

    if (!user && tableName) {
      const selectFields =
        tableName === 'app_users'
          ? `id, nome, email, phone, ativo, empresa_id, last_login, created_at, empresas!inner(nome, slug)`
          : `id, nome, email, role, permissions, ativo, empresa_id, last_login, created_at, empresas!inner(nome, slug)`;

      const { data: foundUser, error } = await supabase
        .from(tableName)
        .select(selectFields)
        .eq('id', id)
        .single();

      if (error || !foundUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      user = { ...foundUser, user_type: userType };
    }

    if (!user) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Check tenant access for non-super_admin users
    if (
      userData.role !== 'super_admin' &&
      user.empresa_id !== userData.empresa_id
    ) {
      throw new AuthorizationError('Acesso negado');
    }

    res.json({
      success: true,
      data: user
    });
  })
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Atualizar usuário
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
 *         description: Usuário atualizado com sucesso
 */
router.put(
  '/:id',
  authSupabase,
  validateRequest(userSchemas.updateUser),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const userData = req.user;

    console.log('PUT /users/:id - Starting update process', {
      userId: id,
      requestedBy: userData.id,
      userRole: userData.role,
      hasCompany: !!req.company,
      companyId: req.company?.id
    });

    // Users can only update their own data unless they're admin/manager
    const canUpdate =
      userData.id === id ||
      ['admin', 'manager', 'super_admin'].includes(userData.role);
    if (!canUpdate) {
      console.log('Access denied - insufficient permissions', {
        userId: id,
        requestedBy: userData.id,
        userRole: userData.role
      });
      throw new AuthorizationError('Acesso negado');
    }

    // Validate tenant context - mais flexível para diferentes cenários
    if (!req.company && userData.role !== 'super_admin') {
      console.log('Missing tenant context for non-super-admin user', {
        userId: id,
        requestedBy: userData.id,
        userRole: userData.role
      });
      throw new ValidationError('Contexto de tenant não encontrado');
    }

    // Determine which table to update
    let tableName;
    let user;
    let searchFilters = { id };
    
    // Add tenant filtering only if company context exists
    if (req.company?.id) {
      searchFilters.empresa_id = req.company.id;
      console.log('Updating user in tenant context', {
        userId: id,
        tenantId: req.company.id,
        tenantSlug: req.company.slug,
        updateData: Object.keys(updateData)
      });
    } else {
      console.log('Updating user without tenant context (super_admin)', {
        userId: id,
        requestedBy: userData.id,
        updateData: Object.keys(updateData)
      });
    }

    // Try app_users first
    try {
      const appUserQuery = supabase
        .from('app_users')
        .select('id, empresa_id')
        .eq('id', id);
      
      if (searchFilters.empresa_id) {
        appUserQuery.eq('empresa_id', searchFilters.empresa_id);
      }
      
      const { data: appUser, error: appUserError } = await appUserQuery.single();

      if (appUser && !appUserError) {
        tableName = 'app_users';
        user = appUser;
        // Remove role and permissions for app users
        delete updateData.role;
        delete updateData.permissions;
        console.log('User found in app_users table', { userId: id, empresaId: appUser.empresa_id });
      } else if (appUserError && appUserError.code !== 'PGRST116') {
        console.error('Error fetching app user:', appUserError);
        throw new AppError('Erro ao buscar usuário na tabela app_users', 500);
      }
    } catch (error) {
      console.error('Exception while fetching app user:', error);
      if (error instanceof AppError) throw error;
    }

    // If not found in app_users, try portal_users
    if (!user) {
      try {
        const portalUserQuery = supabase
          .from('portal_users')
          .select('id, empresa_id')
          .eq('id', id);
        
        if (searchFilters.empresa_id) {
          portalUserQuery.eq('empresa_id', searchFilters.empresa_id);
        }
        
        const { data: portalUser, error: portalUserError } = await portalUserQuery.single();

        if (portalUser && !portalUserError) {
          tableName = 'portal_users';
          user = portalUser;
          console.log('User found in portal_users table', { userId: id, empresaId: portalUser.empresa_id });
        } else if (portalUserError && portalUserError.code !== 'PGRST116') {
          console.error('Error fetching portal user:', portalUserError);
          throw new AppError('Erro ao buscar usuário na tabela portal_users', 500);
        }
      } catch (error) {
        console.error('Exception while fetching portal user:', error);
        if (error instanceof AppError) throw error;
      }
    }

    if (!user) {
      const errorMsg = req.company?.id 
        ? 'Usuário não encontrado no contexto do tenant'
        : 'Usuário não encontrado';
      console.log('User not found', { userId: id, hasCompany: !!req.company });
      throw new NotFoundError(errorMsg);
    }

    // Check tenant access for non-super_admin users
    if (
      userData.role !== 'super_admin' &&
      req.company?.id &&
      user.empresa_id !== userData.empresa_id
    ) {
      console.log('Cross-tenant access denied', {
        userId: id,
        requestedBy: userData.id,
        userEmpresaId: user.empresa_id,
        requestorEmpresaId: userData.empresa_id
      });
      throw new AuthorizationError('Acesso negado - usuário de outra empresa');
    }

    // Only admins can change roles and status
    if (!['admin', 'super_admin'].includes(userData.role)) {
      delete updateData.role;
      delete updateData.permissions;
      delete updateData.ativo;
      console.log('Restricted fields removed for non-admin user', {
        requestedBy: userData.id,
        userRole: userData.role
      });
    }

    console.log('Attempting to update user', {
      userId: id,
      tableName,
      updateFields: Object.keys(updateData),
      requestedBy: userData.id
    });

    try {
      const { data: updatedUser, error } = await supabase
        .from(tableName)
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', {
          error,
          userId: id,
          tableName,
          updateData: Object.keys(updateData)
        });
        throw new AppError(`Erro ao atualizar usuário: ${error.message}`, 500);
      }

      if (!updatedUser) {
        console.error('Update returned no data', {
          userId: id,
          tableName
        });
        throw new AppError('Erro ao atualizar usuário - nenhum dado retornado', 500);
      }

      console.log('User updated successfully', {
        userId: id,
        tableName,
        updatedBy: userData.id,
        updatedFields: Object.keys(updateData)
      });

      res.json({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: updatedUser
      });
    } catch (error) {
      console.error('Exception during user update:', {
        error: error.message,
        stack: error.stack,
        userId: id,
        tableName,
        requestedBy: userData.id
      });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Erro interno ao atualizar usuário', 500);
    }
  })
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Excluir usuário
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
 *         description: Usuário excluído com sucesso
 */
router.delete(
  '/:id',
  authSupabase,
  requireRole(['admin', 'super_admin']),
  validateRequest(userSchemas.getUser),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userData = req.user;

    // Prevent self-deletion
    if (userData.id === id) {
      throw new AuthorizationError('Você não pode excluir a si mesmo');
    }

    // Find user in both tables
    let tableName;
    let user;
    let supabaseUid;

    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, empresa_id, auth_user_id')
      .eq('id', id)
      .single();

    if (appUser) {
      tableName = 'app_users';
      user = appUser;
      supabaseUid = appUser.auth_user_id;
    } else {
      const { data: portalUser } = await supabase
        .from('portal_users')
        .select('id, empresa_id, auth_user_id')
        .eq('id', id)
        .single();

      if (portalUser) {
        tableName = 'portal_users';
        user = portalUser;
        supabaseUid = portalUser.auth_user_id;
      }
    }

    if (!user) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Check tenant access for non-super_admin users
    if (
      userData.role !== 'super_admin' &&
      user.empresa_id !== userData.empresa_id
    ) {
      throw new AuthorizationError('Acesso negado');
    }

    // Delete from user table
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      throw new AppError('Erro ao excluir usuário', 500);
    }

    // Delete from Supabase Auth
    if (supabaseUid) {
      await supabase.auth.admin.deleteUser(supabaseUid);
    }

    console.log('User deleted successfully', {
      userId: id,
      deletedBy: userData.id
    });

    res.json({
      success: true,
      message: 'Usuário excluído com sucesso'
    });
  })
);

/**
 * @swagger
 * /api/v1/users/profile:
 *   put:
 *     tags: [Users]
 *     summary: Atualizar perfil do usuário atual
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil atualizado com sucesso
 */
router.put(
  '/profile',
  authSupabase,
  validateRequest(userSchemas.updateProfile),
  asyncHandler(async (req, res) => {
    const updateData = req.body;
    const userData = req.user;
    const userType = req.userType;

    const tableName = userType === 'app_user' ? 'app_users' : 'portal_users';

    const { data: updatedUser, error } = await supabase
      .from(tableName)
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userData.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      throw new AppError('Erro ao atualizar perfil', 500);
    }

    console.log('User profile updated successfully', { userId: userData.id });

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: updatedUser
    });
  })
);

/**
 * @swagger
 * /api/v1/users/change-password:
 *   post:
 *     tags: [Users]
 *     summary: Alterar senha do usuário atual
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Senha alterada com sucesso
 */
router.post(
  '/change-password',
  authSupabase,
  validateRequest(userSchemas.changePassword),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Verify current password by attempting to sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (verifyError) {
      throw new ValidationError('Senha atual incorreta');
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new AppError('Erro ao alterar senha', 500);
    }

    console.log('Password changed successfully', { userId: user.id });

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  })
);

module.exports = router;

