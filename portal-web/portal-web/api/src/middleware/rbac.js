const { AppError } = require('./errorHandler');

/**
 * Role-Based Access Control (RBAC) middleware
 * Provides role and permission checking functionality
 */

/**
 * Check if user has required role
 * @param {Array|string} allowedRoles - Array of allowed roles or single role
 * @returns {Function} Express middleware function
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado', 401);
      }

      const userRole = req.user.role || req.user.user_type;
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      if (!roles.includes(userRole)) {
        throw new AppError('Acesso negado. Permissão insuficiente.', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user has required permission
 * @param {Array|string} requiredPermissions - Array of required permissions or single permission
 * @returns {Function} Express middleware function
 */
const requirePermission = (requiredPermissions) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado', 401);
      }

      const userPermissions = req.user.permissions || [];
      const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

      const hasPermission = permissions.some(permission => 
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        throw new AppError('Acesso negado. Permissão insuficiente.', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user is admin
 * @returns {Function} Express middleware function
 */
const requireAdmin = () => {
  return requireRole(['admin', 'super_admin']);
};

/**
 * Check if user can access resource (owner or admin)
 * @param {string} resourceIdField - Field name containing resource ID
 * @param {string} ownerField - Field name containing owner ID (default: 'user_id')
 * @returns {Function} Express middleware function
 */
const requireOwnerOrAdmin = (resourceIdField = 'id', ownerField = 'user_id') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado', 401);
      }

      const userRole = req.user.role || req.user.user_type;
      const userId = req.user.id;
      const resourceOwnerId = req.resource ? req.resource[ownerField] : null;

      // Admin can access everything
      if (['admin', 'super_admin'].includes(userRole)) {
        return next();
      }

      // Check if user owns the resource
      if (resourceOwnerId && resourceOwnerId === userId) {
        return next();
      }

      throw new AppError('Acesso negado. Você só pode acessar seus próprios recursos.', 403);
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  requireRole,
  requirePermission,
  requireAdmin,
  requireOwnerOrAdmin
};