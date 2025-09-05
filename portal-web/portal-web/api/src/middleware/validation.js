const { z } = require('zod');
const { ValidationError } = require('./errorHandler.js');
// const { logger } = require('../config/logger.js'); // Temporarily disabled to avoid circular dependency

/**
 * Simple validation middleware for body only
 * @param {z.ZodSchema} schema - Zod schema for validation
 * @returns {Function} Express middleware
 */
function validation(schema) {
  return async (req, res, next) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = formatZodErrors(error);
        console.log('Validation failed', {
          errors: validationErrors,
          path: req.path
        });
        throw new ValidationError('Dados inválidos', validationErrors);
      }
      throw error;
    }
  };
}

/**
 * Format Zod errors into a more readable format
 * @param {z.ZodError} error - Zod validation error
 * @returns {Object} Formatted errors
 */
function formatZodErrors(error) {
  const errors = {};

  error.issues.forEach(issue => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  });

  return errors;
}

/**
 * Validation middleware factory
 * Creates middleware to validate request data using Zod schemas
 * @param {Object} schemas - Object containing validation schemas
 * @param {z.ZodSchema} schemas.body - Schema for request body
 * @param {z.ZodSchema} schemas.query - Schema for query parameters
 * @param {z.ZodSchema} schemas.params - Schema for route parameters
 * @returns {Function} Express middleware function
 */
function validateRequest(schemas = {}) {
  return async (req, res, next) => {
    try {
      const validationErrors = {};

      // Validate request body
      if (schemas.body) {
        try {
          req.body = await schemas.body.parseAsync(req.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.body = formatZodErrors(error);
          } else {
            validationErrors.body = {
              _general: 'Erro de validação do corpo da requisição'
            };
          }
        }
      }

      // Validate query parameters
      if (schemas.query) {
        try {
          req.query = await schemas.query.parseAsync(req.query);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.query = formatZodErrors(error);
          } else {
            validationErrors.query = {
              _general: 'Erro de validação dos parâmetros de consulta'
            };
          }
        }
      }

      // Validate route parameters
      if (schemas.params) {
        try {
          req.params = await schemas.params.parseAsync(req.params);
        } catch (error) {
          if (error instanceof z.ZodError) {
            validationErrors.params = formatZodErrors(error);
          } else {
            validationErrors.params = {
              _general: 'Erro de validação dos parâmetros da rota'
            };
          }
        }
      }

      // If there are validation errors, throw ValidationError
      if (Object.keys(validationErrors).length > 0) {
        console.log('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: validationErrors,
          userId: req.user?.id
        });

        throw new ValidationError(
          'Dados de entrada inválidos',
          validationErrors
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Função formatZodErrors já definida acima

/**
 * Common validation schemas
 */
const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid('ID deve ser um UUID válido'),

  // Email validation
  email: z.string().email('Email deve ter um formato válido'),

  // Password validation
  password: z
    .string()
    .min(6, 'Senha deve ter pelo menos 6 caracteres')
    .max(100, 'Senha deve ter no máximo 100 caracteres'),

  // Phone validation (Brazilian format)
  phone: z
    .string()
    .regex(
      /^\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}$/,
      'Telefone deve ter formato válido'
    ),

  // CNPJ validation (basic format)
  cnpj: z
    .string()
    .regex(
      /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
      'CNPJ deve ter formato válido (XX.XXX.XXX/XXXX-XX)'
    ),

  // CPF validation (basic format)
  cpf: z
    .string()
    .regex(
      /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
      'CPF deve ter formato válido (XXX.XXX.XXX-XX)'
    ),

  // CEP validation (Brazilian postal code)
  cep: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP deve ter formato válido (XXXXX-XXX)'),

  // Date validation
  date: z.string().datetime('Data deve estar no formato ISO 8601'),

  // Pagination
  pagination: z.object({
    page: z.coerce
      .number()
      .int()
      .min(1, 'Página deve ser um número inteiro maior que 0')
      .default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, 'Limite deve ser um número inteiro maior que 0')
      .max(100, 'Limite máximo é 100')
      .default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc')
  }),

  // Search
  search: z.object({
    q: z.string().min(1, 'Termo de busca é obrigatório').optional(),
    fields: z.string().optional()
  }),

  // Address
  address: z.object({
    street: z.string().min(1, 'Rua é obrigatória'),
    number: z.string().min(1, 'Número é obrigatório'),
    complement: z.string().optional(),
    neighborhood: z.string().min(1, 'Bairro é obrigatório'),
    city: z.string().min(1, 'Cidade é obrigatória'),
    state: z.string().length(2, 'Estado deve ter 2 caracteres'),
    zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP deve ter formato válido')
  }),

  // Contact info
  contact: z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    email: z.string().email('Email deve ter formato válido').optional(),
    phone: z
      .string()
      .regex(
        /^\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}$/,
        'Telefone deve ter formato válido'
      )
      .optional()
  }),

  // Sort order
  sortOrder: z.enum(['asc', 'desc']),

  // Period for stats
  period: z.enum(['7d', '30d', '90d', '1y'])
};

/**
 * Auth validation schemas
 */
const authSchemas = {
  login: {
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(1, 'Senha é obrigatória')
    })
  },

  register: {
    body: z.object({
      email: commonSchemas.email,
      password: commonSchemas.password,
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      role: z
        .enum(['admin', 'manager', 'inspector', 'viewer'])
        .default('viewer'),
      company_id: commonSchemas.uuid.optional()
    })
  },

  forgotPassword: {
    body: z.object({
      email: commonSchemas.email
    })
  },

  resetPassword: {
    body: z.object({
      token: z.string().min(1, 'Token é obrigatório'),
      password: commonSchemas.password
    })
  },

  changePassword: {
    body: z.object({
      currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
      newPassword: commonSchemas.password
    })
  }
};

/**
 * User validation schemas
 */
const userSchemas = {
  // Individual schema properties for query validation
  role: z.enum(['admin', 'manager', 'inspector', 'viewer']),
  status: z.enum(['active', 'inactive', 'suspended']),
  sortBy: z.enum(['created_at', 'name', 'role', 'last_login']),

  create: {
    body: z.object({
      email: commonSchemas.email,
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      role: z.enum(['admin', 'manager', 'inspector', 'viewer']),
      permissions: z.record(z.boolean()).optional(),
      is_active: z.boolean().default(true)
    })
  },

  update: {
    params: z.object({
      id: commonSchemas.uuid
    }),
    body: z.object({
      name: z
        .string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .optional(),
      role: z.enum(['admin', 'manager', 'inspector', 'viewer']).optional(),
      permissions: z.record(z.boolean()).optional(),
      is_active: z.boolean().optional()
    })
  },

  getById: {
    params: z.object({
      id: commonSchemas.uuid
    })
  },

  list: {
    query: commonSchemas.pagination.extend({
      role: z.enum(['admin', 'manager', 'inspector', 'viewer']).optional(),
      is_active: z.coerce.boolean().optional(),
      search: z.string().optional()
    })
  }
};

/**
 * Company validation schemas
 */
const companySchemas = {
  // Individual schema properties for query validation
  status: z.enum(['active', 'inactive', 'suspended']),
  plan: z.enum(['basic', 'professional', 'enterprise']),
  sortBy: z.enum(['created_at', 'name', 'plan']),

  create: {
    body: z.object({
      name: z
        .string()
        .min(2, 'Nome da empresa deve ter pelo menos 2 caracteres'),
      cnpj: commonSchemas.cnpj.optional(),
      address: commonSchemas.address.optional(),
      contact: commonSchemas.contact.optional(),
      settings: z.record(z.any()).optional()
    })
  },

  update: {
    params: z.object({
      id: commonSchemas.uuid
    }),
    body: z.object({
      name: z
        .string()
        .min(2, 'Nome da empresa deve ter pelo menos 2 caracteres')
        .optional(),
      cnpj: commonSchemas.cnpj.optional(),
      address: commonSchemas.address.optional(),
      contact: commonSchemas.contact.optional(),
      settings: z.record(z.any()).optional()
    })
  },

  getById: {
    params: z.object({
      id: commonSchemas.uuid
    })
  }
};

/**
 * Property validation schemas
 */
const propertySchemas = {
  // Individual schema properties for query validation
  status: z.enum(['active', 'inactive', 'rented', 'sold']),
  sortBy: z.enum(['created_at', 'endereco', 'cidade', 'area', 'status']),

  create: {
    body: z.object({
      address: commonSchemas.address,
      owner: commonSchemas.contact,
      type: z.string().min(1, 'Tipo do imóvel é obrigatório'),
      subtype: z.string().optional(),
      area: z.number().positive('Área deve ser um número positivo').optional(),
      rooms: z
        .number()
        .int()
        .min(0, 'Número de quartos deve ser maior ou igual a 0')
        .optional(),
      bathrooms: z
        .number()
        .int()
        .min(0, 'Número de banheiros deve ser maior ou igual a 0')
        .optional(),
      parking: z
        .number()
        .int()
        .min(0, 'Número de vagas deve ser maior ou igual a 0')
        .optional(),
      value: z
        .number()
        .positive('Valor deve ser um número positivo')
        .optional(),
      status: z.string().default('active'),
      description: z.string().optional(),
      features: z.record(z.any()).optional()
    })
  },

  update: {
    params: z.object({
      id: commonSchemas.uuid
    }),
    body: z.object({
      address: commonSchemas.address.optional(),
      owner: commonSchemas.contact.optional(),
      type: z.string().min(1, 'Tipo do imóvel é obrigatório').optional(),
      subtype: z.string().optional(),
      area: z.number().positive('Área deve ser um número positivo').optional(),
      rooms: z
        .number()
        .int()
        .min(0, 'Número de quartos deve ser maior ou igual a 0')
        .optional(),
      bathrooms: z
        .number()
        .int()
        .min(0, 'Número de banheiros deve ser maior ou igual a 0')
        .optional(),
      parking: z
        .number()
        .int()
        .min(0, 'Número de vagas deve ser maior ou igual a 0')
        .optional(),
      value: z
        .number()
        .positive('Valor deve ser um número positivo')
        .optional(),
      status: z.string().optional(),
      description: z.string().optional(),
      features: z.record(z.any()).optional()
    })
  },

  getById: {
    params: z.object({
      id: commonSchemas.uuid
    })
  },

  list: {
    query: commonSchemas.pagination.extend({
      type: z.string().optional(),
      status: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      search: z.string().optional()
    })
  }
};

/**
 * Inspection validation schemas
 */
const inspectionSchemas = {
  // Individual schema properties for query validation
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  sortBy: z.enum(['created_at', 'scheduled_date', 'completed_date', 'status']),

  create: {
    body: z.object({
      property_id: commonSchemas.uuid,
      inspector_id: commonSchemas.uuid.optional(),
      type: z.string().min(1, 'Tipo da vistoria é obrigatório'),
      scheduled_date: commonSchemas.date,
      priority: z.enum(['low', 'medium', 'high']).default('medium'),
      observations: z.string().optional()
    })
  },

  update: {
    params: z.object({
      id: commonSchemas.uuid
    }),
    body: z.object({
      inspector_id: commonSchemas.uuid.optional(),
      type: z.string().min(1, 'Tipo da vistoria é obrigatório').optional(),
      status: z.string().optional(),
      scheduled_date: commonSchemas.date.optional(),
      completed_date: commonSchemas.date.optional(),
      report: z.record(z.any()).optional(),
      photos: z.array(z.string().url()).optional(),
      observations: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional()
    })
  },

  getById: {
    params: z.object({
      id: commonSchemas.uuid
    })
  },

  list: {
    query: commonSchemas.pagination.extend({
      property_id: commonSchemas.uuid.optional(),
      inspector_id: commonSchemas.uuid.optional(),
      type: z.string().optional(),
      status: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      date_from: commonSchemas.date.optional(),
      date_to: commonSchemas.date.optional()
    })
  }
};

/**
 * Upload validation schemas
 */
const uploadSchemas = {
  single: {
    body: z.object({
      category: z.string().optional(),
      description: z.string().optional()
    })
  },

  multiple: {
    body: z.object({
      category: z.string().optional(),
      descriptions: z.array(z.string()).optional()
    })
  }
};

module.exports = {
  validation,
  validateRequest,
  commonSchemas,
  authSchemas,
  userSchemas,
  companySchemas,
  propertySchemas,
  inspectionSchemas,
  uploadSchemas
};
