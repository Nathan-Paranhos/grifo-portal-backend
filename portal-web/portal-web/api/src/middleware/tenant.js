const { supabase } = require('../config/supabase.js');
// const { logger } = require('../config/logger.js'); // Temporarily disabled to avoid circular dependency
const {
  ValidationError,
  NotFoundError,
  asyncHandler
} = require('./errorHandler.js');

/**
 * Cache em memória para tenants (evita consultas repetidas)
 */
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Middleware para resolver tenant baseado no slug
 * Suporta tenant via:
 * - Path parameter: /v1/tenants/:tenant/...
 * - Query parameter: ?tenant=slug
 * - Header: X-Tenant: slug
 */
const resolveTenant = asyncHandler(async (req, res, next) => {
  // Extrair tenant slug de diferentes fontes
  const tenantSlug =
    req.params.tenant || req.headers['x-tenant'] || req.query.tenant;

  if (!tenantSlug) {
    throw new ValidationError(
      'Tenant não especificado. Use path parameter, query string ou header X-Tenant.'
    );
  }

  // Verificar cache primeiro
  const cacheKey = `tenant:${tenantSlug}`;
  const cached = tenantCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    req.company = cached.data;
    console.log('Tenant resolvido do cache', {
      tenant: tenantSlug,
      companyId: cached.data.id
    });
    return next();
  }

  try {
    // Buscar empresa pelo slug (usando nome normalizado)
    // Primeiro, tentar buscar por ID se o slug for numérico
    let company, error;
    
    if (/^\d+$/.test(tenantSlug)) {
      // Se o slug for numérico, buscar por ID
      const result = await supabase
        .from('empresas')
        .select('id, nome, cnpj, email')
        .eq('id', parseInt(tenantSlug))
        .single();
      company = result.data;
      error = result.error;
    } else {
      // Buscar por nome normalizado (slug)
      const { data: companies, error: searchError } = await supabase
        .from('empresas')
        .select('id, nome, cnpj, email');
      
      if (!searchError && companies) {
        // Encontrar empresa cujo nome normalizado corresponde ao slug
        company = companies.find(c => {
          const normalizedName = c.nome
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
          return normalizedName === tenantSlug;
        });
        
        if (!company) {
          error = { message: 'Empresa não encontrada' };
        }
      } else {
        error = searchError;
      }
    }

    if (error || !company) {
      console.log('Tenant não encontrado ou inativo', {
        tenant: tenantSlug,
        error: error?.message
      });
      throw new NotFoundError(
        `Empresa '${tenantSlug}' não encontrada ou inativa`
      );
    }

    // Adicionar ao cache
    tenantCache.set(cacheKey, {
      data: company,
      timestamp: Date.now()
    });

    // Normalizar dados da empresa para compatibilidade
    const normalizedCompany = {
      id: company.id,
      name: company.nome,
      slug: tenantSlug,
      is_active: true, // Assumir ativo se encontrado
      cnpj: company.cnpj,
      email: company.email
    };
    
    // Adicionar company ao request
    req.company = normalizedCompany;

    console.log('Tenant resolvido com sucesso', {
      tenant: tenantSlug,
      companyId: company.id,
      companyName: company.name
    });

    next();
  } catch (error) {
    console.error('Erro ao resolver tenant', {
      tenant: tenantSlug,
      error: error.message
    });

    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }

    throw new ValidationError('Erro interno ao resolver tenant');
  }
});

/**
 * Middleware para verificar se o usuário tem acesso ao tenant
 * Deve ser usado após authSupabase e resolveTenant
 */
const requireTenantAccess = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new ValidationError('Usuário não autenticado');
  }

  if (!req.company) {
    throw new ValidationError('Tenant não resolvido');
  }

  // Service role tem acesso a todos os tenants
  if (req.user.isServiceRole) {
    return next();
  }

  // Usuários anônimos não têm acesso a tenants específicos
  if (req.user.isAnonymous) {
    throw new ValidationError(
      'Usuários anônimos não podem acessar dados de empresas'
    );
  }

  try {
    // Verificar se o usuário é membro da empresa
    // Primeiro tentar portal_users, depois app_users
    let membership = null;
    let error = null;
    
    // Tentar portal_users
    const { data: portalUser, error: portalError } = await supabase
      .from('portal_users')
      .select('role, ativo')
      .eq('empresa_id', req.company.id)
      .eq('auth_user_id', req.user.id)
      .eq('ativo', true)
      .single();
    
    if (!portalError && portalUser) {
      membership = { role: portalUser.role };
    } else {
      // Tentar app_users
      const { data: appUser, error: appError } = await supabase
        .from('app_users')
        .select('role, ativo')
        .eq('empresa_id', req.company.id)
        .eq('auth_user_id', req.user.id)
        .eq('ativo', true)
        .single();
      
      if (!appError && appUser) {
        membership = { role: appUser.role };
      } else {
        error = appError || portalError;
      }
    }

    if (error || !membership) {
      console.log('Usuário sem acesso ao tenant', {
        userId: req.user.id,
        companyId: req.company.id,
        tenant: req.company.slug,
        portalError: portalError?.message,
        appError: error?.message
      });
      throw new ValidationError(
        `Acesso negado à empresa '${req.company.slug}'`
      );
    }

    // Adicionar role do usuário na empresa ao request
    req.userRole = membership.role;

    console.log('Acesso ao tenant autorizado', {
      userId: req.user.id,
      companyId: req.company.id,
      role: membership.role
    });

    next();
  } catch (error) {
    console.error('Erro ao verificar acesso ao tenant', {
      userId: req.user.id,
      companyId: req.company.id,
      error: error.message
    });

    if (error instanceof ValidationError) {
      throw error;
    }

    throw new ValidationError('Erro interno ao verificar acesso');
  }
});

/**
 * Middleware para verificar roles específicos no contexto do tenant
 */
const requireTenantRole = allowedRoles => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return asyncHandler(async (req, res, next) => {
    if (!req.userRole) {
      throw new ValidationError('Role do usuário não definida');
    }

    // Service role bypassa verificação de roles
    if (req.user?.isServiceRole) {
      return next();
    }

    if (!roles.includes(req.userRole)) {
      console.log('Acesso negado por role insuficiente', {
        userId: req.user.id,
        companyId: req.company.id,
        userRole: req.userRole,
        requiredRoles: roles
      });
      throw new ValidationError(
        `Acesso negado. Roles necessárias: ${roles.join(', ')}`
      );
    }

    next();
  });
};

/**
 * Limpar cache de tenants (útil para testes ou atualizações)
 */
const clearTenantCache = (tenantSlug = null) => {
  if (tenantSlug) {
    tenantCache.delete(`tenant:${tenantSlug}`);
    console.log('Cache do tenant limpo', { tenant: tenantSlug });
  } else {
    tenantCache.clear();
    console.log('Cache de todos os tenants limpo');
  }
};

/**
 * Middleware para adicionar filtro automático por company_id nas queries
 * Deve ser usado em repositories/services
 */
const addCompanyFilter = (query, req) => {
  if (!req.company?.id) {
    throw new ValidationError('Company ID não disponível para filtro');
  }

  return query.eq('company_id', req.company.id);
};

module.exports = {
  resolveTenant,
  requireTenantAccess,
  requireTenantRole,
  clearTenantCache,
  addCompanyFilter
};
