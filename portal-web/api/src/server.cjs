// Load environment variables FIRST
const dotenv = require('dotenv');
const path = require('path');

// Debug: Log environment variables loading
// Environment variables loaded (debug info removed)

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Import configurations
// const { logger } = require('./config/logger.js'); // Temporarily disabled to avoid circular dependency
console.log('✅ Logger import skipped (temporarily disabled)');
const { swaggerSpec, swaggerUi } = require('./config/swagger.js');
console.log('✅ Swagger imported successfully');
const { cacheService, cacheMiddleware } = require('./config/cache.js');
console.log('✅ Cache service imported successfully');
const { CDNService, createAssetMiddleware, createStaticCacheMiddleware, compressionMiddleware } = require('./config/cdn.js');
console.log('✅ CDN service imported successfully');
const { monitoringService, Sentry } = require('./config/monitoring.js');
console.log('✅ Monitoring service imported successfully');
const { backupService } = require('./config/backup.js');
console.log('✅ Backup service imported successfully');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler.js');
console.log('✅ ErrorHandler imported successfully');
const { securityHeaders, enforceHTTPS } = require('./middleware/security.js');
console.log('✅ Security middleware imported successfully');
// Auth middlewares are imported in route files as needed
// Auth middlewares are imported in route files as needed

// Import routes
console.log('🔄 Starting to import routes...');
const v1Routes = require('./routes/v1/index.js');
console.log('✅ V1 routes imported successfully');
const dashboardRoutes = require('./routes/dashboard.js');
console.log('✅ Dashboard routes imported successfully');
const syncRoutes = require('./routes/sync.js');
console.log('✅ Sync routes imported successfully');
const healthRoutes = require('./routes/health.js');
console.log('✅ Health routes imported successfully');
const publicRoutes = require('./routes/public.js');
console.log('✅ Public routes imported successfully');

// Load .env from api root directory
const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.local';
dotenv.config({ path: path.join(__dirname, '..', envFile) });
const notificationsRoutes = require('./routes/notifications.js');
console.log('✅ Notifications routes imported successfully');
const mvpRoutes = require('./routes/mvp-routes.js');
console.log('✅ MVP routes imported successfully');
// Debug routes removed for security reasons
// import debugRoutes from './routes/debug.js';
// console.log('✅ Debug routes imported successfully');

console.log('🔄 Creating Express app...');
const app = express();
const PORT = process.env.PORT || 5000;
console.log('✅ Express app created successfully');

// Rate limiting
console.log('🔄 Configuring rate limiting...');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Security middleware with comprehensive headers
console.log('🔄 Configuring security headers...');
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", 'https://api.grifo.com', 'https://*.supabase.co']
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true
  })
);

// Configuração de CORS
console.log('🔄 Configuring CORS...');
const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['https://grifo-portal.vercel.app'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
console.log('✅ CORS configured successfully');

// SSL/TLS enforcement (must be early in middleware chain)
console.log('🔄 Configuring SSL/TLS enforcement...');
app.use(enforceHTTPS);
console.log('✅ SSL/TLS enforcement applied');

// Sentry request handler (must be first)
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
console.log('✅ Sentry request tracking applied');

// Monitoring middleware
app.use(monitoringService.createRequestTrackingMiddleware());
console.log('✅ Request monitoring applied');

// Advanced compression with CDN support
app.use(compressionMiddleware());
console.log('✅ Advanced compression middleware applied');
app.use(express.json({ limit: '50mb' }));
console.log('✅ JSON middleware applied');
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
console.log('✅ URL encoded middleware applied');
app.use(limiter);
console.log('✅ Rate limiter applied');

// Additional security headers
app.use(securityHeaders);
console.log('✅ Security headers applied');

// Logging middleware
console.log('🔄 Configuring logging middleware...');
app.use(
  morgan('combined', {
    stream: {
      write: message => console.log(message.trim())
    }
  })
);
console.log('✅ Logging middleware applied');

// CDN and static assets middleware
console.log('🔄 Configuring CDN and static assets...');
app.use('/assets', createAssetMiddleware());
app.use('/static', createStaticCacheMiddleware());
console.log('✅ CDN and static assets configured');

// Cache middleware for API responses - TEMPORARILY DISABLED FOR DEBUGGING
// app.use('/api/v1', cacheMiddleware);
console.log('⚠️ API cache middleware DISABLED for debugging');

// Health check endpoint (before auth middleware)
console.log('🔄 Configuring health route...');
app.use('/api/health', healthRoutes);
console.log('✅ Health route configured');

// Advanced health check endpoint with monitoring
app.get('/api/health/detailed', async (req, res) => {
  try {
    const healthStatus = await monitoringService.runHealthChecks();
    const performanceMetrics = monitoringService.getPerformanceMetrics();
    
    res.status(healthStatus.status === 'healthy' ? 200 : 503).json({
      ...healthStatus,
      performance: performanceMetrics
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
console.log('✅ Detailed health check configured');

// Public endpoints (no authentication required)
console.log('🔄 Configuring public routes...');
app.use('/api/public', publicRoutes);
console.log('✅ Public routes configured');

// Debug endpoints removed for security reasons
// console.log('🔄 Configuring debug routes...');
// app.use('/api/debug', debugRoutes);
// console.log('✅ Debug routes configured');

// API Documentation
console.log('🔄 Configuring API documentation...');
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Grifo API Documentation'
  })
);
console.log('✅ API documentation configured');

// MVP Routes (priority over v1 routes)
console.log('🔄 Configuring MVP routes...');
app.use('/api', mvpRoutes);
console.log('✅ MVP routes configured');

// Test endpoint to debug hanging issue
app.get('/api/test-simple', (req, res) => {
  console.log('Simple test endpoint called');
  res.json({ success: true, message: 'Simple test works', timestamp: new Date().toISOString() });
});

// Test endpoint that bypasses all auth middleware
app.get('/api/test-auth-bypass', (req, res) => {
  res.json({ 
    message: 'Auth bypass test works', 
    timestamp: new Date().toISOString(),
    supabase_url: process.env.SUPABASE_URL ? 'SET' : 'NOT_SET',
    supabase_anon_key: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET'
  });
});

// Test endpoint that simulates what authSupabase middleware does
app.get('/api/test-supabase-connection', async (req, res) => {
  try {
    const { supabase } = require('./config/supabase.js');
    console.log('Testing Supabase connection...');
    
    // Test with a dummy token to see if supabase.auth.getUser() hangs
    const testToken = 'dummy-token-for-testing';
    console.log('About to call supabase.auth.getUser()...');
    
    const startTime = Date.now();
    const { data, error } = await supabase.auth.getUser(testToken);
    const endTime = Date.now();
    
    console.log('supabase.auth.getUser() completed', { duration: endTime - startTime });
    
    res.json({
      message: 'Supabase connection test completed',
      duration: endTime - startTime,
      error: error?.message || null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Supabase connection test failed:', err);
    res.status(500).json({
      message: 'Supabase connection test failed',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint to check cache middleware impact
app.get('/api/test-cache-bypass', (req, res) => {
  res.json({
    success: true,
    message: 'Cache bypass working - no cache middleware applied',
    timestamp: new Date().toISOString()
  });
});

// API Routes
console.log('🔄 Configuring v1 routes...');
app.use('/api/v1', v1Routes);
console.log('✅ V1 routes configured');
console.log('🔄 Configuring dashboard routes...');
app.use('/api/dashboard', dashboardRoutes);
console.log('✅ Dashboard routes configured');
console.log('🔄 Configuring sync routes...');
app.use('/api/sync', syncRoutes);
console.log('✅ Sync routes configured');
console.log('🔄 Configuring notifications routes...');
app.use('/api/notifications', notificationsRoutes);
console.log('✅ Notifications routes configured');

// Backup management endpoints
app.get('/api/admin/backup/list', async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    res.json({ success: true, backups });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/backup/create', async (req, res) => {
  try {
    const { type = 'full' } = req.body;
    const result = type === 'incremental' 
      ? await backupService.createIncrementalBackup()
      : await backupService.createFullBackup();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/metrics', async (req, res) => {
  try {
    const performance = monitoringService.getPerformanceMetrics();
    const system = await monitoringService.getSystemMetrics();
    res.json({ success: true, performance, system });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
console.log('✅ Admin endpoints configured');

// Root endpoint
console.log('🔄 Configuring root endpoint...');
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Grifo API Backend',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    features: {
      ssl: true,
      cache: cacheService.isConnected,
      monitoring: true,
      backup: true,
      cdn: true
    },
    endpoints: {
      health: '/api/health',
      healthDetailed: '/api/health/detailed',
      docs: '/api/docs',
      mvp: '/api (MVP endpoints)',
      v1: '/api/v1',
      dashboard: '/api/dashboard',
      sync: '/api/sync',
      notifications: '/api/notifications',
      public: '/api/public',
      admin: '/api/admin/*'
    }
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method
  });
});

// Sentry error handler (before other error handlers)
app.use(Sentry.Handlers.errorHandler());
app.use(monitoringService.createErrorTrackingMiddleware());
console.log('✅ Sentry error tracking configured');

// Error handling middleware (must be last)
console.log('🔄 Configuring error handler...');
app.use(errorHandler);
console.log('✅ Error handler configured');

// Start server
console.log('🔄 Starting server...');
const server = app.listen(PORT, () => {
  console.log(`🚀 Grifo API Server running on port ${PORT}`);
    console.log(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
    console.log(`🏥 Health check available at http://localhost:${PORT}/api/health`);
  console.log('✅ Server started successfully!');
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err);
  console.error('Server startup error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
