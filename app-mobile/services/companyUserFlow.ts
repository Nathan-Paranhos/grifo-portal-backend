import { supabase } from './supabase';

export interface VistoriaAssignment {
  id: string;
  vistoria_id: string;
  vistoriador_id: string;
  assigned_by: string;
  assigned_at: string;
  status: 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  data?: any;
  read_at?: string;
  created_at: string;
}

export interface AvailableVistoria {
  vistoria_id: string;
  endereco: string;
  tipo_vistoria: string;
  status: string;
  data_vistoria: string;
  empresa_nome: string;
  assignment_status: string;
}

/**
 * Serviço para gerenciar o fluxo entre empresas e usuários do app
 * Empresas cadastram vistorias, usuários do app apenas recebem
 */
export class CompanyUserFlowService {
  
  /**
   * FUNÇÕES PARA EMPRESAS
   */
  
  /**
   * Atribuir uma vistoria para um vistoriador (apenas empresas)
   */
  static async assignVistoriaToVistoriador(
    vistoriaId: string,
    vistoriadorId: string,
    notes?: string
  ): Promise<string> {
    try {
      const { data, error } = await supabase
        .rpc('assign_vistoria_to_vistoriador', {
          p_vistoria_id: vistoriaId,
          p_vistoriador_id: vistoriadorId,
          p_notes: notes
        });
      
      if (error) throw error;
      
      console.log('✅ Vistoria atribuída com sucesso:', data);
      return data;
    } catch (error) {
      // Error assigning vistoria handled silently
      throw error;
    }
  }
  
  /**
   * Listar vistoriadores disponíveis para uma empresa
   */
  static async getAvailableVistoriadores(empresaId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nome, email, user_type')
        .eq('user_type', 'vistoriador_app')
        .eq('empresa_id', empresaId)
        .order('nome');
      
      if (error) throw error;
      return data;
    } catch (error) {
      // Error loading vistoriadores handled silently
      throw error;
    }
  }
  
  /**
   * Obter estatísticas de assignments para uma empresa
   */
  static async getAssignmentStats(empresaId: string) {
    try {
      const { data, error } = await supabase
        .from('vistoria_assignments')
        .select(`
          status,
          vistoria:vistorias!inner(empresa_id)
        `)
        .eq('vistoria.empresa_id', empresaId);
      
      if (error) throw error;
      
      // Processar estatísticas
      const stats = data.reduce((acc, assignment) => {
        acc[assignment.status] = (acc[assignment.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        total: data.length,
        assigned: stats.assigned || 0,
        accepted: stats.accepted || 0,
        in_progress: stats.in_progress || 0,
        completed: stats.completed || 0,
        rejected: stats.rejected || 0
      };
    } catch (error) {
      // Error loading statistics handled silently
      throw error;
    }
  }
  
  /**
   * FUNÇÕES PARA VISTORIADORES (USUÁRIOS DO APP)
   */
  
  /**
   * Obter vistorias disponíveis/atribuídas para um vistoriador
   */
  static async getAvailableVistoriasForVistoriador(
    vistoriadorId: string
  ): Promise<AvailableVistoria[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_available_vistorias_for_vistoriador', {
          vistoriador_uuid: vistoriadorId
        });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar vistorias disponíveis:', error);
      throw error;
    }
  }
  
  /**
   * Aceitar uma vistoria atribuída
   */
  static async acceptVistoriaAssignment(assignmentId: string) {
    try {
      const { data, error } = await supabase
        .from('vistoria_assignments')
        .update({ 
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId)
        .eq('vistoriador_id', (await supabase.auth.getUser()).data.user?.id)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Vistoria aceita:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao aceitar vistoria:', error);
      throw error;
    }
  }
  
  /**
   * Rejeitar uma vistoria atribuída
   */
  static async rejectVistoriaAssignment(assignmentId: string, reason?: string) {
    try {
      const { data, error } = await supabase
        .from('vistoria_assignments')
        .update({ 
          status: 'rejected',
          notes: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId)
        .eq('vistoriador_id', (await supabase.auth.getUser()).data.user?.id)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Vistoria rejeitada:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao rejeitar vistoria:', error);
      throw error;
    }
  }
  
  /**
   * Marcar vistoria como em progresso
   */
  static async startVistoriaProgress(assignmentId: string) {
    try {
      const { data, error } = await supabase
        .from('vistoria_assignments')
        .update({ 
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId)
        .eq('vistoriador_id', (await supabase.auth.getUser()).data.user?.id)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Vistoria iniciada:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao iniciar vistoria:', error);
      throw error;
    }
  }
  
  /**
   * SISTEMA DE NOTIFICAÇÕES
   */
  
  /**
   * Obter notificações do usuário atual
   */
  static async getUserNotifications(limit: number = 50): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao buscar notificações:', error);
      throw error;
    }
  }
  
  /**
   * Marcar notificação como lida
   */
  static async markNotificationAsRead(notificationId: string) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao marcar notificação como lida:', error);
      throw error;
    }
  }
  
  /**
   * Marcar todas as notificações como lidas
   */
  static async markAllNotificationsAsRead() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)
        .select();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao marcar todas as notificações como lidas:', error);
      throw error;
    }
  }
  
  /**
   * Contar notificações não lidas
   */
  static async getUnreadNotificationsCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .is('read_at', null);
      
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('❌ Erro ao contar notificações não lidas:', error);
      return 0;
    }
  }
  
  /**
   * FUNÇÕES AUXILIARES
   */
  
  /**
   * Verificar se o usuário atual pode criar vistorias
   */
  static async canCurrentUserCreateVistorias(): Promise<boolean> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;
      
      const { data, error } = await supabase
        .from('users')
        .select('can_create_vistorias')
        .eq('id', user.user.id)
        .single();
      
      if (error) throw error;
      return data?.can_create_vistorias || false;
    } catch (error) {
      console.error('❌ Erro ao verificar permissões:', error);
      return false;
    }
  }
  
  /**
   * Obter tipo do usuário atual
   */
  static async getCurrentUserType(): Promise<string | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;
      
      const { data, error } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', user.user.id)
        .single();
      
      if (error) throw error;
      return data?.user_type || null;
    } catch (error) {
      console.error('❌ Erro ao obter tipo do usuário:', error);
      return null;
    }
  }
  
  /**
   * Subscrever a mudanças em tempo real
   */
  static subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ) {
    return supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔔 Nova notificação recebida:', payload.new);
          callback(payload.new as Notification);
        }
      )
      .subscribe();
  }
  
  /**
   * Subscrever a mudanças em assignments
   */
  static subscribeToAssignments(
    vistoriadorId: string,
    callback: (assignment: VistoriaAssignment) => void
  ) {
    return supabase
      .channel('assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vistoria_assignments',
          filter: `vistoriador_id=eq.${vistoriadorId}`
        },
        (payload) => {
          console.log('📋 Assignment atualizado:', payload);
          callback(payload.new as VistoriaAssignment);
        }
      )
      .subscribe();
  }
}

export default CompanyUserFlowService;