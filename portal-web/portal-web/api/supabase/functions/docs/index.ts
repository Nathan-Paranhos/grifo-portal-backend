import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Grifo API Backend",
    version: "1.0.0",
    description: "API completa para Grifo Vistorias - Supabase Integration",
    contact: {
      name: "Grifo Team",
      url: "https://grifovistorias.com"
    }
  },
  servers: [
    {
      url: "https://grifo-api.onrender.com",
      description: "Production server"
    },
    {
      url: "http://localhost:10000",
      description: "Development server"
    }
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health Check",
        description: "Verifica se a API está funcionando",
        responses: {
          "200": {
            description: "API está saudável",
            content: {
              "application/json": {
                example: {
                  status: "healthy",
                  timestamp: "2024-01-01T00:00:00.000Z",
                  uptime: 123.456
                }
              }
            }
          }
        }
      }
    },
    "/api": {
      get: {
        summary: "API Information",
        description: "Retorna informações sobre a API",
        responses: {
          "200": {
            description: "Informações da API",
            content: {
              "application/json": {
                example: {
                  name: "Grifo API Backend",
                  version: "1.0.0",
                  description: "API completa para Grifo Vistorias"
                }
              }
            }
          }
        }
      }
    },
    "/rest/v1/empresas": {
      get: {
        summary: "Listar Empresas",
        description: "Lista todas as empresas com filtros e paginação",
        parameters: [
          {
            name: "select",
            in: "query",
            description: "Campos a serem retornados",
            schema: { type: "string" }
          },
          {
            name: "limit",
            in: "query",
            description: "Limite de registros",
            schema: { type: "integer", default: 20 }
          },
          {
            name: "offset",
            in: "query",
            description: "Offset para paginação",
            schema: { type: "integer", default: 0 }
          }
        ],
        responses: {
          "200": {
            description: "Lista de empresas",
            headers: {
              "Content-Range": {
                description: "Range de registros retornados",
                schema: { type: "string" }
              }
            }
          }
        }
      },
      post: {
        summary: "Criar Empresa",
        description: "Cria uma nova empresa",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nome", "email"],
                properties: {
                  nome: { type: "string" },
                  email: { type: "string", format: "email" },
                  telefone: { type: "string" },
                  endereco: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Empresa criada com sucesso"
          }
        }
      }
    },
    "/rest/v1/rpc/dashboard_kpis": {
      post: {
        summary: "Dashboard KPIs",
        description: "Retorna KPIs do dashboard",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["empresa_id"],
                properties: {
                  empresa_id: { type: "string", format: "uuid" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "KPIs do dashboard"
          }
        }
      }
    },
    "/functions/v1/create_tenant": {
      post: {
        summary: "Criar Tenant",
        description: "Cria um novo tenant (empresa + usuário admin)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["nome", "email", "plano"],
                properties: {
                  nome: { type: "string" },
                  email: { type: "string", format: "email" },
                  plano: { type: "string", enum: ["basico", "premium", "enterprise"] }
                }
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Tenant criado com sucesso"
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      },
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "apikey"
      }
    }
  },
  security: [
    { BearerAuth: [] },
    { ApiKeyAuth: [] }
  ]
};

const swaggerHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grifo API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: window.location.origin + '/functions/v1/docs/spec',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>
`;

serve(async (req: Request) => {
  const url = new URL(req.url);
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (url.pathname.endsWith('/spec')) {
      // Retorna a especificação OpenAPI em JSON
      return new Response(JSON.stringify(swaggerSpec, null, 2), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

    // Retorna a interface Swagger UI
    return new Response(swaggerHTML, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error in docs function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), 
      { 
        status: 500, 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});