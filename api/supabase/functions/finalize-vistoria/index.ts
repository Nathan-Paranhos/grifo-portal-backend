import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createSuccessResponse, createErrorResponse } from '../_shared/cors.ts';
import { withAuth } from '../_shared/auth.ts';
import { validateRequestBody } from '../_shared/validation.ts';
import { Logger } from '../_shared/logger.ts';
import { z } from 'https://deno.land/x/zod@v3.16.1/mod.ts';

const logger = new Logger('finalize-vistoria');

// Validation schema for finalize vistoria request
const finalizeVistoriaSchema = z.object({
  id: z.string().uuid('Invalid vistoria ID format'),
  pdf_url: z.string().url('Invalid PDF URL format')
});

async function processVistoriaFinalization(
  supabase: any,
  user: any,
  vistoriaId: string,
  pdf_url: string
): Promise<Response> {
  // First, fetch the vistoria to verify ownership and current status
  const { data: vistoria, error: fetchError } = await supabase
    .from('vistorias')
    .select(`
      id,
      status,
      empresa_id,
      imovel_id,
      empresas!inner(id, nome)
    `)
    .eq('id', vistoriaId)
    .single();

  if (fetchError) {
    logger.error('Error fetching vistoria', fetchError, { vistoriaId });
    return createErrorResponse('Vistoria not found', 404);
  }

  // Verify user has access to this empresa's vistorias
  if (user.role !== 'superadmin' && vistoria.empresa_id !== user.empresa_id) {
    logger.warn('Unauthorized access attempt', {
      userId: user.id,
      userEmpresaId: user.empresa_id,
      vistoriaEmpresaId: vistoria.empresa_id,
      vistoriaId
    });
    return createErrorResponse('Access denied', 403);
  }

  // Check if vistoria is already finalized
  if (vistoria.status === 'finalizada') {
    logger.info('Vistoria already finalized', { vistoriaId });
    return createSuccessResponse({
      message: 'Vistoria already finalized',
      vistoria: {
        id: vistoria.id,
        status: vistoria.status
      }
    });
  }

  // Check if vistoria can be finalized (must be 'em_andamento')
  if (vistoria.status !== 'em_andamento') {
    logger.warn('Invalid vistoria status for finalization', {
      vistoriaId,
      currentStatus: vistoria.status
    });
    return createErrorResponse(
      `Cannot finalize vistoria with status '${vistoria.status}'. Only vistorias 'em_andamento' can be finalized.`,
      400
    );
  }

  // Update vistoria status to 'finalizada' and set PDF URL
  const { data: updatedVistoria, error: updateError } = await supabase
    .from('vistorias')
    .update({
      status: 'finalizada',
      pdf_url: pdf_url,
      data_finalizacao: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', vistoriaId)
    .select(`
      id,
      status,
      pdf_url,
      data_finalizacao,
      empresas!inner(nome)
    `)
    .single();

  if (updateError) {
    logger.error('Error updating vistoria', updateError, { vistoriaId });
    return createErrorResponse('Failed to finalize vistoria', 500);
  }

  logger.info('Vistoria finalized successfully', {
    vistoriaId,
    userId: user.id,
    empresaId: user.empresa_id,
    pdfUrl: pdf_url
  });

  // Log audit trail
  await supabase
    .from('audit_logs')
    .insert({
      user_id: user.id,
      empresa_id: user.empresa_id,
      action: 'vistoria_finalized',
      resource_type: 'vistoria',
      resource_id: vistoriaId,
      details: {
        pdf_url: pdf_url,
        previous_status: vistoria.status,
        new_status: 'finalizada'
      }
    });

  logger.end({ success: true, vistoriaId });

  return createSuccessResponse({
    message: 'Vistoria finalized successfully',
    vistoria: {
      id: updatedVistoria.id,
      status: updatedVistoria.status,
      pdf_url: updatedVistoria.pdf_url,
      data_finalizacao: updatedVistoria.data_finalizacao,
      empresa_nome: updatedVistoria.empresas.nome
    }
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    logger.start({ method: req.method, url: req.url });

    // Authenticate user and process request
    return await withAuth(req, async (req, supabase, user) => {
      logger.info('Finalizing vistoria', { userId: user.id, userRole: user.role });
      
      // Validate request body
      let vistoriaId: string;
      let pdf_url: string;
      try {
        const validatedData = await validateRequestBody(finalizeVistoriaSchema, req) as { id: string; pdf_url: string };
        vistoriaId = validatedData.id;
        pdf_url = validatedData.pdf_url;
      } catch (error) {
        logger.warn('Invalid request data', { error: error instanceof Error ? error.message : String(error) });
        return createErrorResponse('Invalid request data', 400);
      }
      
      return await processVistoriaFinalization(supabase, user, vistoriaId, pdf_url);
    }, ['superadmin', 'admin', 'corretor']);

  } catch (error) {
    logger.error('Unexpected error in finalize-vistoria', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('Internal server error', 500);
  }
});