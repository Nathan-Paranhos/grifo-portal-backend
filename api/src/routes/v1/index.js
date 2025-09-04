const express = require('express');
const tenantRoutes = require('./tenants.js');
const authRoutes = require('./auth.js');
const companyRoutes = require('./companies.js');
const userRoutes = require('./users.js');
const propertyRoutes = require('./properties.js');
const inspectionRoutes = require('./inspections.js');

const uploadRoutes = require('./uploads.js');
const reportRoutes = require('./reports.js');
const healthRoutes = require('./health.js');
const notificationRoutes = require('./notifications.js');
const settingsRoutes = require('./settings.js');
const adminClientsRoutes = require('./admin-clients.js');
const approvalWorkflowRoutes = require('./approval-workflow.js');

// Import client system routes
const clientRoutes = require('../clients.js');
const inspectionRequestRoutes = require('../inspection-requests.js');

// Import middlewares
const { authSupabase } = require('../../middleware/auth.js');
const { resolveTenant, requireTenantAccess } = require('../../middleware/tenant.js');

const router = express.Router();

// API Info endpoint (público)
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Grifo Vistorias API v1',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      // Rotas públicas
      health: '/api/v1/health',
      auth: '/api/v1/auth',
      
      // Rotas do sistema de clientes
      clients: '/api/v1/clients',
      inspectionRequests: '/api/v1/inspection-requests',
      
      // Rotas do fluxo de aprovação
      approvalWorkflow: '/api/v1/approval-workflow',

      // Rotas administrativas (sem tenant)
      tenants: '/api/v1/tenants',

      // Rotas por tenant
      companies: '/api/v1/tenants/{tenant}/companies',
      users: '/api/v1/tenants/{tenant}/users',
      properties: '/api/v1/tenants/{tenant}/properties',
      inspections: '/api/v1/tenants/{tenant}/inspections',

      uploads: '/api/v1/tenants/{tenant}/uploads',
      reports: '/api/v1/tenants/{tenant}/reports',
      notifications: '/api/v1/tenants/{tenant}/notifications',
      settings: '/api/v1/tenants/{tenant}/settings'
    },
    documentation: '/api/docs'
  });
});

// ============================================================================
// ROTAS PÚBLICAS (sem autenticação)
// ============================================================================

// Health check
router.use('/health', healthRoutes);

// Autenticação (login, registro, etc.)
router.use('/auth', authRoutes);

// Sistema de clientes (rotas públicas e autenticadas)
router.use('/clients', clientRoutes);
router.use('/inspection-requests', inspectionRequestRoutes);

// ============================================================================
// ROTAS ADMINISTRATIVAS (com autenticação, sem tenant)
// ============================================================================

// Gestão de tenants (apenas para admins globais)
router.use('/tenants', authSupabase, tenantRoutes);
router.use('/admin/clients', authSupabase, adminClientsRoutes);

// Fluxo de aprovação de vistorias
router.use('/approval-workflow', authSupabase, approvalWorkflowRoutes);

// Rota global para listar usuários (para admins)
router.use('/users', authSupabase, userRoutes);

// ============================================================================
// ROTAS POR TENANT (com autenticação + tenant)
// ============================================================================

// Middleware para todas as rotas de tenant
router.use(
  '/tenants/:tenant/*',
  authSupabase,
  resolveTenant,
  requireTenantAccess,
  (req, res, next) => {
    console.log('Processing tenant route', {
      path: req.path,
      method: req.method,
      tenant: req.params.tenant
    });
    next();
  }
);

// Rotas específicas por tenant
router.use('/tenants/:tenant/companies', companyRoutes);
router.use('/tenants/:tenant/users', userRoutes);
router.use('/tenants/:tenant/properties', propertyRoutes);
router.use('/tenants/:tenant/inspections', inspectionRoutes);

router.use('/tenants/:tenant/uploads', uploadRoutes);
router.use('/tenants/:tenant/reports', reportRoutes);
router.use('/tenants/:tenant/notifications', notificationRoutes);
router.use('/tenants/:tenant/settings', settingsRoutes);

// ============================================================================
// ROTAS LEGACY (manter compatibilidade temporária)
// ============================================================================

// Redirecionar rotas antigas para novas (com warning)
const legacyRedirect = newPath => (req, res) => {
  const tenant = req.headers['x-tenant'] || req.query.tenant;
  if (!tenant) {
    return res.status(400).json({
      success: false,
      error:
        'Esta rota foi movida. Use /api/v1/tenants/{tenant}' +
        newPath +
        ' ou adicione header X-Tenant',
      code: 'LEGACY_ROUTE_DEPRECATED'
    });
  }

  const newUrl = `/api/v1/tenants/${tenant}${newPath}`;
  res.status(301).json({
    success: false,
    error: 'Rota movida permanentemente',
    code: 'MOVED_PERMANENTLY',
    newUrl,
    message: `Use ${newUrl} em vez desta rota`
  });
};

// Rotas legacy com redirecionamento
// IMPORTANTE: Comentado para evitar conflito com rotas de tenant
// As rotas de tenant já estão configuradas corretamente acima
// router.use('/companies', legacyRedirect('/companies'));
// router.use('/users', legacyRedirect('/users')); // Comentado para permitir rota global /users
// router.use('/properties', legacyRedirect('/properties'));
// router.use('/inspections', legacyRedirect('/inspections'));

// router.use('/uploads', legacyRedirect('/uploads'));
// router.use('/reports', legacyRedirect('/reports'));

// Nota: Se necessário reativar rotas legacy, mover para depois das rotas de tenant
// ou implementar lógica mais específica para evitar conflitos

module.exports = router;
