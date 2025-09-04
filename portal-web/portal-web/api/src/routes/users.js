const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase.js');
// const { logger } = require('../config/logger.js'); // Temporarily disabled to avoid circular dependency
const {
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError
} = require('../middleware/errorHandler.js');
const authModule = require('../middleware/auth.js');
const {
  validateRequest,
  userSchemas,
  commonSchemas
} = require('../middleware/validation.js');
const { authMiddleware } = authModule;

const router = express.Router();

// All user routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Listar usuários
 *     description: |
 *       Lista todos os usuários da empresa com paginação e filtros.
 *       Apenas administradores e gerentes podem acessar.
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
 *         description: Busca por nome ou email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, manager, inspector, viewer]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, name, email, last_login]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lista de usuários
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
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
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
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get(
  '/',
  validateRequest({
    query: {
      ...commonSchemas.pagination,
      ...commonSchemas.search,
      role: userSchemas.role.optional(),
      status: userSchemas.status.optional(),
      sortBy: userSchemas.sortBy.optional(),
      sortOrder: commonSchemas.sortOrder.optional()
    }
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const {
      page = 1,
      limit = 20,
      search,
      role,
      status,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    // Only admins and managers can list users
    if (!['admin', 'manager'].includes(user.role)) {
      throw new ValidationError('Sem permissão para listar usuários');
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    try {
      let query = supabase
        .from('users')
        .select(
          `
          id,
          name,
          email,
          phone,
          role,
          status,
          last_login,
          created_at,
          updated_at,
          vistorias!left(
            id,
            status
          )
        `,
          { count: 'exact' }
        )
        .eq('company_id', user.company_id);

      // Apply filters
      if (role) {
        query = query.eq('role', role);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`
          name.ilike.%${search}%,
          email.ilike.%${search}%
        `);
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: users, error, count } = await query;

      if (error) {
        console.error('Users list error:', error);
        throw new AppError('Erro ao carregar usuários');
      }

      // Process users to add inspection counts
      const processedUsers = users.map(userData => {
        const inspectionCounts = {
          total: userData.vistorias.length,
          pending: userData.vistorias.filter(i => i.status === 'pendente')
            .length,
          completed: userData.vistorias.filter(i => i.status === 'concluida')
            .length
        };

        return {
          ...userData,
          inspection_counts: inspectionCounts,
          vistorias: undefined // Remove detailed inspections from response
        };
      });

      const totalPages = Math.ceil(count / limit);

      console.log('Users listed', {
        userId: user.id,
        companyId: user.company_id,
        count,
        page,
        limit,
        filters: { role, status, search }
      });

      res.json({
        success: true,
        data: {
          users: processedUsers,
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: count,
            pages: totalPages
          }
        }
      });
    } catch (error) {
      console.error('Users list error:', error);
      throw new AppError('Erro ao carregar usuários');
    }
  })
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Obter usuário por ID
 *     description: |
 *       Retorna os detalhes de um usuário específico.
 *       Usuários podem ver seus próprios dados.
 *       Admins e gerentes podem ver dados de qualquer usuário.
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
 *         description: Detalhes do usuário
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    // Users can only see their own data unless they're admin/manager
    if (user.id !== id && !['admin', 'manager'].includes(user.role)) {
      throw new ValidationError('Sem permissão para visualizar este usuário');
    }

    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select(
          `
          id,
          name,
          email,
          phone,
          role,
          status,
          last_login,
          created_at,
          updated_at,
          empresas!inner(
            id,
            name,
            status
          ),
          vistorias!left(
            id,
            status,
            data_agendamento,
            data_conclusao,
            imoveis!inner(
              endereco,
              cidade
            )
          )
        `
        )
        .eq('id', id)
        .eq('company_id', user.company_id)
        .single();

      if (error || !userData) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Sort inspections by date
      if (userData.vistorias) {
        userData.vistorias.sort(
          (a, b) => new Date(b.data_agendamento) - new Date(a.data_agendamento)
        );
      }

      console.log('User retrieved', {
        userId: user.id,
        targetUserId: id,
        companyId: user.company_id
      });

      res.json({
        success: true,
        data: {
          user: userData
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('User get error:', error);
      throw new AppError('Erro ao carregar usuário');
    }
  })
);

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Criar novo usuário
 *     description: |
 *       Cria um novo usuário no sistema.
 *       Apenas administradores e gerentes podem criar usuários.
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
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: "Maria Santos"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "maria@exemplo.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "senha123"
 *               phone:
 *                 type: string
 *                 example: "(11) 99999-9999"
 *               role:
 *                 type: string
 *                 enum: [admin, manager, inspector, viewer]
 *                 example: "inspector"
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Email já existe
 */
router.post(
  '/',
  validateRequest({ body: userSchemas.create }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { name, email, password, phone, role } = req.body;

    // Only admins and managers can create users
    if (!['admin', 'manager'].includes(user.role)) {
      throw new ValidationError('Sem permissão para criar usuários');
    }

    // Managers cannot create admins
    if (user.role === 'manager' && role === 'admin') {
      throw new ValidationError('Gerentes não podem criar administradores');
    }

    try {
      // Check if email already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        throw new ValidationError('Email já está em uso');
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          name,
          email: email.toLowerCase(),
          password_hash: passwordHash,
          phone,
          role,
          company_id: user.company_id,
          status: 'active',
          created_by: user.id
        })
        .select(
          `
          id,
          name,
          email,
          phone,
          role,
          status,
          created_at
        `
        )
        .single();

      if (error) {
        console.error('User creation error:', error);
        throw new AppError('Erro ao criar usuário');
      }

      console.log('User created', {
        userId: user.id,
        newUserId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        companyId: user.company_id
      });

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        data: {
          user: newUser
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error('User creation error:', error);
      throw new AppError('Erro ao criar usuário');
    }
  })
);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Atualizar usuário
 *     description: |
 *       Atualiza os dados de um usuário existente.
 *       Usuários podem atualizar seus próprios dados (exceto role).
 *       Admins e gerentes podem atualizar qualquer usuário.
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
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, manager, inspector, viewer]
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:id',
  validateRequest({
    params: { id: commonSchemas.uuid },
    body: userSchemas.update
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;
    const updateData = req.body;

    // Users can only update their own data unless they're admin/manager
    const canUpdateOthers = ['admin', 'manager'].includes(user.role);
    const isUpdatingSelf = user.id === id;

    if (!isUpdatingSelf && !canUpdateOthers) {
      throw new ValidationError('Sem permissão para atualizar este usuário');
    }

    try {
      // Get current user data
      const { data: currentUser, error: checkError } = await supabase
        .from('users')
        .select('id, email, role, status')
        .eq('id', id)
        .eq('company_id', user.company_id)
        .single();

      if (checkError || !currentUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Validate role and status changes
      if (updateData.role || updateData.status) {
        if (isUpdatingSelf) {
          throw new ValidationError(
            'Não é possível alterar seu próprio role ou status'
          );
        }

        if (!canUpdateOthers) {
          throw new ValidationError(
            'Sem permissão para alterar role ou status'
          );
        }

        // Managers cannot promote to admin or demote admins
        if (user.role === 'manager') {
          if (updateData.role === 'admin') {
            throw new ValidationError(
              'Gerentes não podem promover usuários a administrador'
            );
          }
          if (currentUser.role === 'admin') {
            throw new ValidationError(
              'Gerentes não podem alterar dados de administradores'
            );
          }
        }
      }

      // Check email uniqueness if being changed
      if (
        updateData.email &&
        updateData.email.toLowerCase() !== currentUser.email
      ) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', updateData.email.toLowerCase())
          .neq('id', id)
          .single();

        if (existingUser) {
          throw new ValidationError('Email já está em uso');
        }

        updateData.email = updateData.email.toLowerCase();
      }

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', id)
        .eq('company_id', user.company_id)
        .select(
          `
          id,
          name,
          email,
          phone,
          role,
          status,
          last_login,
          created_at,
          updated_at
        `
        )
        .single();

      if (error) {
        console.error('User update error:', error);
        throw new AppError('Erro ao atualizar usuário');
      }

      console.log('User updated', {
        userId: user.id,
        targetUserId: id,
        companyId: user.company_id,
        changes: Object.keys(updateData),
        isUpdatingSelf
      });

      res.json({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: {
          user: updatedUser
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('User update error:', error);
      throw new AppError('Erro ao atualizar usuário');
    }
  })
);

/**
 * @swagger
 * /api/users/{id}/reset-password:
 *   post:
 *     tags: [Users]
 *     summary: Resetar senha do usuário
 *     description: |
 *       Reseta a senha de um usuário para uma senha temporária.
 *       Apenas administradores e gerentes podem resetar senhas.
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
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "novaSenha123"
 *     responses:
 *       200:
 *         description: Senha resetada com sucesso
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  '/:id/reset-password',
  validateRequest({
    params: { id: commonSchemas.uuid },
    body: { newPassword: userSchemas.password }
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;
    const { newPassword } = req.body;

    // Only admins and managers can reset passwords
    if (!['admin', 'manager'].includes(user.role)) {
      throw new ValidationError('Sem permissão para resetar senhas');
    }

    try {
      // Get target user
      const { data: targetUser, error: checkError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', id)
        .eq('company_id', user.company_id)
        .single();

      if (checkError || !targetUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Managers cannot reset admin passwords
      if (user.role === 'manager' && targetUser.role === 'admin') {
        throw new ValidationError(
          'Gerentes não podem resetar senhas de administradores'
        );
      }

      // Users cannot reset their own password through this endpoint
      if (user.id === id) {
        throw new ValidationError(
          'Use o endpoint de alteração de senha para alterar sua própria senha'
        );
      }

      // Hash new password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      const { error } = await supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', id)
        .eq('company_id', user.company_id);

      if (error) {
        console.error('Password reset error:', error);
        throw new AppError('Erro ao resetar senha');
      }

      console.log('Password reset', {
        userId: user.id,
        targetUserId: id,
        targetUserEmail: targetUser.email,
        companyId: user.company_id
      });

      res.json({
        success: true,
        message: 'Senha resetada com sucesso'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Password reset error:', error);
      throw new AppError('Erro ao resetar senha');
    }
  })
);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Excluir usuário
 *     description: |
 *       Exclui um usuário do sistema.
 *       Apenas administradores podem excluir usuários.
 *       Usuários com vistorias não podem ser excluídos.
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
 *       400:
 *         description: Usuário possui vistorias e não pode ser excluído
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  '/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    // Only admins can delete users
    if (user.role !== 'admin') {
      throw new ValidationError(
        'Apenas administradores podem excluir usuários'
      );
    }

    // Users cannot delete themselves
    if (user.id === id) {
      throw new ValidationError('Não é possível excluir sua própria conta');
    }

    try {
      // Check if user exists and get inspection count
      const { data: targetUser, error: checkError } = await supabase
        .from('users')
        .select(
          `
          id,
          name,
          email,
          role,
          inspections!left(id)
        `
        )
        .eq('id', id)
        .eq('company_id', user.company_id)
        .single();

      if (checkError || !targetUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      // Check if user has inspections
      if (targetUser.inspections && targetUser.inspections.length > 0) {
        throw new ValidationError(
          'Não é possível excluir usuário que possui vistorias. ' +
            'Desative o usuário ou transfira as vistorias para outro inspetor.'
        );
      }

      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', id)
        .eq('company_id', user.company_id);

      if (deleteError) {
        console.error('User deletion error:', deleteError);
        throw new AppError('Erro ao excluir usuário');
      }

      console.log('User deleted', {
        userId: user.id,
        deletedUserId: id,
        deletedUserEmail: targetUser.email,
        companyId: user.company_id
      });

      res.json({
        success: true,
        message: 'Usuário excluído com sucesso'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('User deletion error:', error);
      throw new AppError('Erro ao excluir usuário');
    }
  })
);

module.exports = router;
