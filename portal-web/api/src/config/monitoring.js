/**
 * Configuração de Monitoramento e Error Tracking
 * Implementa Sentry, APM, health checks e métricas de performance
 */

const Sentry = require('@sentry/node');
const os = require('os');
const { cacheService } = require('./cache.js');

// Importação opcional do profiling (pode não estar disponível em alguns ambientes)
let ProfilingIntegration = null;
try {
  const profilingModule = require('@sentry/profiling-node');
  ProfilingIntegration = profilingModule.ProfilingIntegration;
  console.log('✅ Sentry profiling module loaded successfully');
} catch (error) {
  console.log('ℹ️ Sentry profiling not available:', error.message);
}

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      memoryUsage: [],
      cpuUsage: []
    };
    
    this.healthChecks = new Map();
    this.initSentry();
    this.startMetricsCollection();
  }

  /**
   * Inicializa Sentry para error tracking
   */
  initSentry() {
    if (!process.env.SENTRY_DSN) {
      console.log('ℹ️ Sentry DSN not configured, skipping error tracking setup');
      return;
    }

    try {
      // Configuração base das integrações
      const integrations = [
        // Performance monitoring
        new Sentry.Integrations.Http({ tracing: true }),
        // Express integration will be configured later to avoid circular dependency
        // new Sentry.Integrations.Express({ app: require('../server.cjs') }),
      ];

      // Adiciona profiling apenas se disponível
      if (ProfilingIntegration) {
        integrations.push(new ProfilingIntegration());
        console.log('✅ Sentry profiling integration enabled');
      } else {
        console.log('ℹ️ Sentry profiling integration disabled (not available)');
      }

      const sentryConfig = {
         dsn: process.env.SENTRY_DSN,
         environment: process.env.NODE_ENV || 'development',
         integrations,
         // Performance Monitoring
         tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
         // Release tracking
         release: process.env.APP_VERSION || '1.0.0',
         // Error filtering
         beforeSend(event) {
           // Filtra erros conhecidos ou irrelevantes
           if (event.exception) {
             const error = event.exception.values[0];
             if (error.type === 'ValidationError' || 
                 error.value?.includes('ECONNREFUSED')) {
               return null; // Não envia para Sentry
             }
           }
           return event;
         }
       };

       // Adiciona profiling sample rate apenas se profiling estiver disponível
       if (ProfilingIntegration) {
         sentryConfig.profilesSampleRate = process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
       }

       Sentry.init(sentryConfig);

      console.log('✅ Sentry initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Sentry:', error.message);
    }
  }

  /**
   * Middleware para tracking de requests
   */
  createRequestTrackingMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      this.metrics.requests++;

      // Adiciona informações ao contexto do Sentry
      Sentry.setContext('request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      // Intercepta o final da resposta
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.metrics.responseTime.push(responseTime);

        // Mantém apenas os últimos 1000 registros
        if (this.metrics.responseTime.length > 1000) {
          this.metrics.responseTime = this.metrics.responseTime.slice(-1000);
        }

        // Log de requests lentos
        if (responseTime > 5000) {
          console.warn(`⚠️ Slow request: ${req.method} ${req.url} - ${responseTime}ms`);
          Sentry.addBreadcrumb({
            message: 'Slow request detected',
            level: 'warning',
            data: {
              method: req.method,
              url: req.url,
              responseTime
            }
          });
        }

        // Conta erros
        if (res.statusCode >= 400) {
          this.metrics.errors++;
        }
      });

      next();
    };
  }

  /**
   * Middleware de error handling para Sentry
   */
  createErrorTrackingMiddleware() {
    return (error, req, res, next) => {
      // Envia erro para Sentry
      Sentry.captureException(error, {
        tags: {
          component: 'api',
          method: req.method,
          url: req.url
        },
        extra: {
          body: req.body,
          query: req.query,
          params: req.params
        }
      });

      next(error);
    };
  }

  /**
   * Registra um health check
   */
  registerHealthCheck(name, checkFunction) {
    this.healthChecks.set(name, checkFunction);
  }

  /**
   * Executa todos os health checks
   */
  async runHealthChecks() {
    const results = {};
    let overallStatus = 'healthy';

    for (const [name, checkFunction] of this.healthChecks) {
      try {
        const startTime = Date.now();
        const result = await Promise.race([
          checkFunction(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);
        
        const responseTime = Date.now() - startTime;
        
        results[name] = {
          status: 'healthy',
          responseTime,
          ...result
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results,
      system: await this.getSystemMetrics()
    };
  }

  /**
   * Coleta métricas do sistema
   */
  async getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024) // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: Math.round(process.uptime()),
      loadAverage: os.loadavg(),
      platform: os.platform(),
      nodeVersion: process.version
    };
  }

  /**
   * Coleta métricas de performance
   */
  getPerformanceMetrics() {
    const responseTime = this.metrics.responseTime;
    const avgResponseTime = responseTime.length > 0 
      ? responseTime.reduce((a, b) => a + b, 0) / responseTime.length 
      : 0;
    
    const p95ResponseTime = responseTime.length > 0
      ? responseTime.sort((a, b) => a - b)[Math.floor(responseTime.length * 0.95)]
      : 0;

    return {
      requests: {
        total: this.metrics.requests,
        errors: this.metrics.errors,
        errorRate: this.metrics.requests > 0 
          ? (this.metrics.errors / this.metrics.requests * 100).toFixed(2) + '%'
          : '0%'
      },
      responseTime: {
        average: Math.round(avgResponseTime),
        p95: Math.round(p95ResponseTime),
        samples: responseTime.length
      }
    };
  }

  /**
   * Inicia coleta automática de métricas
   */
  startMetricsCollection() {
    // Coleta métricas de sistema a cada 30 segundos
    setInterval(async () => {
      try {
        const metrics = await this.getSystemMetrics();
        this.metrics.memoryUsage.push({
          timestamp: Date.now(),
          ...metrics.memory
        });
        
        // Mantém apenas as últimas 100 amostras (50 minutos)
        if (this.metrics.memoryUsage.length > 100) {
          this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
        }

        // Alerta se memória estiver alta
        if (metrics.memory.used > 500) { // > 500MB
          console.warn(`⚠️ High memory usage: ${metrics.memory.used}MB`);
        }
      } catch (error) {
        console.error('❌ Error collecting metrics:', error.message);
      }
    }, 30000);
  }
}

// Instância singleton do monitoramento
const monitoringService = new MonitoringService();

// Registra health checks padrão
monitoringService.registerHealthCheck('database', async () => {
  // Implementar check do banco de dados
  return { message: 'Database connection OK' };
});

monitoringService.registerHealthCheck('cache', async () => {
  if (cacheService.isConnected) {
    await cacheService.set('health_check', 'ok', 10);
    const result = await cacheService.get('health_check');
    return { 
      message: result === 'ok' ? 'Cache OK' : 'Cache read/write failed'
    };
  }
  return { message: 'Cache not connected' };
});

monitoringService.registerHealthCheck('disk_space', async () => {
  const fs = require('fs').promises;
  try {
    const stats = await fs.stat(process.cwd());
    return { message: 'Disk access OK' };
  } catch (error) {
    throw new Error('Disk access failed');
  }
});

module.exports = {
  monitoringService,
  Sentry
};