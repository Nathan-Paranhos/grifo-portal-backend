const express = require('express');
const { z } = require('zod');
const { supabase } = require('../../config/supabase.js');
// const { logger } = require('../../config/logger.js');
const {
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError
} = require('../../middleware/errorHandler.js');

const router = express.Router();

// Schema de validação
const markAsReadSchema = z.object({
  notification_ids: z.array(z.string().uuid()).min(1)
});

// Listar notificações do usuário
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user.id;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_type', 'admin')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unread_only === 'true') {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Erro ao buscar notificações:', error);
      throw new AppError('Erro ao buscar notificações', 500);
    }

    // Contar total de notificações não lidas
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_type', 'admin')
      .eq('recipient_id', userId)
      .eq('is_read', false);

    res.json({
      success: true,
      message: 'Notificações carregadas com sucesso',
      data: notifications || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: notifications?.length || 0
      },
      unread_count: unreadCount || 0
    });
  })
);

// Marcar notificações como lidas
router.put(
  '/mark-read',
  asyncHandler(async (req, res) => {
    const validatedData = markAsReadSchema.parse(req.body);
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', validatedData.notification_ids)
      .eq('recipient_type', 'admin')
      .eq('recipient_id', userId)
      .select();

    if (error) {
      console.error('Erro ao marcar notificações como lidas:', error);
      throw new AppError('Erro ao atualizar notificações', 500);
    }

    res.json({
      success: true,
      message: 'Notificações marcadas como lidas',
      updated_count: data?.length || 0
    });
  })
);

// Marcar todas as notificações como lidas
router.put(
  '/mark-all-read',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_type', 'admin')
      .eq('recipient_id', userId)
      .eq('is_read', false)
      .select();

    if (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
      throw new AppError('Erro ao atualizar notificações', 500);
    }

    res.json({
      success: true,
      message: 'Todas as notificações foram marcadas como lidas',
      updated_count: data?.length || 0
    });
  })
);

// Obter contagem de notificações não lidas
router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_type', 'admin')
      .eq('recipient_id', userId)
      .eq('is_read', false);

    res.json({
      success: true,
      message: 'Contagem de notificações não lidas',
      unread_count: unreadCount || 0
    });
  })
);

// Deletar notificação
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar se a notificação existe e pertence ao usuário
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('recipient_type', 'admin')
      .eq('recipient_id', userId)
      .single();

    if (fetchError || !notification) {
      throw new NotFoundError('Notificação não encontrada');
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar notificação:', error);
      throw new AppError('Erro ao deletar notificação', 500);
    }

    res.json({
      success: true,
      message: 'Notificação deletada com sucesso'
    });
  })
);

module.exports = router;

