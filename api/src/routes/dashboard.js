const express = require('express');
const { supabase } = require('../config/supabase.js');
// const { logger } = require('../config/logger.js'); // Temporarily disabled to avoid circular dependency
const { asyncHandler, AppError } = require('../middleware/errorHandler.js');
const authModule = require('../middleware/auth.js');
const { validateRequest, commonSchemas } = require('../middleware/validation.js');
const { authMiddleware } = authModule;

const router = express.Router();

// All dashboard routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     tags: [Dashboard]
 *     summary: Estatísticas gerais do dashboard
 *     description: |
 *       Retorna estatísticas gerais da empresa:
 *       - Total de propriedades
 *       - Total de vistorias
 *       - Vistorias pendentes
 *       - Vistorias concluídas este mês
 *       - Contestações abertas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Período para estatísticas temporais
 *     responses:
 *       200:
 *         description: Estatísticas do dashboard
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
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 150
 *                         active:
 *                           type: integer
 *                           example: 145
 *                         inactive:
 *                           type: integer
 *                           example: 5
 *                     inspections:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 89
 *                         pending:
 *                           type: integer
 *                           example: 12
 *                         completed:
 *                           type: integer
 *                           example: 65
 *                         cancelled:
 *                           type: integer
 *                           example: 12
 *                         thisMonth:
 *                           type: integer
 *                           example: 23
 *                     contestations:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 8
 *                         open:
 *                           type: integer
 *                           example: 3
 *                         resolved:
 *                           type: integer
 *                           example: 5
 *                     users:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 15
 *                         active:
 *                           type: integer
 *                           example: 12
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { period = '30d' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    const periodDays = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };

    const daysAgo = periodDays[period] || 30;
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      // Get properties stats
      const { data: propertiesStats, error: propertiesError } = await supabase
        .from('properties')
        .select('status')
        .eq('company_id', user.company_id);

      if (propertiesError) {
        throw propertiesError;
      }

      const propertiesCount = {
        total: propertiesStats.length,
        active: propertiesStats.filter(p => p.status === 'active').length,
        inactive: propertiesStats.filter(p => p.status === 'inactive').length
      };

      // Get inspections stats
      const { data: inspectionsStats, error: inspectionsError } = await supabase
        .from('inspections')
        .select('status, created_at')
        .eq('company_id', user.company_id);

      if (inspectionsError) {
        throw inspectionsError;
      }

      const inspectionsCount = {
        total: inspectionsStats.length,
        pending: inspectionsStats.filter(i => i.status === 'pending').length,
        completed: inspectionsStats.filter(i => i.status === 'completed')
          .length,
        cancelled: inspectionsStats.filter(i => i.status === 'cancelled')
          .length,
        thisMonth: inspectionsStats.filter(
          i => new Date(i.created_at) >= startOfMonth
        ).length,
        thisPeriod: inspectionsStats.filter(
          i => new Date(i.created_at) >= startDate
        ).length
      };

      // Get contestations stats
      const { data: contestationsStats, error: contestationsError } =
        await supabase
          .from('contestations')
          .select('status')
          .eq('company_id', user.company_id);

      if (contestationsError) {
        throw contestationsError;
      }

      const contestationsCount = {
        total: contestationsStats.length,
        open: contestationsStats.filter(c =>
          ['pending', 'in_review'].includes(c.status)
        ).length,
        resolved: contestationsStats.filter(c =>
          ['approved', 'rejected'].includes(c.status)
        ).length
      };

      // Get users stats (only for admins and managers)
      let usersCount = null;
      if (['admin', 'manager'].includes(user.role)) {
        const { data: usersStats, error: usersError } = await supabase
          .from('users')
          .select('status')
          .eq('company_id', user.company_id);

        if (usersError) {
          throw usersError;
        }

        usersCount = {
          total: usersStats.length,
          active: usersStats.filter(u => u.status === 'active').length,
          inactive: usersStats.filter(u => u.status === 'inactive').length
        };
      }

      const stats = {
        properties: propertiesCount,
        inspections: inspectionsCount,
        contestations: contestationsCount,
        period: {
          days: daysAgo,
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        }
      };

      if (usersCount) {
        stats.users = usersCount;
      }

      console.log('Dashboard stats retrieved', {
        userId: user.id,
        companyId: user.company_id,
        period,
        stats: {
          properties: propertiesCount.total,
          inspections: inspectionsCount.total,
          contestations: contestationsCount.total
        }
      });

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      throw new AppError('Erro ao carregar estatísticas do dashboard');
    }
  })
);

/**
 * @swagger
 * /api/dashboard/recent-activity:
 *   get:
 *     tags: [Dashboard]
 *     summary: Atividades recentes
 *     description: |
 *       Retorna as atividades mais recentes da empresa:
 *       - Vistorias criadas/atualizadas
 *       - Contestações abertas
 *       - Novos usuários (apenas para admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Número máximo de atividades
 *     responses:
 *       200:
 *         description: Lista de atividades recentes
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
 *                     activities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [inspection, contestation, user]
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           status:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           user:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               role:
 *                                 type: string
 */
router.get(
  '/recent-activity',
  validateRequest({ query: commonSchemas.pagination }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { limit = 10 } = req.query;

    try {
      const activities = [];

      // Get recent inspections
      const { data: recentInspections, error: inspectionsError } =
        await supabase
          .from('inspections')
          .select(
            `
          id,
          status,
          created_at,
          updated_at,
          properties!inner(
            address
          ),
          users!inner(
            name,
            role
          )
        `
          )
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false })
          .limit(Math.min(limit, 20));

      if (inspectionsError) {
        throw inspectionsError;
      }

      recentInspections?.forEach(inspection => {
        activities.push({
          id: inspection.id,
          type: 'inspection',
          title: `Vistoria - ${inspection.properties.address}`,
          description: `Status: ${inspection.status}`,
          status: inspection.status,
          created_at: inspection.created_at,
          updated_at: inspection.updated_at,
          user: {
            name: inspection.users.name,
            role: inspection.users.role
          }
        });
      });

      // Get recent contestations
      const { data: recentContestations, error: contestationsError } =
        await supabase
          .from('contestations')
          .select(
            `
          id,
          status,
          reason,
          created_at,
          updated_at,
          inspections!inner(
            properties!inner(
              address
            )
          ),
          users!inner(
            name,
            role
          )
        `
          )
          .eq('company_id', user.company_id)
          .order('created_at', { ascending: false })
          .limit(Math.min(limit, 10));

      if (contestationsError) {
        throw contestationsError;
      }

      recentContestations?.forEach(contestation => {
        activities.push({
          id: contestation.id,
          type: 'contestation',
          title: `Contestação - ${contestation.inspections.properties.address}`,
          description: contestation.reason,
          status: contestation.status,
          created_at: contestation.created_at,
          updated_at: contestation.updated_at,
          user: {
            name: contestation.users.name,
            role: contestation.users.role
          }
        });
      });

      // Get recent users (only for admins and managers)
      if (['admin', 'manager'].includes(user.role)) {
        const { data: recentUsers, error: usersError } = await supabase
          .from('users')
          .select(
            `
            id,
            name,
            email,
            role,
            status,
            created_at
          `
          )
          .eq('company_id', user.company_id)
          .neq('id', user.id) // Exclude current user
          .order('created_at', { ascending: false })
          .limit(5);

        if (usersError) {
          throw usersError;
        }

        recentUsers?.forEach(newUser => {
          activities.push({
            id: newUser.id,
            type: 'user',
            title: `Novo usuário - ${newUser.name}`,
            description: `${newUser.role} - ${newUser.email}`,
            status: newUser.status,
            created_at: newUser.created_at,
            updated_at: newUser.created_at,
            user: {
              name: newUser.name,
              role: newUser.role
            }
          });
        });
      }

      // Sort all activities by creation date and limit
      const sortedActivities = activities
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);

      console.log('Recent activities retrieved', {
        userId: user.id,
        companyId: user.company_id,
        activitiesCount: sortedActivities.length,
        limit
      });

      res.json({
        success: true,
        data: {
          activities: sortedActivities,
          total: sortedActivities.length
        }
      });
    } catch (error) {
      console.error('Recent activities error:', error);
      throw new AppError('Erro ao carregar atividades recentes');
    }
  })
);

/**
 * @swagger
 * /api/dashboard/charts/inspections-by-status:
 *   get:
 *     tags: [Dashboard]
 *     summary: Gráfico de vistorias por status
 *     description: Dados para gráfico de pizza/donut das vistorias por status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y, all]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Dados do gráfico
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       status:
 *                         type: string
 *                       count:
 *                         type: integer
 *                       percentage:
 *                         type: number
 *                       color:
 *                         type: string
 */
router.get(
  '/charts/inspections-by-status',
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { period = '30d' } = req.query;

    try {
      let query = supabase
        .from('inspections')
        .select('status')
        .eq('company_id', user.company_id);

      // Apply period filter if not 'all'
      if (period !== 'all') {
        const periodDays = {
          '7d': 7,
          '30d': 30,
          '90d': 90,
          '1y': 365
        };

        const daysAgo = periodDays[period] || 30;
        const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        query = query.gte('created_at', startDate.toISOString());
      }

      const { data: inspections, error } = await query;

      if (error) {
        throw error;
      }

      // Count by status
      const statusCounts = {};
      const statusColors = {
        pending: '#f59e0b',
        in_progress: '#3b82f6',
        completed: '#10b981',
        cancelled: '#ef4444'
      };

      inspections.forEach(inspection => {
        statusCounts[inspection.status] =
          (statusCounts[inspection.status] || 0) + 1;
      });

      const total = inspections.length;
      const chartData = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage:
          total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
        color: statusColors[status] || '#6b7280'
      }));

      res.json({
        success: true,
        data: chartData
      });
    } catch (error) {
      console.error('Inspections chart error:', error);
      throw new AppError('Erro ao carregar dados do gráfico');
    }
  })
);

/**
 * @swagger
 * /api/dashboard/charts/inspections-timeline:
 *   get:
 *     tags: [Dashboard]
 *     summary: Timeline de vistorias
 *     description: Dados para gráfico de linha das vistorias ao longo do tempo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: Dados da timeline
 */
router.get(
  '/charts/inspections-timeline',
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { period = '30d', groupBy = 'day' } = req.query;

    try {
      const periodDays = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      };

      const daysAgo = periodDays[period] || 30;
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const { data: inspections, error } = await supabase
        .from('inspections')
        .select('created_at, status')
        .eq('company_id', user.company_id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Group data by time period
      const timelineData = {};

      inspections.forEach(inspection => {
        const date = new Date(inspection.created_at);
        let key;

        switch (groupBy) {
          case 'week': {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
            break;
          }
          case 'month': {
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          }
          default: // day
            key = date.toISOString().split('T')[0];
        }

        if (!timelineData[key]) {
          timelineData[key] = {
            date: key,
            total: 0,
            completed: 0,
            pending: 0,
            in_progress: 0,
            cancelled: 0
          };
        }

        timelineData[key].total++;
        timelineData[key][inspection.status]++;
      });

      const chartData = Object.values(timelineData).sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      res.json({
        success: true,
        data: chartData
      });
    } catch (error) {
      console.error('Timeline chart error:', error);
      throw new AppError('Erro ao carregar dados da timeline');
    }
  })
);

module.exports = router;
