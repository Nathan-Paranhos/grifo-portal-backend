const { supabase } = require('../config/supabase');
const fs = require('fs').promises;
const path = require('path');

/**
 * Sistema de logs de auditoria para tentativas de acesso administrativo
 */
class AuditLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDirectory();
  }

  /**
   * Garante que o diretório de logs existe
   */
  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('[AUDIT] Erro ao criar diretório de logs:', error);
    }
  }

  /**
   * Registra tentativa de login administrativo
   * @param {Object} logData - Dados do log
   */
  async logAdminAccess(logData) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: 'ADMIN_ACCESS',
      ...logData
    };

    // Log no console
    console.log(`[AUDIT] ${timestamp} - ${logData.action}: ${JSON.stringify(logData)}`);

    // Salvar em arquivo
    await this.saveToFile(logEntry);

    // Salvar no banco de dados (se necessário)
    await this.saveToDB(logEntry);
  }

  /**
   * Registra tentativa de acesso a recursos protegidos
   * @param {Object} logData - Dados do log
   */
  async logResourceAccess(logData) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: 'RESOURCE_ACCESS',
      ...logData
    };

    console.log(`[AUDIT] ${timestamp} - ${logData.action}: ${JSON.stringify(logData)}`);
    await this.saveToFile(logEntry);
    await this.saveToDB(logEntry);
  }

  /**
   * Registra alterações de dados críticos
   * @param {Object} logData - Dados do log
   */
  async logDataChange(logData) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: 'DATA_CHANGE',
      ...logData
    };

    console.log(`[AUDIT] ${timestamp} - ${logData.action}: ${JSON.stringify(logData)}`);
    await this.saveToFile(logEntry);
    await this.saveToDB(logEntry);
  }

  /**
   * Salva log em arquivo
   * @param {Object} logEntry - Entrada do log
   */
  async saveToFile(logEntry) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `audit-${today}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      await fs.appendFile(logFile, logLine, 'utf8');
    } catch (error) {
      console.error('[AUDIT] Erro ao salvar log em arquivo:', error);
    }
  }

  /**
   * Salva log no banco de dados
   * @param {Object} logEntry - Entrada do log
   */
  async saveToDB(logEntry) {
    try {
      // Criar tabela de auditoria se não existir
      await this.ensureAuditTable();

      const { error } = await supabase
        .from('audit_logs')
        .insert({
          timestamp: logEntry.timestamp,
          type: logEntry.type,
          action: logEntry.action,
          user_email: logEntry.email || null,
          user_id: logEntry.user_id || null,
          ip_address: logEntry.ip || null,
          user_agent: logEntry.user_agent || null,
          resource: logEntry.resource || null,
          details: logEntry,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('[AUDIT] Erro ao salvar log no banco:', error);
      }
    } catch (error) {
      console.error('[AUDIT] Erro ao salvar log no banco:', error);
    }
  }

  /**
   * Garante que a tabela de auditoria existe
   */
  async ensureAuditTable() {
    // Esta função seria chamada apenas uma vez para criar a tabela
    // A criação da tabela deve ser feita via migration SQL
  }

  /**
   * Busca logs de auditoria
   * @param {Object} filters - Filtros de busca
   * @returns {Array} Logs encontrados
   */
  async getLogs(filters = {}) {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (filters.user_email) {
        query = query.eq('user_email', filters.user_email);
      }

      if (filters.action) {
        query = query.eq('action', filters.action);
      }

      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.start_date) {
        query = query.gte('timestamp', filters.start_date);
      }

      if (filters.end_date) {
        query = query.lte('timestamp', filters.end_date);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AUDIT] Erro ao buscar logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[AUDIT] Erro ao buscar logs:', error);
      return [];
    }
  }

  /**
   * Limpa logs antigos (manter apenas últimos 90 dias)
   */
  async cleanOldLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const { error } = await supabase
        .from('audit_logs')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      if (error) {
        console.error('[AUDIT] Erro ao limpar logs antigos:', error);
      } else {
        console.log('[AUDIT] Logs antigos limpos com sucesso');
      }
    } catch (error) {
      console.error('[AUDIT] Erro ao limpar logs antigos:', error);
    }
  }
}

// Instância singleton do logger
const auditLogger = new AuditLogger();

/**
 * Middleware para capturar informações da requisição para auditoria
 */
const auditMiddleware = (req, res, next) => {
  req.auditInfo = {
    ip: req.ip || req.connection.remoteAddress,
    user_agent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    body: req.method === 'POST' ? { ...req.body, password: '[REDACTED]' } : undefined
  };
  
  next();
};

/**
 * Função helper para log de login
 */
const logLogin = async (email, success, reason = null, req = null) => {
  const logData = {
    action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
    email,
    success,
    reason,
    ip: req?.auditInfo?.ip || req?.ip,
    user_agent: req?.auditInfo?.user_agent
  };

  await auditLogger.logAdminAccess(logData);
};

/**
 * Função helper para log de acesso a recursos
 */
const logResourceAccess = async (resource, action, user, success, req = null) => {
  const logData = {
    action: `${action.toUpperCase()}_${resource.toUpperCase()}`,
    resource,
    user_id: user?.id,
    email: user?.email,
    user_type: user?.user_type,
    success,
    ip: req?.auditInfo?.ip || req?.ip,
    user_agent: req?.auditInfo?.user_agent
  };

  await auditLogger.logResourceAccess(logData);
};

/**
 * Função helper para log de alterações de dados
 */
const logDataChange = async (table, recordId, changes, user, req = null) => {
  const logData = {
    action: 'DATA_CHANGE',
    table,
    record_id: recordId,
    changes,
    user_id: user?.id,
    email: user?.email,
    user_type: user?.user_type,
    ip: req?.auditInfo?.ip || req?.ip,
    user_agent: req?.auditInfo?.user_agent
  };

  await auditLogger.logDataChange(logData);
};

module.exports = {
  auditLogger,
  auditMiddleware,
  logLogin,
  logResourceAccess,
  logDataChange
};
