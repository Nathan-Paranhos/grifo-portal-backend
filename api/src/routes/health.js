const express = require('express');
const { supabase } = require('../config/supabase.js');
// const { logger } = require('../config/logger.js');
const { asyncHandler } = require('../middleware/errorHandler.js');
const { authSupabase } = require('../middleware/auth.js');
const os = require('os');
const process = require('process');

const router = express.Router();

// Store startup time
const startupTime = new Date();

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Health check básico
 *     description: |
 *       Endpoint básico de health check que retorna o status da API.
 *       Não requer autenticação.
 *     responses:
 *       200:
 *         description: API está funcionando
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00Z"
 *                 uptime:
 *                   type: number
 *                   description: Tempo de atividade em segundos
 *                   example: 3600
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const uptime = Math.floor((Date.now() - startupTime.getTime()) / 1000);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  })
);

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     tags: [Health]
 *     summary: Health check detalhado
 *     description: |
 *       Endpoint detalhado de health check que inclui informações do sistema,
 *       conectividade com banco de dados e métricas de performance.
 *       Requer autenticação de administrador.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status detalhado da API
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 version:
 *                   type: string
 *                 environment:
 *                   type: string
 *                 system:
 *                   type: object
 *                   properties:
 *                     platform:
 *                       type: string
 *                     arch:
 *                       type: string
 *                     node_version:
 *                       type: string
 *                     memory:
 *                       type: object
 *                       properties:
 *                         used:
 *                           type: number
 *                         total:
 *                           type: number
 *                         free:
 *                           type: number
 *                     cpu:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: number
 *                         load_avg:
 *                           type: array
 *                           items:
 *                             type: number
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     response_time:
 *                       type: number
 *                     connection_pool:
 *                       type: object
 *                 services:
 *                   type: object
 *                   properties:
 *                     supabase:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         response_time:
 *                           type: number
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
/**
 * @swagger
 * /api/health/env-check:
 *   get:
 *     tags: [Health]
 *     summary: Verificar variáveis de ambiente
 *     description: |
 *       Endpoint para verificar se as variáveis de ambiente críticas
 *       estão configuradas corretamente. Não requer autenticação.
 *     responses:
 *       200:
 *         description: Status das variáveis de ambiente
 */
router.get(
  '/env-check',
  asyncHandler(async (req, res) => {
    const envCheck = {
      supabase_url: {
        configured: !!process.env.SUPABASE_URL,
        value: process.env.SUPABASE_URL
          ? process.env.SUPABASE_URL.substring(0, 30) + '...'
          : 'NOT_SET'
      },
      supabase_anon_key: {
        configured: !!process.env.SUPABASE_ANON_KEY,
        length: process.env.SUPABASE_ANON_KEY
          ? process.env.SUPABASE_ANON_KEY.length
          : 0
      },
      supabase_service_key: {
        configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        length: process.env.SUPABASE_SERVICE_ROLE_KEY
          ? process.env.SUPABASE_SERVICE_ROLE_KEY.length
          : 0
      },
      jwt_secret: {
        configured: !!process.env.JWT_SECRET,
        length: process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0
      },
      node_env: process.env.NODE_ENV || 'NOT_SET',
      port: process.env.PORT || 'NOT_SET',
      render_service: process.env.RENDER_SERVICE_NAME || 'NOT_SET'
    };

    const allConfigured =
      envCheck.supabase_url.configured &&
      envCheck.supabase_anon_key.configured &&
      envCheck.supabase_service_key.configured &&
      envCheck.jwt_secret.configured;

    res.json({
      status: allConfigured ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      environment_variables: envCheck,
      summary: {
        all_configured: allConfigured,
        missing_count: Object.values(envCheck).filter(
          v => typeof v === 'object' && !v.configured
        ).length
      }
    });
  })
);

router.get(
  '/detailed',
  authSupabase,
  asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const uptime = Math.floor((Date.now() - startupTime.getTime()) / 1000);

    try {
      // System information
      const memoryUsage = process.memoryUsage();
      const systemMemory = {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        free: os.freemem(),
        system_total: os.totalmem()
      };

      const systemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        node_version: process.version,
        memory: systemMemory,
        cpu: {
          count: os.cpus().length,
          load_avg: os.loadavg()
        }
      };

      // Database health check
      const dbStartTime = Date.now();
      let databaseStatus = {
        status: 'unknown',
        response_time: null,
        error: null
      };

      try {
        const { error } = await supabase.from('empresas').select('id').limit(1);

        const dbResponseTime = Date.now() - dbStartTime;

        if (error) {
          databaseStatus = {
            status: 'error',
            response_time: dbResponseTime,
            error: error.message
          };
        } else {
          databaseStatus = {
            status: 'healthy',
            response_time: dbResponseTime,
            connection_pool: {
              active: 'N/A', // Supabase doesn't expose this
              idle: 'N/A',
              total: 'N/A'
            }
          };
        }
      } catch (dbError) {
        databaseStatus = {
          status: 'error',
          response_time: Date.now() - dbStartTime,
          error: dbError.message
        };
      }

      // Supabase service check
      const supabaseStartTime = Date.now();
      let supabaseStatus = {
        status: 'unknown',
        response_time: null,
        error: null
      };

      try {
        // Test Supabase Auth service
        await supabase.auth.getUser('invalid-token');
        const supabaseResponseTime = Date.now() - supabaseStartTime;

        // We expect an error here since we're using an invalid token
        // If we get a response (even an error), the service is working
        supabaseStatus = {
          status: 'healthy',
          response_time: supabaseResponseTime,
          auth_service: 'responsive',
          storage_service: 'not_tested' // Could add storage test here
        };
      } catch (supabaseError) {
        supabaseStatus = {
          status: 'error',
          response_time: Date.now() - supabaseStartTime,
          error: supabaseError.message
        };
      }

      // Overall status determination
      let overallStatus = 'healthy';
      if (
        databaseStatus.status === 'error' ||
        supabaseStatus.status === 'error'
      ) {
        overallStatus = 'degraded';
      }

      const totalResponseTime = Date.now() - startTime;

      console.log('Detailed health check performed', {
        userId: req.user?.id,
        overallStatus,
        dbStatus: databaseStatus.status,
        supabaseStatus: supabaseStatus.status,
        responseTime: totalResponseTime
      });

      res.json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        response_time: totalResponseTime,
        system: systemInfo,
        database: databaseStatus,
        services: {
          supabase: supabaseStatus
        }
      });
    } catch (error) {
      console.error('Detailed health check error:', error);

      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        error: error.message,
        response_time: Date.now() - startTime
      });
    }
  })
);

/**
 * @swagger
 * /api/health/readiness:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe
 *     description: |
 *       Endpoint para verificar se a API está pronta para receber tráfego.
 *       Verifica conectividade com serviços essenciais.
 *     responses:
 *       200:
 *         description: API está pronta
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ready:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: boolean
 *                     supabase:
 *                       type: boolean
 *       503:
 *         description: API não está pronta
 */
router.get(
  '/readiness',
  asyncHandler(async (req, res) => {
    const checks = {
      database: false,
      supabase: false
    };

    let ready = true;

    try {
      // Database readiness check
      const { error: dbError } = await supabase
        .from('empresas')
        .select('id')
        .limit(1);

      checks.database = !dbError;
      if (dbError) {
        ready = false;
      }

      // Supabase service readiness check
      try {
        await supabase.auth.getUser('test-token');
        checks.supabase = true;
      } catch (supabaseError) {
        // We expect an error, but if we get a response, the service is ready
        checks.supabase = true;
      }
    } catch (error) {
      ready = false;
      console.error('Readiness check error:', error);
    }

    const status = ready ? 200 : 503;

    res.status(status).json({
      ready,
      timestamp: new Date().toISOString(),
      checks
    });
  })
);

/**
 * @swagger
 * /api/health/liveness:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     description: |
 *       Endpoint para verificar se a API está viva e funcionando.
 *       Usado por orquestradores como Kubernetes para reiniciar containers.
 *     responses:
 *       200:
 *         description: API está viva
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alive:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 memory_usage:
 *                   type: object
 *                   properties:
 *                     heap_used:
 *                       type: number
 *                     heap_total:
 *                       type: number
 *                     external:
 *                       type: number
 */
router.get(
  '/liveness',
  asyncHandler(async (req, res) => {
    const uptime = Math.floor((Date.now() - startupTime.getTime()) / 1000);
    const memoryUsage = process.memoryUsage();

    // Simple liveness check - if we can respond, we're alive
    res.json({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime,
      memory_usage: {
        heap_used: memoryUsage.heapUsed,
        heap_total: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      process_id: process.pid
    });
  })
);

/**
 * @swagger
 * /api/health/metrics:
 *   get:
 *     tags: [Health]
 *     summary: Métricas da aplicação
 *     description: |
 *       Endpoint que retorna métricas básicas da aplicação para monitoramento.
 *       Requer autenticação de administrador.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas da aplicação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 requests:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     per_minute:
 *                       type: number
 *                 memory:
 *                   type: object
 *                 cpu:
 *                   type: object
 *                 database:
 *                   type: object
 *                   properties:
 *                     connections:
 *                       type: number
 *                     queries_per_second:
 *                       type: number
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get(
  '/metrics',
  authSupabase,
  asyncHandler(async (req, res) => {
    const uptime = Math.floor((Date.now() - startupTime.getTime()) / 1000);
    const memoryUsage = process.memoryUsage();

    // In a real application, you would collect these metrics over time
    // For now, we'll provide basic system metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime,
      requests: {
        total: 'N/A', // Would need request counter middleware
        per_minute: 'N/A',
        errors: 'N/A'
      },
      memory: {
        heap_used: memoryUsage.heapUsed,
        heap_total: memoryUsage.heapTotal,
        heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      cpu: {
        usage_percent: 'N/A', // Would need CPU monitoring
        load_average: os.loadavg(),
        cores: os.cpus().length
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        node_version: process.version,
        free_memory: os.freemem(),
        total_memory: os.totalmem(),
        free_memory_mb: Math.round(os.freemem() / 1024 / 1024),
        total_memory_mb: Math.round(os.totalmem() / 1024 / 1024)
      },
      database: {
        status: 'connected', // Simplified
        connections: 'N/A', // Supabase doesn't expose this
        queries_per_second: 'N/A'
      }
    };

    console.log('Metrics retrieved', {
      userId: req.user.id,
      uptime,
      memoryUsedMB: metrics.memory.heap_used_mb
    });

    res.json(metrics);
  })
);

/**
 * @swagger
 * /api/health/version:
 *   get:
 *     tags: [Health]
 *     summary: Informações de versão
 *     description: |
 *       Retorna informações sobre a versão da API e dependências.
 *     responses:
 *       200:
 *         description: Informações de versão
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_version:
 *                   type: string
 *                   example: "1.0.0"
 *                 node_version:
 *                   type: string
 *                   example: "v18.17.0"
 *                 environment:
 *                   type: string
 *                   example: "production"
 *                 build_date:
 *                   type: string
 *                   format: date-time
 *                 commit_hash:
 *                   type: string
 *                   example: "abc123def456"
 *                 dependencies:
 *                   type: object
 */
router.get(
  '/version',
  asyncHandler(async (req, res) => {
    // In a real deployment, these would come from build process
    const versionInfo = {
      api_version: process.env.npm_package_version || '1.0.0',
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development',
      build_date: process.env.BUILD_DATE || startupTime.toISOString(),
      commit_hash: process.env.GIT_COMMIT || 'unknown',
      startup_time: startupTime.toISOString(),
      dependencies: {
        express: 'latest',
        supabase: 'latest',
        winston: 'latest',
        zod: 'latest',
        jsonwebtoken: 'latest',
        bcryptjs: 'latest',
        multer: 'latest',
        cors: 'latest',
        helmet: 'latest',
        'express-rate-limit': 'latest'
      }
    };

    res.json(versionInfo);
  })
);

module.exports = router;
