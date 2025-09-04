const express = require('express');
const { z } = require('zod');
const { supabase } = require('../config/supabase.js');
const { authSupabase, requireAdmin, logProtectedAccess } = require('../middleware/auth.js');
const { authenticateClient } = require('../middleware/clientAuth.js');
const router = express.Router();

// Schema de validação
const markAsReadSchema = z.object({
  notification_ids: z.array(z.string().uuid()).min(1)
});

// Listar notificações do usuário admin
router.get('/admin', authSupabase, requireAdmin, logProtectedAccess('admin_notifications_list'), async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_type', 'admin')
      .eq('recipient_id', req.user.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unread_only === 'true') {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Erro ao buscar notificações:', error);
      return res.status(500).json({ error: 'Erro ao buscar notificações' });
    }

    // Contar total de notificações não lidas
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_type', 'admin')
      .eq('recipient_id', req.user.userId)
      .eq('is_read', false);

    res.json({
      message: 'Notificações carregadas com sucesso',
      data: notifications || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: notifications?.length || 0
      },
      unread_count: unreadCount || 0
    });
  } catch (error) {
    console.error('Erro ao listar notificações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar notificações do cliente
router.get('/client', authenticateClient, async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('recipient_type', 'client')
      .eq('recipient_id', req.client.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unread_only === 'true') {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Erro ao buscar notificações:', error);
      return res.status(500).json({ error: 'Erro ao buscar notificações' });
    }

    // Contar total de notificações não lidas
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_type', 'client')
      .eq('recipient_id', req.client.id)
      .eq('is_read', false);

    res.json({
      message: 'Notificações carregadas com sucesso',
      data: notifications || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: notifications?.length || 0
      },
      unread_count: unreadCount || 0
    });
  } catch (error) {
    console.error('Erro ao listar notificações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Marcar notificações como lidas (admin)
router.put('/admin/mark-read', authSupabase, requireAdmin, logProtectedAccess('admin_notifications_mark_read'), async (req, res) => {
  try {
    const validatedData = markAsReadSchema.parse(req.body);

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', validatedData.notification_ids)
      .eq('recipient_type', 'admin')
      .eq('recipient_id', req.user.userId)
      .select();

    if (error) {
      console.error('Erro ao marcar notificações como lidas:', error);
      return res.status(500).json({ error: 'Erro ao atualizar notificações' });
    }

    res.json({
      message: 'Notificações marcadas como lidas',
      updated_count: data?.length || 0
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: error.errors 
      });
    }
    console.error('Erro ao marcar notificações como lidas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Marcar notificações como lidas (cliente)
router.put('/client/mark-read', authenticateClient, async (req, res) => {
  try {
    const validatedData = markAsReadSchema.parse(req.body);

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', validatedData.notification_ids)
      .eq('recipient_type', 'client')
      .eq('recipient_id', req.client.id)
      .select();

    if (error) {
      console.error('Erro ao marcar notificações como lidas:', error);
      return res.status(500).json({ error: 'Erro ao atualizar notificações' });
    }

    res.json({
      message: 'Notificações marcadas como lidas',
      updated_count: data?.length || 0
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Dados inválidos', 
        details: error.errors 
      });
    }
    console.error('Erro ao marcar notificações como lidas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Marcar todas as notificações como lidas (admin)
router.put('/admin/mark-all-read', authSupabase, requireAdmin, logProtectedAccess('admin_notifications_mark_all_read'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_type', 'admin')
      .eq('recipient_id', req.user.userId)
      .eq('is_read', false)
      .select();

    if (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
      return res.status(500).json({ error: 'Erro ao atualizar notificações' });
    }

    res.json({
      message: 'Todas as notificações foram marcadas como lidas',
      updated_count: data?.length || 0
    });
  } catch (error) {
    console.error('Erro ao marcar todas as notificações como lidas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Marcar todas as notificações como lidas (cliente)
router.put('/client/mark-all-read', authenticateClient, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_type', 'client')
      .eq('recipient_id', req.client.id)
      .eq('is_read', false)
      .select();

    if (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
      return res.status(500).json({ error: 'Erro ao atualizar notificações' });
    }

    res.json({
      message: 'Todas as notificações foram marcadas como lidas',
      updated_count: data?.length || 0
    });
  } catch (error) {
    console.error('Erro ao marcar todas as notificações como lidas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;

