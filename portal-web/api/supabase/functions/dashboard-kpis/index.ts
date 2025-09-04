import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, createSuccessResponse, createErrorResponse } from '../_shared/cors.ts';
import { withAuth } from '../_shared/auth.ts';
import { Logger } from '../_shared/logger.ts';
import { applyEmpresaFilter } from '../_shared/database.ts';

const logger = new Logger('dashboard-kpis');

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow GET method
    if (req.method !== 'GET') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Authenticate and authorize
    return await withAuth(req, async (req, supabase, user) => {
    logger.info('Fetching dashboard KPIs', { userId: user.id, userRole: user.role });

    // Parse query parameters
    const url = new URL(req.url);
    const empresaParam = url.searchParams.get('empresa');

    // Validate empresa parameter for non-superadmin users
    let targetEmpresaId = empresaParam;
    if (user.role !== 'superadmin') {
      if (empresaParam && empresaParam !== user.empresa_id) {
        logger.warn('User trying to access different empresa', { 
          userId: user.id, 
          userEmpresa: user.empresa_id, 
          requestedEmpresa: empresaParam 
        });
        return createErrorResponse('Access denied to requested empresa', 403);
      }
      targetEmpresaId = user.empresa_id;
    }

    if (!targetEmpresaId) {
      return createErrorResponse('Empresa parameter is required', 400);
    }

    // Verify empresa exists and user has access
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .select('id, nome, ativa')
      .eq('id', targetEmpresaId)
      .single();

    if (empresaError) {
      logger.error('Error fetching empresa', empresaError, { empresaId: targetEmpresaId });
      return createErrorResponse('Empresa not found', 404);
    }

    if (!empresa.ativa) {
      logger.warn('Empresa is inactive', { empresaId: targetEmpresaId });
      return createErrorResponse('Empresa is inactive', 400);
    }

    // Fetch KPIs in parallel
    const [vistoriasResult, imoveisResult, usuariosResult] = await Promise.all([
      // Vistorias by status
      supabase
        .from('vistorias')
        .select('status')
        .eq('empresa_id', targetEmpresaId),
      
      // Total imoveis
      supabase
        .from('imoveis')
        .select('id', { count: 'exact' })
        .eq('empresa_id', targetEmpresaId),
      
      // Active usuarios
      supabase
        .from('usuarios')
        .select('id', { count: 'exact' })
        .eq('empresa_id', targetEmpresaId)
    ]);

    if (vistoriasResult.error) {
      logger.error('Error fetching vistorias', vistoriasResult.error);
      return createErrorResponse('Error fetching vistorias data', 500);
    }

    if (imoveisResult.error) {
      logger.error('Error fetching imoveis', imoveisResult.error);
      return createErrorResponse('Error fetching imoveis data', 500);
    }

    if (usuariosResult.error) {
      logger.error('Error fetching usuarios', usuariosResult.error);
      return createErrorResponse('Error fetching usuarios data', 500);
    }

    // Count vistorias by status
    const vistoriasByStatus = vistoriasResult.data.reduce((acc: any, vistoria: any) => {
      acc[vistoria.status] = (acc[vistoria.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Fetch recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentVistorias, error: recentError } = await supabase
      .from('vistorias')
      .select('created_at')
      .eq('empresa_id', targetEmpresaId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (recentError) {
      logger.error('Error fetching recent vistorias', recentError);
      return createErrorResponse('Error fetching recent activity', 500);
    }

    // Calculate growth metrics
    const totalVistorias = vistoriasResult.data.length;
    const recentVistoriasCount = recentVistorias.length;
    const avgVistoriasPerDay = recentVistoriasCount / 30;

    // Fetch contestacoes count
    const { data: contestacoes, error: contestacoesError } = await supabase
      .from('contestacoes')
      .select('id', { count: 'exact' })
      .eq('empresa_id', targetEmpresaId);

    if (contestacoesError) {
      logger.error('Error fetching contestacoes', contestacoesError);
      return createErrorResponse('Error fetching contestacoes data', 500);
    }

    const kpis = {
      empresa: {
        id: empresa.id,
        nome: empresa.nome
      },
      vistorias: {
        total: totalVistorias,
        rascunho: vistoriasByStatus.rascunho || 0,
        enviada: vistoriasByStatus.enviada || 0,
        finalizada: vistoriasByStatus.finalizada || 0,
        recent_30_days: recentVistoriasCount,
        avg_per_day: Math.round(avgVistoriasPerDay * 100) / 100
      },
      imoveis: {
        total: imoveisResult.count || 0
      },
      usuarios: {
        total: usuariosResult.count || 0
      },
      contestacoes: {
        total: contestacoes?.length || 0
      },
      generated_at: new Date().toISOString()
    };

    logger.info('Dashboard KPIs generated successfully', { 
      empresaId: targetEmpresaId,
      totalVistorias,
      totalImoveis: imoveisResult.count,
      totalUsuarios: usuariosResult.count
    });

    return createSuccessResponse(kpis);
    }, ['superadmin', 'admin']);

  } catch (error) {
    logger.error('Unexpected error in dashboard-kpis', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('Internal server error', 500);
  }
});