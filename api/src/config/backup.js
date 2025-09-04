/**
 * Sistema de Backup Automático e Disaster Recovery
 * Implementa backup do Supabase, replicação e estratégias de DR
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class BackupService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.backupDir = path.join(process.cwd(), 'backups');
    this.maxBackups = 30; // Manter 30 backups
    
    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      console.warn('⚠️ Supabase credentials not configured for backup service');
      return;
    }
    
    this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);
    this.initBackupDirectory();
  }

  /**
   * Inicializa diretório de backup
   */
  async initBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log('✅ Backup directory initialized');
    } catch (error) {
      console.error('❌ Failed to create backup directory:', error.message);
    }
  }

  /**
   * Executa backup completo do banco de dados
   */
  async createFullBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `full_backup_${timestamp}.json`);
    
    try {
      console.log('🔄 Starting full database backup...');
      
      const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        tables: {}
      };

      // Lista de tabelas principais para backup
      const tables = [
        'empresas',
        'app_users', 
        'portal_users',
        'imoveis',
        'vistorias',
        'fotos',
        'itens_vistoria',
        'contestacoes',
        'notifications',
        'vistoria_assignments',
        'user_google_tokens',
        'user_onedrive_tokens',
        'cloud_sync_settings'
      ];

      // Backup de cada tabela
      for (const table of tables) {
        try {
          console.log(`📋 Backing up table: ${table}`);
          
          const { data, error } = await this.supabase
            .from(table)
            .select('*');
            
          if (error) {
            console.error(`❌ Error backing up ${table}:`, error.message);
            backup.tables[table] = { error: error.message, count: 0 };
          } else {
            backup.tables[table] = { 
              data: data || [], 
              count: data?.length || 0 
            };
            console.log(`✅ ${table}: ${data?.length || 0} records`);
          }
        } catch (tableError) {
          console.error(`❌ Exception backing up ${table}:`, tableError.message);
          backup.tables[table] = { error: tableError.message, count: 0 };
        }
      }

      // Salva backup em arquivo
      await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));
      
      const stats = await fs.stat(backupFile);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`✅ Full backup completed: ${backupFile} (${sizeInMB}MB)`);
      
      // Limpa backups antigos
      await this.cleanOldBackups();
      
      return {
        success: true,
        file: backupFile,
        size: sizeInMB + 'MB',
        tables: Object.keys(backup.tables).length,
        records: Object.values(backup.tables).reduce((sum, table) => sum + (table.count || 0), 0)
      };
      
    } catch (error) {
      console.error('❌ Full backup failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Executa backup incremental (apenas dados modificados)
   */
  async createIncrementalBackup(since = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `incremental_backup_${timestamp}.json`);
    
    try {
      console.log('🔄 Starting incremental backup...');
      
      const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Últimas 24h
      const backup = {
        timestamp: new Date().toISOString(),
        type: 'incremental',
        since: sinceDate.toISOString(),
        version: '1.0',
        tables: {}
      };

      // Tabelas com timestamp para backup incremental
      const tablesWithTimestamp = [
        { name: 'vistorias', field: 'updated_at' },
        { name: 'fotos', field: 'created_at' },
        { name: 'itens_vistoria', field: 'updated_at' },
        { name: 'contestacoes', field: 'created_at' },
        { name: 'notifications', field: 'created_at' }
      ];

      for (const { name, field } of tablesWithTimestamp) {
        try {
          const { data, error } = await this.supabase
            .from(name)
            .select('*')
            .gte(field, sinceDate.toISOString());
            
          if (error) {
            backup.tables[name] = { error: error.message, count: 0 };
          } else {
            backup.tables[name] = { 
              data: data || [], 
              count: data?.length || 0 
            };
            console.log(`✅ ${name}: ${data?.length || 0} new/updated records`);
          }
        } catch (tableError) {
          backup.tables[name] = { error: tableError.message, count: 0 };
        }
      }

      await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));
      
      const stats = await fs.stat(backupFile);
      const sizeInKB = (stats.size / 1024).toFixed(2);
      
      console.log(`✅ Incremental backup completed: ${backupFile} (${sizeInKB}KB)`);
      
      return {
        success: true,
        file: backupFile,
        size: sizeInKB + 'KB',
        records: Object.values(backup.tables).reduce((sum, table) => sum + (table.count || 0), 0)
      };
      
    } catch (error) {
      console.error('❌ Incremental backup failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restaura backup do banco de dados
   */
  async restoreBackup(backupFile) {
    try {
      console.log(`🔄 Starting restore from: ${backupFile}`);
      
      const backupData = JSON.parse(await fs.readFile(backupFile, 'utf8'));
      const results = {};
      
      for (const [tableName, tableData] of Object.entries(backupData.tables)) {
        if (tableData.error || !tableData.data) {
          results[tableName] = { skipped: true, reason: tableData.error || 'No data' };
          continue;
        }
        
        try {
          // ATENÇÃO: Isso vai SUBSTITUIR todos os dados da tabela!
          // Em produção, considere estratégias mais seguras
          console.log(`📋 Restoring table: ${tableName}`);
          
          // Para restauração segura, você pode implementar:
          // 1. Backup da tabela atual antes de restaurar
          // 2. Restauração em tabela temporária
          // 3. Validação dos dados antes de aplicar
          
          const { error } = await this.supabase
            .from(tableName)
            .upsert(tableData.data, { onConflict: 'id' });
            
          if (error) {
            results[tableName] = { success: false, error: error.message };
          } else {
            results[tableName] = { success: true, records: tableData.data.length };
          }
        } catch (tableError) {
          results[tableName] = { success: false, error: tableError.message };
        }
      }
      
      console.log('✅ Restore completed');
      return { success: true, results };
      
    } catch (error) {
      console.error('❌ Restore failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Lista backups disponíveis
   */
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          
          backups.push({
            file,
            path: filePath,
            size: (stats.size / (1024 * 1024)).toFixed(2) + 'MB',
            created: stats.birthtime,
            type: file.includes('incremental') ? 'incremental' : 'full'
          });
        }
      }
      
      return backups.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('❌ Error listing backups:', error.message);
      return [];
    }
  }

  /**
   * Remove backups antigos
   */
  async cleanOldBackups() {
    try {
      const backups = await this.listBackups();
      
      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(this.maxBackups);
        
        for (const backup of toDelete) {
          await fs.unlink(backup.path);
          console.log(`🗑️ Deleted old backup: ${backup.file}`);
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning old backups:', error.message);
    }
  }

  /**
   * Verifica integridade do backup
   */
  async verifyBackup(backupFile) {
    try {
      const backupData = JSON.parse(await fs.readFile(backupFile, 'utf8'));
      const issues = [];
      
      // Verifica estrutura básica
      if (!backupData.timestamp) issues.push('Missing timestamp');
      if (!backupData.tables) issues.push('Missing tables data');
      
      // Verifica cada tabela
      for (const [tableName, tableData] of Object.entries(backupData.tables)) {
        if (tableData.error) {
          issues.push(`Table ${tableName} has error: ${tableData.error}`);
        } else if (!Array.isArray(tableData.data)) {
          issues.push(`Table ${tableName} data is not an array`);
        }
      }
      
      return {
        valid: issues.length === 0,
        issues,
        tables: Object.keys(backupData.tables).length,
        totalRecords: Object.values(backupData.tables)
          .reduce((sum, table) => sum + (table.count || 0), 0)
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Failed to parse backup file: ${error.message}`]
      };
    }
  }

  /**
   * Agenda backups automáticos
   */
  scheduleAutomaticBackups() {
    // Backup completo diário às 2:00 AM
    const scheduleFullBackup = () => {
      const now = new Date();
      const next2AM = new Date(now);
      next2AM.setHours(2, 0, 0, 0);
      
      if (next2AM <= now) {
        next2AM.setDate(next2AM.getDate() + 1);
      }
      
      const msUntil2AM = next2AM.getTime() - now.getTime();
      
      setTimeout(async () => {
        await this.createFullBackup();
        scheduleFullBackup(); // Reagenda para o próximo dia
      }, msUntil2AM);
      
      console.log(`📅 Next full backup scheduled for: ${next2AM.toLocaleString()}`);
    };
    
    // Backup incremental a cada 6 horas
    const scheduleIncrementalBackup = () => {
      setInterval(async () => {
        await this.createIncrementalBackup();
      }, 6 * 60 * 60 * 1000); // 6 horas
    };
    
    if (process.env.NODE_ENV === 'production') {
      scheduleFullBackup();
      scheduleIncrementalBackup();
      console.log('✅ Automatic backups scheduled');
    } else {
      console.log('ℹ️ Automatic backups disabled in development mode');
    }
  }
}

// Instância singleton do serviço de backup
const backupService = new BackupService();

// Inicia agendamento automático
if (process.env.ENABLE_AUTO_BACKUP === 'true') {
  backupService.scheduleAutomaticBackups();
}

module.exports = {
  backupService
};