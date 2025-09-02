const { supabase } = require('../config/supabase');
// const { logger } = require('../config/logger'); // Temporarily disabled to avoid circular dependency
const {
  AuthenticationError,
  AuthorizationError,
  asyncHandler
} = require('./errorHandler.js');
const { validateAdmin, requirePermission: adminRequirePermission, requireSuperAdmin } = require('./adminValidation.js');
const { logResourceAccess } = require('../utils/auditLogger.js');

/**
 * Middleware de autenticação Supabase
 */
const authSupabase = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers.apikey;

  if (!authHeader && !apiKey) {
    throw new AuthenticationError('Token de autorização não fornecido');
  }

  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (apiKey) {
    token = apiKey;
  }

  if (!token) {
    throw new AuthenticationError('Formato de token inválido');
  }

  // Verificar se é ANON_KEY
  if (token === process.env.SUPABASE_ANON_KEY) {
    req.user = {
      id: 'anonymous',
      type: 'anonymous',
      isAnonymous: true
    };
    return next();
  }

  // Verificar se é SERVICE_ROLE_KEY
  if (token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    req.user = {
      id: 'service_role',
      type: 'service_role',
      isServiceRole: true
    };
    return next();
  }

  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log('Token inválido ou expirado', {
        error: error?.message,
        token: token.substring(0, 10) + '...'
      });
      throw new AuthenticationError('Token inválido ou expirado');
    }

    const claims = user.app_metadata || {};

    req.user = {
      id: user.id,
      email: user.email,
      supabase_user: user,
      user_type: claims.user_type || 'unknown',
      user_id: claims.user_id,
      empresa_id: claims.empresa_id,
      empresa_slug: claims.empresa_slug,
      role: claims.role,
      nome: claims.nome,
      permissions: claims.permissions || [],
      isAnonymous: false
    };

    console.log('User authenticated successfully', {
      userId: user.id,
      email: user.email
    });
    next();
  } catch (error) {
    console.error('Authentication failed', {
      error: error.message,
      token: token.substring(0, 10) + '...'
    });
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Falha na autenticação');
  }
});

// Middleware de tenant movido para ./tenant.js
// Use: const { resolveTenant, requireTenantAccess } = require('./tenant.js');

/**
 * Middleware para verificar roles
 */
const requireRole = roles => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      console.log('Tentativa de acesso sem autenticação', {
        path: req.path,
        method: req.method
      });
      throw new AuthenticationError('Usuário não autenticado');
    }

    if (req.user.isServiceRole) {
      return next();
    }

    if (req.user.isAnonymous) {
      throw new AuthorizationError('Acesso negado para usuários anônimos');
    }

    const userRole = req.user.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      console.log('Tentativa de acesso com role insuficiente', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method
      });
      throw new AuthorizationError(
        `Acesso negado. Role necessária: ${allowedRoles.join(' ou ')}`
      );
    }

    next();
  });
};

/**
 * Middleware para verificar permissões
 */
const requirePermission = permissions => {
  const requiredPermissions = Array.isArray(permissions)
    ? permissions
    : [permissions];

  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      console.log('Tentativa de acesso sem autenticação', {
        path: req.path,
        method: req.method
      });
      throw new AuthenticationError('Usuário não autenticado');
    }

    if (req.user.isServiceRole) {
      return next();
    }

    if (req.user.isAnonymous) {
      throw new AuthorizationError('Acesso negado para usuários anônimos');
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.some(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      console.log('Tentativa de acesso com permissões insuficientes', {
        userId: req.user.id,
        userPermissions,
        requiredPermissions,
        path: req.path,
        method: req.method
      });
      throw new AuthorizationError(
        `Permissão necessária: ${requiredPermissions.join(' ou ')}`
      );
    }

    next();
  });
};

/**
 * Middleware de autenticação opcional
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers.apikey;

  if (!authHeader && !apiKey) {
    req.user = null;
    return next();
  }

  try {
    await authSupabase(req, res, next);
  } catch (error) {
    console.log('Autenticação opcional falhou', { error: error.message });
    req.user = null;
    next();
  }
});

/**
 * Middleware para validação de usuários administrativos
 * Combina autenticação padrão com validações administrativas específicas
 */
const requireAdmin = asyncHandler(async (req, res, next) => {
  // Primeiro, garantir que o usuário está autenticado
  if (!req.user) {
    throw new AuthenticationError('Usuário não autenticado');
  }

  // Usar o middleware de validação administrativa
  await validateAdmin(req, res, next);
});

/**
 * Middleware para validação de super administradores
 */
const requireSuperAdminAccess = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new AuthenticationError('Usuário não autenticado');
  }

  await requireSuperAdmin(req, res, next);
});

/**
 * Middleware para validação de permissões administrativas específicas
 */
const requireAdminPermission = (permission) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('Usuário não autenticado');
    }

    await adminRequirePermission(permission)(req, res, next);
  });
};

/**
 * Middleware para log de acesso a recursos protegidos
 */
const logProtectedAccess = (resourceType, resourceId = null) => {
  return asyncHandler(async (req, res, next) => {
    if (req.user && !req.user.isAnonymous) {
      try {
        await logResourceAccess(
          req.user.email || req.user.id,
          req.user.id,
          resourceType,
          resourceId || req.params.id || 'unknown',
          req.ip,
          req.get('User-Agent')
        );
      } catch (error) {
        console.log('Failed to log resource access', {
          userId: req.user.id,
          resourceType,
          error: error.message
        });
      }
    }
    next();
  });
};

/**
 * Middleware combinado para rotas administrativas críticas
 * Inclui autenticação, validação administrativa e log de auditoria
 */
const requireCriticalAdminAccess = (resourceType = 'critical_admin_resource') => {
  return [
    authMiddleware,
    requireAdmin,
    logProtectedAccess(resourceType)
  ];
};

/**
 * Alias para compatibilidade
 */
const authMiddleware = authSupabase;

module.exports = {
  authSupabase,
  authMiddleware,
  requireRole,
  requirePermission,
  optionalAuth,
  requireAdmin,
  requireSuperAdminAccess,
  requireAdminPermission,
  logProtectedAccess,
  requireCriticalAdminAccess
};
