const { supabase } = require('../config/supabase');

/**
 * Criar notificação no sistema
 * @param {Object} notificationData - Dados da notificação
 * @param {string} notificationData.recipient_type - Tipo do destinatário ('admin' ou 'client')
 * @param {string} notificationData.recipient_id - ID do destinatário
 * @param {string} notificationData.title - Título da notificação
 * @param {string} notificationData.message - Mensagem da notificação
 * @param {string} notificationData.type - Tipo da notificação
 * @param {Object} notificationData.metadata - Dados adicionais (opcional)
 */
async function createNotification(notificationData) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        recipient_type: notificationData.recipient_type,
        recipient_id: notificationData.recipient_id,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        metadata: notificationData.metadata || {},
        is_read: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar notificação:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    throw error;
  }
}

/**
 * Notificar sobre nova solicitação de vistoria
 * @param {string} requestId - ID da solicitação
 * @param {Object} requestData - Dados da solicitação
 */
async function notifyNewInspectionRequest(requestId, requestData) {
  try {
    // Buscar todos os administradores e gerentes
    const { data: admins, error } = await supabase
      .from('app_users')
      .select('id, name, email')
      .in('role', ['admin', 'manager']);

    if (error) {
      console.error('Erro ao buscar administradores:', error);
      return;
    }

    // Criar notificação para cada administrador
    const notifications = admins.map(admin => ({
      recipient_type: 'admin',
      recipient_id: admin.id,
      title: 'Nova Solicitação de Vistoria',
      message: `Nova solicitação de vistoria recebida para o imóvel ${requestData.property_address}`,
      type: 'inspection_request_created',
      metadata: {
        request_id: requestId,
        property_address: requestData.property_address,
        urgency_level: requestData.urgency_level,
        client_name: requestData.client_name
      }
    }));

    // Inserir todas as notificações
    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Erro ao inserir notificações:', insertError);
    }
  } catch (error) {
    console.error('Erro ao notificar nova solicitação:', error);
  }
}

/**
 * Notificar sobre aprovação/rejeição de solicitação
 * @param {string} clientId - ID do cliente
 * @param {string} action - Ação realizada ('approved', 'rejected', 'changes_requested')
 * @param {Object} requestData - Dados da solicitação
 * @param {string} comment - Comentário da decisão (opcional)
 */
async function notifyRequestDecision(clientId, action, requestData, comment = null) {
  try {
    let title, message;
    
    switch (action) {
      case 'approved':
        title = 'Solicitação de Vistoria Aprovada';
        message = `Sua solicitação de vistoria para o imóvel ${requestData.property_address} foi aprovada.`;
        break;
      case 'rejected':
        title = 'Solicitação de Vistoria Rejeitada';
        message = `Sua solicitação de vistoria para o imóvel ${requestData.property_address} foi rejeitada.`;
        break;
      case 'changes_requested':
        title = 'Alterações Solicitadas';
        message = `Foram solicitadas alterações na sua solicitação de vistoria para o imóvel ${requestData.property_address}.`;
        break;
      default:
        return;
    }

    if (comment) {
      message += ` Comentário: ${comment}`;
    }

    await createNotification({
      recipient_type: 'client',
      recipient_id: clientId,
      title,
      message,
      type: `inspection_request_${action}`,
      metadata: {
        request_id: requestData.id,
        property_address: requestData.property_address,
        action,
        comment
      }
    });
  } catch (error) {
    console.error('Erro ao notificar decisão:', error);
  }
}

/**
 * Notificar sobre vistoria agendada
 * @param {string} clientId - ID do cliente
 * @param {Object} inspectionData - Dados da vistoria
 */
async function notifyInspectionScheduled(clientId, inspectionData) {
  try {
    await createNotification({
      recipient_type: 'client',
      recipient_id: clientId,
      title: 'Vistoria Agendada',
      message: `Sua vistoria foi agendada para ${new Date(inspectionData.scheduled_date).toLocaleDateString('pt-BR')} no imóvel ${inspectionData.property_address}.`,
      type: 'inspection_scheduled',
      metadata: {
        inspection_id: inspectionData.id,
        scheduled_date: inspectionData.scheduled_date,
        property_address: inspectionData.property_address,
        inspector_name: inspectionData.inspector_name
      }
    });
  } catch (error) {
    console.error('Erro ao notificar agendamento:', error);
  }
}

/**
 * Notificar sobre mudança de status da vistoria
 * @param {string} clientId - ID do cliente
 * @param {string} status - Novo status
 * @param {Object} inspectionData - Dados da vistoria
 */
async function notifyInspectionStatusChange(clientId, status, inspectionData) {
  try {
    let title, message;
    
    switch (status) {
      case 'in_progress':
        title = 'Vistoria Iniciada';
        message = `A vistoria do imóvel ${inspectionData.property_address} foi iniciada.`;
        break;
      case 'completed':
        title = 'Vistoria Concluída';
        message = `A vistoria do imóvel ${inspectionData.property_address} foi concluída. O relatório estará disponível em breve.`;
        break;
      case 'cancelled':
        title = 'Vistoria Cancelada';
        message = `A vistoria do imóvel ${inspectionData.property_address} foi cancelada.`;
        break;
      default:
        return;
    }

    await createNotification({
      recipient_type: 'client',
      recipient_id: clientId,
      title,
      message,
      type: `inspection_${status}`,
      metadata: {
        inspection_id: inspectionData.id,
        property_address: inspectionData.property_address,
        status
      }
    });
  } catch (error) {
    console.error('Erro ao notificar mudança de status:', error);
  }
}

/**
 * Notificar sobre relatório de vistoria disponível
 * @param {string} clientId - ID do cliente
 * @param {Object} reportData - Dados do relatório
 */
async function notifyReportAvailable(clientId, reportData) {
  try {
    await createNotification({
      recipient_type: 'client',
      recipient_id: clientId,
      title: 'Relatório de Vistoria Disponível',
      message: `O relatório da vistoria do imóvel ${reportData.property_address} está disponível para download.`,
      type: 'report_available',
      metadata: {
        report_id: reportData.id,
        inspection_id: reportData.inspection_id,
        property_address: reportData.property_address,
        report_url: reportData.report_url
      }
    });
  } catch (error) {
    console.error('Erro ao notificar relatório disponível:', error);
  }
}

module.exports = {
  createNotification,
  notifyNewInspectionRequest,
  notifyRequestDecision,
  notifyInspectionScheduled,
  notifyInspectionStatusChange,
  notifyReportAvailable
};