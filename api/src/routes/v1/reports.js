const express = require('express');
const { z } = require('zod');
const { supabase } = require('../../config/supabase');
const { authSupabase, requireRole } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validation');
const { asyncHandler, AppError } = require('../../middleware/errorHandler');

const router = express.Router();

// Validation schemas
const reportFiltersSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  status: z.string().optional(),
  inspector_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional()
});

// Relatório geral de vistorias
router.get('/inspections',
  authSupabase,
  requireRole(['admin', 'manager']),
  validateRequest({ query: reportFiltersSchema }),
  asyncHandler(async (req, res) => {
    const { start_date, end_date, status, inspector_id, client_id } = req.query;
    
    let query = supabase
      .from('inspections')
      .select(`
        *,
        properties:property_id(*),
        inspectors:inspector_id(*),
        clients:client_id(*)
      `);
    
    // Aplicar filtros
    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (inspector_id) {
      query = query.eq('inspector_id', inspector_id);
    }
    if (client_id) {
      query = query.eq('client_id', client_id);
    }
    
    const { data: inspections, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar relatório de vistorias:', error);
      throw new AppError('Erro ao gerar relatório', 500);
    }
    
    // Calcular estatísticas
    const stats = {
      total: inspections.length,
      by_status: {},
      by_inspector: {},
      completion_rate: 0
    };
    
    inspections.forEach(inspection => {
      // Por status
      stats.by_status[inspection.status] = (stats.by_status[inspection.status] || 0) + 1;
      
      // Por inspetor
      if (inspection.inspectors) {
        const inspectorName = inspection.inspectors.name || 'Não atribuído';
        stats.by_inspector[inspectorName] = (stats.by_inspector[inspectorName] || 0) + 1;
      }
    });
    
    // Taxa de conclusão
    const completed = stats.by_status['completed'] || 0;
    stats.completion_rate = inspections.length > 0 ? (completed / inspections.length * 100).toFixed(2) : 0;
    
    res.json({
      success: true,
      data: {
        inspections,
        statistics: stats
      }
    });
  })
);

// Relatório de fluxo de aprovação
router.get('/approval-workflow',
  authSupabase,
  requireRole(['admin', 'manager']),
  validateRequest({ query: reportFiltersSchema }),
  asyncHandler(async (req, res) => {
    const { start_date, end_date, status } = req.query;
    
    let query = supabase
      .from('approval_workflows')
      .select(`
        *,
        inspection_requests:request_id(*),
        approved_by_user:approved_by(*),
        rejected_by_user:rejected_by(*)
      `);
    
    // Aplicar filtros
    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: workflows, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar relatório de aprovação:', error);
      throw new AppError('Erro ao gerar relatório', 500);
    }
    
    // Calcular estatísticas
    const stats = {
      total: workflows.length,
      by_status: {},
      by_priority: {},
      avg_processing_time: 0,
      approval_rate: 0
    };
    
    let totalProcessingTime = 0;
    let processedCount = 0;
    
    workflows.forEach(workflow => {
      // Por status
      stats.by_status[workflow.status] = (stats.by_status[workflow.status] || 0) + 1;
      
      // Por prioridade
      stats.by_priority[workflow.priority] = (stats.by_priority[workflow.priority] || 0) + 1;
      
      // Tempo de processamento
      if (workflow.approved_at || workflow.rejected_at) {
        const processedAt = new Date(workflow.approved_at || workflow.rejected_at);
        const createdAt = new Date(workflow.created_at);
        const processingTime = (processedAt - createdAt) / (1000 * 60 * 60); // em horas
        totalProcessingTime += processingTime;
        processedCount++;
      }
    });
    
    // Tempo médio de processamento
    stats.avg_processing_time = processedCount > 0 ? (totalProcessingTime / processedCount).toFixed(2) : 0;
    
    // Taxa de aprovação
    const approved = stats.by_status['approved'] || 0;
    stats.approval_rate = workflows.length > 0 ? (approved / workflows.length * 100).toFixed(2) : 0;
    
    res.json({
      success: true,
      data: {
        workflows,
        statistics: stats
      }
    });
  })
);

// Relatório de solicitações de vistoria
router.get('/inspection-requests',
  authSupabase,
  requireRole(['admin', 'manager']),
  validateRequest({ query: reportFiltersSchema }),
  asyncHandler(async (req, res) => {
    const { start_date, end_date, status, client_id } = req.query;
    
    let query = supabase
      .from('inspection_requests')
      .select(`
        *,
        clients:client_id(*),
        properties:property_id(*),
        approval_workflows(*)
      `);
    
    // Aplicar filtros
    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    if (end_date) {
      query = query.lte('created_at', end_date);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (client_id) {
      query = query.eq('client_id', client_id);
    }
    
    const { data: requests, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar relatório de solicitações:', error);
      throw new AppError('Erro ao gerar relatório', 500);
    }
    
    // Calcular estatísticas
    const stats = {
      total: requests.length,
      by_status: {},
      by_urgency: {},
      by_month: {}
    };
    
    requests.forEach(request => {
      // Por status
      stats.by_status[request.status] = (stats.by_status[request.status] || 0) + 1;
      
      // Por urgência
      stats.by_urgency[request.urgency_level] = (stats.by_urgency[request.urgency_level] || 0) + 1;
      
      // Por mês
      const month = new Date(request.created_at).toISOString().substring(0, 7); // YYYY-MM
      stats.by_month[month] = (stats.by_month[month] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: {
        requests,
        statistics: stats
      }
    });
  })
);

// Dashboard executivo
router.get('/dashboard',
  authSupabase,
  requireRole(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    try {
      // Buscar dados dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Solicitações de vistoria
      const { data: requests } = await supabase
        .from('inspection_requests')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString());
      
      // Vistorias
      const { data: inspections } = await supabase
        .from('inspections')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString());
      
      // Workflows de aprovação
      const { data: workflows } = await supabase
        .from('approval_workflows')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString());
      
      // Calcular métricas
      const metrics = {
        requests: {
          total: requests?.length || 0,
          pending: requests?.filter(r => r.status === 'pending').length || 0,
          approved: requests?.filter(r => r.status === 'approved').length || 0,
          rejected: requests?.filter(r => r.status === 'rejected').length || 0
        },
        inspections: {
          total: inspections?.length || 0,
          pending: inspections?.filter(i => i.status === 'pending').length || 0,
          in_progress: inspections?.filter(i => i.status === 'in_progress').length || 0,
          completed: inspections?.filter(i => i.status === 'completed').length || 0
        },
        workflows: {
          total: workflows?.length || 0,
          pending_approval: workflows?.filter(w => w.status === 'pending_approval').length || 0,
          approved: workflows?.filter(w => w.status === 'approved').length || 0,
          rejected: workflows?.filter(w => w.status === 'rejected').length || 0
        }
      };
      
      res.json({
        success: true,
        data: {
          period: '30 days',
          metrics
        }
      });
    } catch (error) {
      console.error('Erro ao gerar dashboard:', error);
      throw new AppError('Erro ao gerar dashboard', 500);
    }
  })
);

module.exports = router;
