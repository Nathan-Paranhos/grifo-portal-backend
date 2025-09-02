const express = require('express');
const { supabase } = require('../config/supabase.js');
// const { logger } = require('../config/logger.js');
const {
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError
} = require('../middleware/errorHandler.js');
const authModule = require('../middleware/auth.js');
const { validateRequest, commonSchemas } = require('../middleware/validation.js');
const { z } = require('zod');
const { authMiddleware } = authModule;

// Sync validation schemas
const syncSchemas = {
  trigger: {
    body: z
      .object({
        sync_type: z.enum(['full', 'incremental', 'entity_specific']),
        entity_types: z
          .array(
            z.enum([
              'properties',
              'inspections',
              'users',
              'contests',
              'uploads'
            ])
          )
          .optional(),
        force: z.boolean().optional().default(false)
      })
      .refine(
        data => {
          if (data.sync_type === 'entity_specific') {
            return data.entity_types && data.entity_types.length > 0;
          }
          return true;
        },
        {
          message:
            'entity_types é obrigatório quando sync_type é entity_specific',
          path: ['entity_types']
        }
      )
  },
  retry: {
    body: z.object({
      operation_ids: z
        .array(commonSchemas.uuid)
        .min(1, 'Pelo menos uma operação deve ser especificada')
    })
  },
  // Additional schemas for sync history filtering
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  syncType: z.enum(['full', 'incremental', 'entity_specific'])
};

const router = express.Router();

// All sync routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/sync/status:
 *   get:
 *     tags: [Sync]
 *     summary: Status da sincronização
 *     description: |
 *       Retorna o status atual da sincronização de dados da empresa.
 *       Mostra última sincronização, pendências e estatísticas.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status da sincronização
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     last_sync:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *                     sync_status:
 *                       type: string
 *                       enum: [idle, syncing, error]
 *                       example: "idle"
 *                     pending_items:
 *                       type: integer
 *                       example: 5
 *                     sync_stats:
 *                       type: object
 *                       properties:
 *                         total_synced:
 *                           type: integer
 *                         failed_syncs:
 *                           type: integer
 *                         success_rate:
 *                           type: number
 *                     pending_operations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           operation_type:
 *                             type: string
 *                           entity_type:
 *                             type: string
 *                           entity_id:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                             format: date-time
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const { user } = req;

    try {
      // Get sync operations for the company
      const { data: syncOps, error: syncError } = await supabase
        .from('sync_operations')
        .select('*')
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (syncError) {
        console.error('Sync status error:', syncError);
        throw new AppError('Erro ao carregar status de sincronização');
      }

      // Calculate statistics
      const pendingOps = syncOps.filter(op => op.status === 'pending');
      const completedOps = syncOps.filter(op => op.status === 'completed');
      const failedOps = syncOps.filter(op => op.status === 'failed');

      const lastSync = syncOps.find(op => op.status === 'completed');
      const currentSync = syncOps.find(op => op.status === 'processing');

      const syncStats = {
        total_synced: completedOps.length,
        failed_syncs: failedOps.length,
        success_rate:
          syncOps.length > 0 ? (completedOps.length / syncOps.length) * 100 : 0
      };

      const syncStatus = currentSync
        ? 'syncing'
        : failedOps.length > 0 && !lastSync
          ? 'error'
          : 'idle';

      console.log('Sync status retrieved', {
        userId: user.id,
        companyId: user.company_id,
        pendingCount: pendingOps.length,
        syncStatus
      });

      res.json({
        success: true,
        data: {
          last_sync: lastSync?.completed_at || null,
          sync_status: syncStatus,
          pending_items: pendingOps.length,
          sync_stats: syncStats,
          pending_operations: pendingOps.slice(0, 10).map(op => ({
            id: op.id,
            operation_type: op.operation_type,
            entity_type: op.entity_type,
            entity_id: op.entity_id,
            created_at: op.created_at,
            retry_count: op.retry_count,
            error_message: op.error_message
          }))
        }
      });
    } catch (error) {
      console.error('Sync status error:', error);
      throw new AppError('Erro ao carregar status de sincronização');
    }
  })
);

/**
 * @swagger
 * /api/sync/trigger:
 *   post:
 *     tags: [Sync]
 *     summary: Disparar sincronização
 *     description: |
 *       Dispara uma sincronização manual de dados.
 *       Apenas administradores e gerentes podem disparar sincronizações.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sync_type
 *             properties:
 *               sync_type:
 *                 type: string
 *                 enum: [full, incremental, entity_specific]
 *                 example: "incremental"
 *               entity_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [properties, inspections, users, contests, uploads]
 *                 example: ["properties", "inspections"]
 *                 description: Requerido quando sync_type é 'entity_specific'
 *               force:
 *                 type: boolean
 *                 default: false
 *                 description: Forçar sincronização mesmo se houver uma em andamento
 *     responses:
 *       200:
 *         description: Sincronização iniciada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Sincronização iniciada com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     sync_id:
 *                       type: string
 *                       format: uuid
 *                     estimated_duration:
 *                       type: integer
 *                       description: Duração estimada em segundos
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Sincronização já em andamento
 */
router.post(
  '/trigger',
  validateRequest({ body: syncSchemas.trigger }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const {
      sync_type: syncType,
      entity_types: entityTypes = [],
      force = false
    } = req.body;

    try {
      // Check if there's already a sync in progress
      if (!force) {
        const { data: activeSyncs, error: checkError } = await supabase
          .from('sync_operations')
          .select('id')
          .eq('company_id', user.company_id)
          .eq('status', 'processing')
          .limit(1);

        if (checkError) {
          console.error('Active sync check error:', checkError);
          throw new AppError('Erro ao verificar sincronizações ativas');
        }

        if (activeSyncs.length > 0) {
          throw new ValidationError('Já existe uma sincronização em andamento');
        }
      }

      // Validate entity_types for entity_specific sync
      if (syncType === 'entity_specific' && entityTypes.length === 0) {
        throw new ValidationError(
          'Tipos de entidade são obrigatórios para sincronização específica'
        );
      }

      // Create sync operation record
      const syncData = {
        company_id: user.company_id,
        operation_type: 'sync',
        sync_type: syncType,
        entity_types: syncType === 'entity_specific' ? entityTypes : null,
        status: 'processing',
        initiated_by: user.id,
        started_at: new Date().toISOString()
      };

      const { data: syncOperation, error: createError } = await supabase
        .from('sync_operations')
        .insert(syncData)
        .select()
        .single();

      if (createError) {
        console.error('Sync operation creation error:', createError);
        throw new AppError('Erro ao criar operação de sincronização');
      }

      // Estimate duration based on sync type
      let estimatedDuration = 60; // Default 1 minute
      switch (syncType) {
        case 'full':
          estimatedDuration = 300; // 5 minutes
          break;
        case 'incremental':
          estimatedDuration = 120; // 2 minutes
          break;
        case 'entity_specific':
          estimatedDuration = entityTypes.length * 30; // 30 seconds per entity type
          break;
        default:
          estimatedDuration = 60; // Default 1 minute
          break;
      }

      // In a real implementation, you would trigger the actual sync process here
      // For now, we'll simulate it by updating the status after a delay
      setTimeout(async () => {
        try {
          await simulateSyncProcess(syncOperation.id, syncType, entityTypes);
        } catch (error) {
          console.error('Sync simulation error:', error);
        }
      }, 1000);

      console.log('Sync triggered', {
        userId: user.id,
        companyId: user.company_id,
        syncId: syncOperation.id,
        syncType,
        entityTypes,
        force
      });

      res.json({
        success: true,
        message: 'Sincronização iniciada com sucesso',
        data: {
          sync_id: syncOperation.id,
          estimated_duration: estimatedDuration
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error('Sync trigger error:', error);
      throw new AppError('Erro ao iniciar sincronização');
    }
  })
);

/**
 * @swagger
 * /api/sync/history:
 *   get:
 *     tags: [Sync]
 *     summary: Histórico de sincronizações
 *     description: |
 *       Lista o histórico de sincronizações da empresa com paginação.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *       - in: query
 *         name: sync_type
 *         schema:
 *           type: string
 *           enum: [full, incremental, entity_specific]
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Histórico de sincronizações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     sync_operations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SyncOperation'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 */
router.get(
  '/history',
  validateRequest({
    query: {
      ...commonSchemas.pagination,
      status: syncSchemas.status.optional(),
      sync_type: syncSchemas.syncType.optional(),
      from_date: commonSchemas.date.optional(),
      to_date: commonSchemas.date.optional()
    }
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const {
      page = 1,
      limit = 20,
      status,
      sync_type: syncType,
      from_date: fromDate,
      to_date: toDate
    } = req.query;

    const offset = (page - 1) * limit;

    try {
      let query = supabase
        .from('sync_operations')
        .select(
          `
          id,
          operation_type,
          sync_type,
          entity_types,
          status,
          started_at,
          completed_at,
          duration_seconds,
          items_processed,
          items_failed,
          error_message,
          retry_count,
          users!sync_operations_initiated_by_fkey(
            id,
            name as initiator_name
          )
        `,
          { count: 'exact' }
        )
        .eq('company_id', user.company_id);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (syncType) {
        query = query.eq('sync_type', syncType);
      }

      if (fromDate) {
        query = query.gte('started_at', fromDate);
      }

      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('started_at', endDate.toISOString());
      }

      // Apply sorting and pagination
      query = query
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: syncOperations, error, count } = await query;

      if (error) {
        console.error('Sync history error:', error);
        throw new AppError('Erro ao carregar histórico de sincronizações');
      }

      // Process sync operations to flatten nested data
      const processedOperations = syncOperations.map(op => ({
        ...op,
        initiator: {
          id: op.users?.id,
          name: op.users?.initiator_name
        },
        users: undefined
      }));

      const totalPages = Math.ceil(count / limit);

      console.log('Sync history retrieved', {
        userId: user.id,
        companyId: user.company_id,
        count,
        page,
        limit,
        filters: { status, syncType, fromDate, toDate }
      });

      res.json({
        success: true,
        data: {
          sync_operations: processedOperations,
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: count,
            pages: totalPages
          }
        }
      });
    } catch (error) {
      console.error('Sync history error:', error);
      throw new AppError('Erro ao carregar histórico de sincronizações');
    }
  })
);

/**
 * @swagger
 * /api/sync/{id}:
 *   get:
 *     tags: [Sync]
 *     summary: Detalhes da sincronização
 *     description: |
 *       Retorna os detalhes completos de uma operação de sincronização específica.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalhes da sincronização
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     sync_operation:
 *                       $ref: '#/components/schemas/SyncOperation'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    try {
      const { data: syncOperation, error } = await supabase
        .from('sync_operations')
        .select(
          `
          *,
          users!sync_operations_initiated_by_fkey(
            id,
            name as initiator_name,
            email as initiator_email
          )
        `
        )
        .eq('id', id)
        .eq('company_id', user.company_id)
        .single();

      if (error || !syncOperation) {
        throw new NotFoundError('Operação de sincronização não encontrada');
      }

      // Process sync operation to flatten nested data
      const processedOperation = {
        ...syncOperation,
        initiator: {
          id: syncOperation.users?.id,
          name: syncOperation.users?.initiator_name,
          email: syncOperation.users?.initiator_email
        },
        users: undefined
      };

      console.log('Sync operation retrieved', {
        userId: user.id,
        syncId: id,
        status: syncOperation.status
      });

      res.json({
        success: true,
        data: {
          sync_operation: processedOperation
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('Sync operation get error:', error);
      throw new AppError('Erro ao carregar operação de sincronização');
    }
  })
);

/**
 * @swagger
 * /api/sync/{id}/cancel:
 *   post:
 *     tags: [Sync]
 *     summary: Cancelar sincronização
 *     description: |
 *       Cancela uma operação de sincronização em andamento.
 *       Apenas administradores e gerentes podem cancelar sincronizações.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Sincronização cancelada com sucesso
 *       400:
 *         description: Sincronização não pode ser cancelada
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  '/:id/cancel',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    try {
      // Check if sync operation exists and belongs to company
      const { data: syncOperation, error: checkError } = await supabase
        .from('sync_operations')
        .select('id, status, sync_type')
        .eq('id', id)
        .eq('company_id', user.company_id)
        .single();

      if (checkError || !syncOperation) {
        throw new NotFoundError('Operação de sincronização não encontrada');
      }

      // Only allow cancellation of processing operations
      if (syncOperation.status !== 'processing') {
        throw new ValidationError(
          'Apenas sincronizações em andamento podem ser canceladas'
        );
      }

      // Update sync operation status
      const { error: updateError } = await supabase
        .from('sync_operations')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_message: `Cancelada pelo usuário ${user.name}`,
          cancelled_by: user.id
        })
        .eq('id', id);

      if (updateError) {
        console.error('Sync cancellation error:', updateError);
        throw new AppError('Erro ao cancelar sincronização');
      }

      console.log('Sync operation cancelled', {
        userId: user.id,
        syncId: id,
        syncType: syncOperation.sync_type
      });

      res.json({
        success: true,
        message: 'Sincronização cancelada com sucesso'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Sync cancellation error:', error);
      throw new AppError('Erro ao cancelar sincronização');
    }
  })
);

/**
 * @swagger
 * /api/sync/{id}/retry:
 *   post:
 *     tags: [Sync]
 *     summary: Tentar novamente sincronização
 *     description: |
 *       Tenta novamente uma operação de sincronização que falhou.
 *       Apenas administradores e gerentes podem tentar novamente.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Sincronização reiniciada com sucesso
 *       400:
 *         description: Sincronização não pode ser tentada novamente
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  '/:id/retry',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    try {
      // Check if sync operation exists and belongs to company
      const { data: syncOperation, error: checkError } = await supabase
        .from('sync_operations')
        .select('id, status, sync_type, retry_count, entity_types')
        .eq('id', id)
        .eq('company_id', user.company_id)
        .single();

      if (checkError || !syncOperation) {
        throw new NotFoundError('Operação de sincronização não encontrada');
      }

      // Only allow retry of failed operations
      if (syncOperation.status !== 'failed') {
        throw new ValidationError(
          'Apenas sincronizações que falharam podem ser tentadas novamente'
        );
      }

      // Check retry limit
      const maxRetries = 3;
      if (syncOperation.retry_count >= maxRetries) {
        throw new ValidationError(
          `Limite de tentativas excedido (${maxRetries})`
        );
      }

      // Update sync operation for retry
      const { error: updateError } = await supabase
        .from('sync_operations')
        .update({
          status: 'processing',
          retry_count: syncOperation.retry_count + 1,
          started_at: new Date().toISOString(),
          completed_at: null,
          error_message: null,
          retried_by: user.id
        })
        .eq('id', id);

      if (updateError) {
        console.error('Sync retry error:', updateError);
        throw new AppError('Erro ao tentar novamente a sincronização');
      }

      // Simulate retry process
      setTimeout(async () => {
        try {
          await simulateSyncProcess(
            id,
            syncOperation.sync_type,
            syncOperation.entity_types
          );
        } catch (error) {
          console.error('Sync retry simulation error:', error);
        }
      }, 1000);

      console.log('Sync operation retried', {
        userId: user.id,
        syncId: id,
        syncType: syncOperation.sync_type,
        retryCount: syncOperation.retry_count + 1
      });

      res.json({
        success: true,
        message: 'Sincronização reiniciada com sucesso'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Sync retry error:', error);
      throw new AppError('Erro ao tentar novamente a sincronização');
    }
  })
);

// Helper function to simulate sync process
async function simulateSyncProcess(syncId, _syncType, _entityTypes) {
  try {
    // Simulate processing time
    const processingTime = Math.random() * 10000 + 5000; // 5-15 seconds
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate success/failure (90% success rate)
    const success = Math.random() > 0.1;

    const updateData = {
      completed_at: new Date().toISOString(),
      duration_seconds: Math.floor(processingTime / 1000)
    };

    if (success) {
      updateData.status = 'completed';
      updateData.items_processed = Math.floor(Math.random() * 100) + 10;
      updateData.items_failed = Math.floor(Math.random() * 5);
    } else {
      updateData.status = 'failed';
      updateData.error_message = 'Erro simulado durante o processamento';
      updateData.items_processed = Math.floor(Math.random() * 50);
      updateData.items_failed = Math.floor(Math.random() * 20) + 5;
    }

    await supabase.from('sync_operations').update(updateData).eq('id', syncId);

    console.log('Sync process completed', {
      syncId,
      success,
      duration: updateData.duration_seconds
    });
  } catch (error) {
    console.error('Sync process simulation error:', error);

    // Mark as failed
    await supabase
      .from('sync_operations')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('id', syncId);
  }
}

module.exports = router;

