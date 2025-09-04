/**
 * Configurações de CORS para as Edge Functions
 * Permite requisições do Portal Web (Lovable) e App Mobile (Flutter)
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, referer, user-agent',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

/**
 * Configurações de CORS mais restritivas para produção
 * Substitua pelos domínios reais do seu Portal Web e App
 */
export const corsHeadersProduction = {
  'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
    ? 'https://your-portal-domain.com' 
    : '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, referer, user-agent',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
};

/**
 * Manipula requisições OPTIONS (preflight)
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }
  return null;
}

/**
 * Cria uma resposta com headers CORS
 */
export function createCorsResponse(
  data: any, 
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...additionalHeaders,
      },
    }
  );
}

/**
 * Cria uma resposta de erro com CORS
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  code?: string
): Response {
  return createCorsResponse(
    {
      error: message,
      code: code || 'GENERIC_ERROR',
      timestamp: new Date().toISOString(),
    },
    status
  );
}

/**
 * Cria uma resposta de sucesso com CORS
 */
export function createSuccessResponse(
  data: any,
  message?: string,
  status: number = 200
): Response {
  return createCorsResponse(
    {
      success: true,
      data,
      message: message || 'Operação realizada com sucesso',
      timestamp: new Date().toISOString(),
    },
    status
  );
}