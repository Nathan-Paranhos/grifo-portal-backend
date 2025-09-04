import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, createSuccessResponse, createErrorResponse } from '../_shared/cors.ts';
import { withAuth } from '../_shared/auth.ts';
import { createTenantSchema } from '../_shared/validation.ts';
import { Logger } from '../_shared/logger.ts';

const logger = new Logger('create-tenant');

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return createErrorResponse('Method not allowed', 405);
    }

    return await withAuth(req, async (req, supabase, user) => {
      logger.info('Creating tenant', { userId: user.id, userRole: user.role });

    // Parse and validate request body
    const body = await req.json();
    const validation = createTenantSchema.safeParse(body);
    
    if (!validation.success) {
      logger.warn('Invalid request body', { errors: validation.error.errors });
      return createErrorResponse('Invalid request data', 400);
    }

    const { nome, cnpj } = validation.data;



    // Check if CNPJ already exists
    const { data: existingEmpresa, error: checkError } = await supabase
      .from('empresas')
      .select('id')
      .eq('cnpj', cnpj)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      logger.error('Error checking existing empresa', checkError);
      return createErrorResponse('Database error', 500);
    }

    if (existingEmpresa) {
      logger.warn('CNPJ already exists', { cnpj });
      return createErrorResponse('CNPJ already exists', 409);
    }

    // Create new empresa
    const { data: empresa, error: createError } = await supabase
      .from('empresas')
      .insert({
        nome,
        cnpj,
        ativa: true,
        storage_mb: 1000
      })
      .select()
      .single();

    if (createError) {
      logger.error('Error creating empresa', createError);
      return createErrorResponse('Failed to create tenant', 500);
    }

    logger.info('Tenant created successfully', { 
      empresaId: empresa.id, 
      nome, 
      cnpj 
    });

    return createSuccessResponse({
      id: empresa.id,
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      ativa: empresa.ativa,
      storage_mb: empresa.storage_mb,
      created_at: empresa.created_at
    });
    }, ['superadmin']);

  } catch (error) {
    logger.error('Unexpected error in create-tenant', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('Internal server error', 500);
  }
});