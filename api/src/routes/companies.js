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
  companySchemas,
  commonSchemas
} = require('../middleware/validation.js');
const { authMiddleware } = authModule;

const router = express.Router();

// All company routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/companies:
 *   get:
 *     tags: [Companies]
 *     summary: Listar empresas
 *     description: |
 *       Lista todas as empresas do sistema.
 *       Apenas super administradores podem ver todas as empresas.
 *       Outros usuários veem apenas sua própria empresa.
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
 *         description: Busca por nome, CNPJ ou email
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 *       - in: query
 *         name: plan
 *         schema:
 *           type: string
 *           enum: [basic, professional, enterprise]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, name, plan]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lista de empresas
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
 *                     companies:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Company'
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
      status: companySchemas.status.optional(),
      plan: companySchemas.plan.optional(),
      sortBy: companySchemas.sortBy.optional(),
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
      plan,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;

    try {
      let query = supabase.from('empresas').select(
        `
          id,
          name,
          cnpj,
          email,
          phone,
          plan,
          status,
          created_at,
          updated_at,
          users!left(
            id,
            role,
            ativo
          ),
          imoveis!left(
            id,
            endereco,
            cidade
          ),
          vistorias!left(
            id,
            status
          )
        `,
        { count: 'exact' }
      );

      // Super admin can see all companies, others only their own
      if (user.role !== 'super_admin') {
        query = query.eq('id', user.company_id);
      }

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (plan) {
        query = query.eq('plan', plan);
      }

      if (search) {
        query = query.or(`
          name.ilike.%${search}%,
          cnpj.ilike.%${search}%,
          email.ilike.%${search}%
        `);
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: companies, error, count } = await query;

      if (error) {
        // Error handled silently for production
        throw new AppError('Erro ao carregar empresas');
      }

      // Process companies to add counts
      const processedCompanies = companies.map(company => {
        const userCounts = {
          total: company.users.length,
          active: company.users.filter(u => u.ativo === true).length,
          admins: company.users.filter(u => u.role === 'admin').length
        };

        const propertyCounts = {
          total: company.imoveis.length,
          active: company.imoveis.length
        };

        const inspectionCounts = {
          total: company.vistorias.length,
          pending: company.vistorias.filter(i => i.status === 'pendente')
            .length,
          completed: company.vistorias.filter(i => i.status === 'concluida')
            .length
        };

        return {
          ...company,
          user_counts: userCounts,
          property_counts: propertyCounts,
          inspection_counts: inspectionCounts,
          users: undefined,
          imoveis: undefined,
          vistorias: undefined
        };
      });

      const totalPages = Math.ceil(count / limit);

      // Companies query completed

      res.json({
        success: true,
        data: {
          companies: processedCompanies,
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: count,
            pages: totalPages
          }
        }
      });
    } catch (error) {
      console.error('Companies list error:', error);
      throw new AppError('Erro ao carregar empresas');
    }
  })
);

/**
 * @swagger
 * /api/companies/{id}:
 *   get:
 *     tags: [Companies]
 *     summary: Obter empresa por ID
 *     description: |
 *       Retorna os detalhes completos de uma empresa específica.
 *       Usuários podem ver apenas sua própria empresa.
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
 *         description: Detalhes da empresa
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
 *                     company:
 *                       $ref: '#/components/schemas/Company'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    // Users can only see their own company unless they're super admin
    if (user.role !== 'super_admin' && user.company_id !== id) {
      throw new ValidationError('Sem permissão para visualizar esta empresa');
    }

    try {
      const { data: company, error } = await supabase
        .from('empresas')
        .select(
          `
          *,
          users!left(
            id,
            name,
            email,
            role,
            status,
            last_login,
            created_at
          ),
          properties!left(
            id,
            address,
            city,
            status,
            created_at
          ),
          inspections!left(
            id,
            status,
            scheduled_date,
            completed_date
          )
        `
        )
        .eq('id', id)
        .single();

      if (error || !company) {
        throw new NotFoundError('Empresa não encontrada');
      }

      // Sort related data
      if (company.users) {
        company.users.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
      }

      if (company.properties) {
        company.properties.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
      }

      if (company.inspections) {
        company.inspections.sort(
          (a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date)
        );
      }

      console.log('Company retrieved', {
        userId: user.id,
        companyId: id,
        userRole: user.role
      });

      res.json({
        success: true,
        data: {
          company
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Company get error:', error);
      throw new AppError('Erro ao carregar empresa');
    }
  })
);

/**
 * @swagger
 * /api/companies:
 *   post:
 *     tags: [Companies]
 *     summary: Criar nova empresa
 *     description: |
 *       Cria uma nova empresa no sistema.
 *       Apenas super administradores podem criar empresas.
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
 *               - cnpj
 *               - email
 *               - plan
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: "Empresa Exemplo Ltda"
 *               cnpj:
 *                 type: string
 *                 pattern: '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$'
 *                 example: "12.345.678/0001-90"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contato@empresa.com"
 *               phone:
 *                 type: string
 *                 example: "(11) 3333-4444"
 *               plan:
 *                 type: string
 *                 enum: [basic, professional, enterprise]
 *                 example: "professional"
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   number:
 *                     type: string
 *                   complement:
 *                     type: string
 *                   neighborhood:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   cep:
 *                     type: string
 *     responses:
 *       201:
 *         description: Empresa criada com sucesso
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: CNPJ ou email já existe
 */
router.post(
  '/',
  validateRequest({ body: companySchemas.create }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const companyData = req.body;

    // Only super admins can create companies
    if (user.role !== 'super_admin') {
      throw new ValidationError(
        'Apenas super administradores podem criar empresas'
      );
    }

    try {
      // Check if CNPJ already exists
      const { data: existingCnpj } = await supabase
        .from('empresas')
        .select('id')
        .eq('cnpj', companyData.cnpj)
        .single();

      if (existingCnpj) {
        throw new ValidationError('CNPJ já está em uso');
      }

      // Check if email already exists
      const { data: existingEmail } = await supabase
        .from('empresas')
        .select('id')
        .eq('email', companyData.email.toLowerCase())
        .single();

      if (existingEmail) {
        throw new ValidationError('Email já está em uso');
      }

      const { data: company, error } = await supabase
        .from('empresas')
        .insert({
          ...companyData,
          email: companyData.email.toLowerCase(),
          status: 'active',
          created_by: user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Company creation error:', error);
        throw new AppError('Erro ao criar empresa');
      }

      console.log('Company created', {
        userId: user.id,
        companyId: company.id,
        companyName: company.name,
        cnpj: company.cnpj
      });

      res.status(201).json({
        success: true,
        message: 'Empresa criada com sucesso',
        data: {
          company
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error('Company creation error:', error);
      throw new AppError('Erro ao criar empresa');
    }
  })
);

/**
 * @swagger
 * /api/companies/{id}:
 *   put:
 *     tags: [Companies]
 *     summary: Atualizar empresa
 *     description: |
 *       Atualiza os dados de uma empresa existente.
 *       Admins podem atualizar sua própria empresa.
 *       Super admins podem atualizar qualquer empresa.
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
 *               plan:
 *                 type: string
 *                 enum: [basic, professional, enterprise]
 *               status:
 *                 type: string
 *                 enum: [active, inactive, suspended]
 *               address:
 *                 type: object
 *     responses:
 *       200:
 *         description: Empresa atualizada com sucesso
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:id',
  validateRequest({
    params: { id: commonSchemas.uuid },
    body: companySchemas.update
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;
    const updateData = req.body;

    // Users can only update their own company unless they're super admin
    const canUpdateOthers = user.role === 'super_admin';
    const isUpdatingOwnCompany = user.company_id === id;

    if (!isUpdatingOwnCompany && !canUpdateOthers) {
      throw new ValidationError('Sem permissão para atualizar esta empresa');
    }

    // Only super admins can change plan and status
    if ((updateData.plan || updateData.status) && user.role !== 'super_admin') {
      throw new ValidationError(
        'Apenas super administradores podem alterar plano ou status'
      );
    }

    // Only admins can update company data
    if (isUpdatingOwnCompany && user.role !== 'admin') {
      throw new ValidationError(
        'Apenas administradores podem atualizar dados da empresa'
      );
    }

    try {
      // Check if company exists
      const { data: existingCompany, error: checkError } = await supabase
        .from('empresas')
        .select('id, email, cnpj')
        .eq('id', id)
        .single();

      if (checkError || !existingCompany) {
        throw new NotFoundError('Empresa não encontrada');
      }

      // Check email uniqueness if being changed
      if (
        updateData.email &&
        updateData.email.toLowerCase() !== existingCompany.email
      ) {
        const { data: duplicateEmail } = await supabase
          .from('empresas')
          .select('id')
          .eq('email', updateData.email.toLowerCase())
          .neq('id', id)
          .single();

        if (duplicateEmail) {
          throw new ValidationError('Email já está em uso');
        }

        updateData.email = updateData.email.toLowerCase();
      }

      const { data: company, error } = await supabase
        .from('empresas')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Company update error:', error);
        throw new AppError('Erro ao atualizar empresa');
      }

      console.log('Company updated', {
        userId: user.id,
        companyId: id,
        changes: Object.keys(updateData),
        isUpdatingOwnCompany
      });

      res.json({
        success: true,
        message: 'Empresa atualizada com sucesso',
        data: {
          company
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Company update error:', error);
      throw new AppError('Erro ao atualizar empresa');
    }
  })
);

/**
 * @swagger
 * /api/companies/{id}/stats:
 *   get:
 *     tags: [Companies]
 *     summary: Estatísticas da empresa
 *     description: |
 *       Retorna estatísticas detalhadas de uma empresa específica.
 *       Inclui dados de usuários, propriedades, vistorias e uso do sistema.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Estatísticas da empresa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     company:
 *                       type: object
 *                     stats:
 *                       type: object
 *                       properties:
 *                         users:
 *                           type: object
 *                         properties:
 *                           type: object
 *                         inspections:
 *                           type: object
 *                         growth:
 *                           type: object
 */
router.get(
  '/:id/stats',
  validateRequest({
    params: { id: commonSchemas.uuid },
    query: {
      period: commonSchemas.period.optional()
    }
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;
    const { period = '30d' } = req.query;

    // Users can only see their own company stats unless they're super admin
    if (user.role !== 'super_admin' && user.company_id !== id) {
      throw new ValidationError(
        'Sem permissão para visualizar estatísticas desta empresa'
      );
    }

    try {
      // Get company basic info
      const { data: company, error: companyError } = await supabase
        .from('empresas')
        .select('id, name, plan, status, created_at')
        .eq('id', id)
        .single();

      if (companyError || !company) {
        throw new NotFoundError('Empresa não encontrada');
      }

      // Calculate date range
      const now = new Date();
      const periodDays = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      };

      const daysAgo = periodDays[period] || 30;
      const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      // Get detailed stats
      const [usersResult, propertiesResult, inspectionsResult] =
        await Promise.all([
          // Users stats
          supabase
            .from('users')
            .select('role, status, created_at, last_login')
            .eq('company_id', id),

          // Properties stats
          supabase
            .from('properties')
            .select('status, property_type, created_at')
            .eq('company_id', id),

          // Inspections stats
          supabase
            .from('inspections')
            .select('status, created_at, completed_date')
            .eq('company_id', id)
        ]);

      if (
        usersResult.error ||
        propertiesResult.error ||
        inspectionsResult.error
      ) {
        throw new AppError('Erro ao carregar estatísticas');
      }

      const users = usersResult.data || [];
      const properties = propertiesResult.data || [];
      const inspections = inspectionsResult.data || [];

      // Process stats
      const stats = {
        users: {
          total: users.length,
          active: users.filter(u => u.status === 'active').length,
          byRole: {
            admin: users.filter(u => u.role === 'admin').length,
            manager: users.filter(u => u.role === 'manager').length,
            inspector: users.filter(u => u.role === 'inspector').length,
            viewer: users.filter(u => u.role === 'viewer').length
          },
          recentLogins: users.filter(
            u => u.last_login && new Date(u.last_login) >= startDate
          ).length
        },

        properties: {
          total: properties.length,
          active: properties.filter(p => p.status === 'active').length,
          byType: {
            residential: properties.filter(
              p => p.property_type === 'residential'
            ).length,
            commercial: properties.filter(p => p.property_type === 'commercial')
              .length,
            industrial: properties.filter(p => p.property_type === 'industrial')
              .length,
            rural: properties.filter(p => p.property_type === 'rural').length
          },
          recentlyAdded: properties.filter(
            p => new Date(p.created_at) >= startDate
          ).length
        },

        inspections: {
          total: inspections.length,
          byStatus: {
            pending: inspections.filter(i => i.status === 'pending').length,
            in_progress: inspections.filter(i => i.status === 'in_progress')
              .length,
            completed: inspections.filter(i => i.status === 'completed').length,
            cancelled: inspections.filter(i => i.status === 'cancelled').length
          },
          thisPeriod: inspections.filter(
            i => new Date(i.created_at) >= startDate
          ).length,
          completedThisPeriod: inspections.filter(
            i => i.completed_date && new Date(i.completed_date) >= startDate
          ).length
        },

        growth: {
          period,
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          newUsers: users.filter(u => new Date(u.created_at) >= startDate)
            .length,
          newProperties: properties.filter(
            p => new Date(p.created_at) >= startDate
          ).length,
          newInspections: inspections.filter(
            i => new Date(i.created_at) >= startDate
          ).length
        }
      };

      console.log('Company stats retrieved', {
        userId: user.id,
        companyId: id,
        period,
        statsOverview: {
          users: stats.users.total,
          properties: stats.properties.total,
          inspections: stats.inspections.total
        }
      });

      res.json({
        success: true,
        data: {
          company,
          stats
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Company stats error:', error);
      throw new AppError('Erro ao carregar estatísticas da empresa');
    }
  })
);

module.exports = router;
