const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Grifo API',
    version: '1.0.0',
    description: `
      API Backend do Sistema Grifo - Plataforma de Gestão de Vistorias Imobiliárias
      
      ## Autenticação
      Esta API utiliza JWT (JSON Web Tokens) para autenticação. Para acessar endpoints protegidos:
      1. Faça login através do endpoint \`/api/auth/login\`
      2. Use o token retornado no header \`Authorization: Bearer <token>\`
      
      ## Isolamento Multiempresa
      Todos os dados são isolados por empresa (\`company_id\`). O usuário só tem acesso aos dados da sua empresa.
      
      ## Rate Limiting
      A API possui rate limiting de 1000 requests por IP a cada 15 minutos.
      
      ## Códigos de Status
      - \`200\`: Sucesso
      - \`201\`: Criado com sucesso
      - \`400\`: Erro de validação
      - \`401\`: Não autorizado
      - \`403\`: Acesso negado
      - \`404\`: Não encontrado
      - \`429\`: Rate limit excedido
      - \`500\`: Erro interno do servidor
    `,
    contact: {
      name: 'Nathan Paranhos'
    }
  },
  servers: [
    {
      url: 'https://grifo-api.onrender.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtido através do endpoint de login'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'string',
            example: 'Mensagem de erro'
          },
          code: {
            type: 'string',
            example: 'ERROR_CODE'
          },
          details: {
            type: 'object',
            description: 'Detalhes adicionais do erro'
          }
        }
      },
      Success: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          message: {
            type: 'string',
            example: 'Operação realizada com sucesso'
          },
          data: {
            type: 'object',
            description: 'Dados retornados'
          }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'usuario@exemplo.com'
          },
          name: {
            type: 'string',
            example: 'João Silva'
          },
          role: {
            type: 'string',
            enum: ['admin', 'manager', 'inspector', 'viewer'],
            example: 'inspector'
          },
          company_id: {
            type: 'string',
            format: 'uuid'
          },
          is_active: {
            type: 'boolean',
            example: true
          },
          created_at: {
            type: 'string',
            format: 'date-time'
          },
          updated_at: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Company: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          name: {
            type: 'string',
            example: 'Empresa de Vistorias LTDA'
          },
          cnpj: {
            type: 'string',
            example: '12.345.678/0001-90'
          },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              number: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              zipCode: { type: 'string' }
            }
          },
          contact: {
            type: 'object',
            properties: {
              phone: { type: 'string' },
              email: { type: 'string' }
            }
          },
          created_at: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Property: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          company_id: {
            type: 'string',
            format: 'uuid'
          },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              number: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              zipCode: { type: 'string' }
            }
          },
          owner: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' }
            }
          },
          type: {
            type: 'string',
            example: 'residential'
          },
          subtype: {
            type: 'string',
            example: 'apartment'
          },
          area: {
            type: 'number',
            example: 85.5
          },
          rooms: {
            type: 'integer',
            example: 3
          },
          bathrooms: {
            type: 'integer',
            example: 2
          },
          parking: {
            type: 'integer',
            example: 1
          },
          value: {
            type: 'number',
            example: 350000.0
          },
          status: {
            type: 'string',
            example: 'active'
          },
          created_at: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Inspection: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          property_id: {
            type: 'string',
            format: 'uuid'
          },
          inspector_id: {
            type: 'string',
            format: 'uuid'
          },
          company_id: {
            type: 'string',
            format: 'uuid'
          },
          type: {
            type: 'string',
            example: 'entrada'
          },
          status: {
            type: 'string',
            example: 'agendada'
          },
          scheduled_date: {
            type: 'string',
            format: 'date-time'
          },
          completed_date: {
            type: 'string',
            format: 'date-time'
          },
          report: {
            type: 'object',
            description: 'Relatório da vistoria'
          },
          photos: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uri'
            }
          },
          observations: {
            type: 'string'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            example: 'medium'
          },
          created_at: {
            type: 'string',
            format: 'date-time'
          }
        }
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Token de acesso ausente ou inválido',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Token de acesso requerido',
              code: 'UNAUTHORIZED'
            }
          }
        }
      },
      ForbiddenError: {
        description: 'Acesso negado - permissões insuficientes',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Acesso negado',
              code: 'FORBIDDEN'
            }
          }
        }
      },
      NotFoundError: {
        description: 'Recurso não encontrado',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Recurso não encontrado',
              code: 'NOT_FOUND'
            }
          }
        }
      },
      ValidationError: {
        description: 'Erro de validação dos dados',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Dados inválidos',
              code: 'VALIDATION_ERROR',
              details: {
                email: 'Email é obrigatório',
                password: 'Senha deve ter pelo menos 6 caracteres'
              }
            }
          }
        }
      },
      RateLimitError: {
        description: 'Rate limit excedido',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            },
            example: {
              success: false,
              error: 'Too many requests from this IP, please try again later.',
              code: 'RATE_LIMIT_EXCEEDED'
            }
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Auth',
      description: 'Endpoints de autenticação e autorização'
    },
    {
      name: 'Health',
      description: 'Endpoints de monitoramento e saúde da API'
    },
    {
      name: 'Dashboard',
      description: 'Endpoints para dados do dashboard'
    },
    {
      name: 'Properties',
      description: 'Gestão de imóveis'
    },
    {
      name: 'Inspections',
      description: 'Gestão de vistorias'
    },
    {
      name: 'Users',
      description: 'Gestão de usuários'
    },
    {
      name: 'Companies',
      description: 'Gestão de empresas'
    },
    {
      name: 'Contestations',
      description: 'Gestão de contestações'
    },
    {
      name: 'Uploads',
      description: 'Upload e gestão de arquivos'
    },
    {
      name: 'Reports',
      description: 'Geração de relatórios'
    },
    {
      name: 'Sync',
      description: 'Sincronização de dados'
    },
    {
      name: 'Notifications',
      description: 'Sistema de notificações'
    }
  ]
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.js', './src/controllers/*.js', './src/models/*.js']
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = { swaggerUi: swaggerUi };;

module.exports = { swaggerSpec, swaggerUi };
