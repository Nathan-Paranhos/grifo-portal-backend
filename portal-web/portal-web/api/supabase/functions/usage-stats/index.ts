import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, createSuccessResponse, createErrorResponse } from '../_shared/cors.ts';
import { withAuth } from '../_shared/auth.ts';
import { Logger } from '../_shared/logger.ts';

const logger = new Logger('usage-stats');

serve(async (req: Request) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'GET') {
      return createErrorResponse('Method not allowed', 405);
    }

    return await withAuth(req, async (req, supabase, user) => {
      logger.info('Fetching usage stats', { userId: user.id, userRole: user.role });

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



    // Verify empresa exists and get storage limit
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .select('id, nome, ativa, storage_mb')
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

    // Calculate storage usage from storage bucket
    const { data: storageObjects, error: storageError } = await supabase
      .storage
      .from('vistorias')
      .list(`${targetEmpresaId}/`, {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    let storageUsedMB = 0;
    let totalFiles = 0;
    
    if (storageError) {
      logger.warn('Error fetching storage objects', { error: storageError });
    } else if (storageObjects) {
      // Calculate total storage used
      storageUsedMB = storageObjects.reduce((total: number, obj: any) => {
        return total + (obj.metadata?.size || 0);
      }, 0) / (1024 * 1024); // Convert bytes to MB
      
      totalFiles = storageObjects.length;
    }

    // Get PDFs generated count (vistorias with pdf_url)
    const { data: vistoriasWithPdf, error: pdfError } = await supabase
      .from('vistorias')
      .select('id', { count: 'exact' })
      .eq('empresa_id', targetEmpresaId)
      .not('pdf_url', 'is', null);

    if (pdfError) {
      logger.error('Error fetching PDFs count', pdfError);
      return createErrorResponse('Error fetching PDFs data', 500);
    }

    // Get active users count (users who created vistorias in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activeUsers, error: activeUsersError } = await supabase
      .from('vistorias')
      .select('responsavel_id')
      .eq('empresa_id', targetEmpresaId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (activeUsersError) {
      logger.error('Error fetching active users', activeUsersError);
      return createErrorResponse('Error fetching active users data', 500);
    }

    // Count unique active users
    const uniqueActiveUsers = new Set(activeUsers.map((v: any) => v.responsavel_id)).size;

    // Get total users count
    const { data: totalUsers, error: totalUsersError } = await supabase
      .from('usuarios')
      .select('id', { count: 'exact' })
      .eq('empresa_id', targetEmpresaId);

    if (totalUsersError) {
      logger.error('Error fetching total users', totalUsersError);
      return createErrorResponse('Error fetching users data', 500);
    }

    // Get monthly usage trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: monthlyVistorias, error: monthlyError } = await supabase
      .from('vistorias')
      .select('created_at')
      .eq('empresa_id', targetEmpresaId)
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: true });

    if (monthlyError) {
      logger.error('Error fetching monthly data', monthlyError);
      return createErrorResponse('Error fetching monthly usage data', 500);
    }

    // Group by month
    const monthlyUsage = monthlyVistorias.reduce((acc: any, vistoria: any) => {
      const month = new Date(vistoria.created_at).toISOString().substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array format
    const monthlyTrend = Object.entries(monthlyUsage)
      .map(([month, count]) => ({ month, vistorias: count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const usageStats = {
      empresa: {
        id: empresa.id,
        nome: empresa.nome
      },
      storage: {
        used_mb: Math.round(storageUsedMB * 100) / 100,
        limit_mb: empresa.storage_mb || 1000,
        usage_percentage: Math.round((storageUsedMB / (empresa.storage_mb || 1000)) * 10000) / 100,
        total_files: totalFiles
      },
      pdfs: {
        generated: vistoriasWithPdf?.length || 0
      },
      users: {
        total: totalUsers?.length || 0,
        active_last_30_days: uniqueActiveUsers,
        activity_rate: totalUsers?.length ? Math.round((uniqueActiveUsers / totalUsers.length) * 10000) / 100 : 0
      },
      monthly_trend: monthlyTrend,
      generated_at: new Date().toISOString()
    };

    logger.info('Usage stats generated successfully', { 
      empresaId: targetEmpresaId,
      storageUsedMB: Math.round(storageUsedMB * 100) / 100,
      totalFiles,
      pdfsGenerated: vistoriasWithPdf?.length || 0,
      activeUsers: uniqueActiveUsers
    });

    return createSuccessResponse(usageStats);
    }, ['superadmin', 'admin']);

  } catch (error) {
    logger.error('Unexpected error in usage-stats', error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse('Internal server error', 500);
  }
});