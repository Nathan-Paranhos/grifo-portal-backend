const express = require('express');
const { supabase } = require('../../config/supabase.js');
// const { logger } = require('../../config/logger.js');
const { asyncHandler, AppError } = require('../../middleware/errorHandler.js');
const {
  authSupabase,
  requireRole,
  optionalAuth
} = require('../../middleware/auth.js');

const router = express.Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     tags: [Health]
 *     summary: Verificar saúde da API
 *     responses:
 *       200:
 *         description: API funcionando corretamente
 *         schema:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *               example: healthy
 *             timestamp:
 *               type: string
 *               format: date-time
 *             uptime:
 *               type: number
 *             version:
 *               type: string
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.API_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    res.json({
      success: true,
      data: healthCheck
    });
  })
);

/**
 * @swagger
 * /api/v1/health/detailed:
 *   get:
 *     tags: [Health]
 *     summary: Verificação detalhada de saúde
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status detalhado dos serviços
 */
router.get(
  '/detailed',
  authSupabase,
  requireRole(['admin']),
  asyncHandler(async (req, res) => {
    const checks = {
      api: { status: 'healthy', timestamp: new Date().toISOString() },
      database: { status: 'unknown', timestamp: null, error: null },
      storage: { status: 'unknown', timestamp: null, error: null }
    };

    // Test database connection
    try {
      const { error } = await supabase.from('empresas').select('id').limit(1);

      if (error) {
        checks.database.status = 'unhealthy';
        checks.database.error = error.message;
      } else {
        checks.database.status = 'healthy';
      }
      checks.database.timestamp = new Date().toISOString();
    } catch (error) {
      checks.database.status = 'unhealthy';
      checks.database.error = error.message;
      checks.database.timestamp = new Date().toISOString();
    }

    // Test storage connection
    try {
      const { error } = await supabase.storage
        .from('uploads')
        .list('', { limit: 1 });

      if (error) {
        checks.storage.status = 'unhealthy';
        checks.storage.error = error.message;
      } else {
        checks.storage.status = 'healthy';
      }
      checks.storage.timestamp = new Date().toISOString();
    } catch (error) {
      checks.storage.status = 'unhealthy';
      checks.storage.error = error.message;
      checks.storage.timestamp = new Date().toISOString();
    }

    // Overall health status
    const allHealthy = Object.values(checks).every(
      check => check.status === 'healthy'
    );
    const overallStatus = allHealthy ? 'healthy' : 'degraded';

    const healthCheck = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.API_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: checks,
      system: {
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        },
        cpu: {
          usage: process.cpuUsage()
        }
      }
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: overallStatus === 'healthy',
      data: healthCheck
    });
  })
);

/**
 * @swagger
 * /api/v1/health/database:
 *   get:
 *     tags: [Health]
 *     summary: Verificar conexão com banco de dados
 *     responses:
 *       200:
 *         description: Banco de dados acessível
 */
router.get(
  '/database',
  asyncHandler(async (req, res) => {
    try {
      const startTime = Date.now();

      const { error } = await supabase.from('empresas').select('id').limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        throw new AppError(`Database connection failed: ${error.message}`, 503);
      }

      res.json({
        success: true,
        data: {
          status: 'healthy',
          response_time_ms: responseTime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Database health check failed:', error);

      res.status(503).json({
        success: false,
        error: {
          message: 'Database connection failed',
          details: error.message
        },
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

/**
 * @swagger
 * /api/v1/health/storage:
 *   get:
 *     tags: [Health]
 *     summary: Verificar conexão com storage
 *     responses:
 *       200:
 *         description: Storage acessível
 */
router.get(
  '/storage',
  asyncHandler(async (req, res) => {
    try {
      const startTime = Date.now();

      const { error } = await supabase.storage
        .from('uploads')
        .list('', { limit: 1 });

      const responseTime = Date.now() - startTime;

      if (error) {
        throw new AppError(`Storage connection failed: ${error.message}`, 503);
      }

      res.json({
        success: true,
        data: {
          status: 'healthy',
          response_time_ms: responseTime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Storage health check failed:', error);

      res.status(503).json({
        success: false,
        error: {
          message: 'Storage connection failed',
          details: error.message
        },
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

/**
 * @swagger
 * /api/v1/health/metrics:
 *   get:
 *     tags: [Health]
 *     summary: Obter métricas do sistema
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas do sistema
 */
router.get(
  '/metrics',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external_mb: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      cpu: process.cpuUsage(),
      version: process.env.API_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      node_version: process.version,
      platform: process.platform,
      arch: process.arch
    };

    // Add database metrics if authenticated
    if (req.user) {
      try {
        const empresaId = req.user.app_metadata.empresa_id;

        const [vistoriasCount, imoveisCount, usersCount] =
          await Promise.all([
            supabase
              .from('vistorias')
              .select('id', { count: 'exact' })
              .eq('empresa_id', empresaId),
            supabase
              .from('imoveis')
              .select('id', { count: 'exact' })
              .eq('empresa_id', empresaId),
            supabase
              .from('app_users')
              .select('id', { count: 'exact' })
              .eq('empresa_id', empresaId)
          ]);

        metrics.database_metrics = {
          vistorias: vistoriasCount.count || 0,
          imoveis: imoveisCount.count || 0,
          users: usersCount.count || 0
        };
      } catch (error) {
        console.error('Error fetching database metrics:', error);
        metrics.database_metrics = {
          error: 'Failed to fetch database metrics'
        };
      }
    }

    res.json({
      success: true,
      data: metrics
    });
  })
);

/**
 * @swagger
 * /api/v1/health/ping:
 *   get:
 *     tags: [Health]
 *     summary: Ping simples
 *     responses:
 *       200:
 *         description: Pong
 */
router.get(
  '/ping',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        message: 'pong',
        timestamp: new Date().toISOString()
      }
    });
  })
);

module.exports = router;
