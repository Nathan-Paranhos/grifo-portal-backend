const { supabase } = require('../config/supabase.js');
const { AppError } = require('./errorHandler.js');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Sistema de versionamento de arquivos
 * Mantém histórico de versões e permite rollback
 */
class FileVersioningService {
  constructor() {
    this.maxVersionsPerFile = 10; // Máximo de versões por arquivo
  }

  /**
   * Calcula hash MD5 do arquivo para detectar mudanças
   */
  calculateFileHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Verifica se já existe uma versão com o mesmo hash
   */
  async checkDuplicateVersion(relatedId, uploadType, fileHash) {
    try {
      const { data, error } = await supabase
        .from('file_versions')
        .select('id, version_number, file_hash')
        .eq('related_id', relatedId)
        .eq('upload_type', uploadType)
        .eq('file_hash', fileHash)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data; // Retorna a versão existente ou null
    } catch (error) {
      console.error('Erro ao verificar versão duplicada:', error);
      return null;
    }
  }

  /**
   * Obtém o próximo número de versão para um arquivo
   */
  async getNextVersionNumber(relatedId, uploadType, originalName) {
    try {
      const { data, error } = await supabase
        .from('file_versions')
        .select('version_number')
        .eq('related_id', relatedId)
        .eq('upload_type', uploadType)
        .eq('original_name', originalName)
        .order('version_number', { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      return data && data.length > 0 ? data[0].version_number + 1 : 1;
    } catch (error) {
      console.error('Erro ao obter próximo número de versão:', error);
      return 1;
    }
  }

  /**
   * Cria uma nova versão do arquivo
   */
  async createFileVersion(fileData, buffer, user) {
    try {
      const fileHash = this.calculateFileHash(buffer);
      const {
        id: fileId,
        filename,
        original_name: originalName,
        file_size: fileSize,
        mime_type: mimeType,
        storage_path: storagePath,
        public_url: publicUrl,
        upload_type: uploadType,
        related_id: relatedId,
        description
      } = fileData;

      // Verificar se já existe uma versão com o mesmo hash
      const existingVersion = await this.checkDuplicateVersion(relatedId, uploadType, fileHash);
      if (existingVersion) {
        console.log(`Arquivo idêntico já existe - Versão ${existingVersion.version_number}`);
        return {
          isDuplicate: true,
          existingVersion,
          message: `Arquivo idêntico já existe na versão ${existingVersion.version_number}`
        };
      }

      // Obter próximo número de versão
      const versionNumber = await this.getNextVersionNumber(relatedId, uploadType, originalName);

      // Criar registro da versão
      const versionData = {
        id: uuidv4(),
        file_id: fileId,
        version_number: versionNumber,
        file_hash: fileHash,
        filename,
        original_name: originalName,
        file_size: fileSize,
        mime_type: mimeType,
        storage_path: storagePath,
        public_url: publicUrl,
        upload_type: uploadType,
        related_id: relatedId,
        description,
        company_id: user.company_id,
        created_by: user.id,
        is_active: true,
        change_reason: versionNumber === 1 ? 'Versão inicial' : 'Nova versão'
      };

      const { data: versionRecord, error: versionError } = await supabase
        .from('file_versions')
        .insert(versionData)
        .select()
        .single();

      if (versionError) {
        throw versionError;
      }

      // Limpar versões antigas se exceder o limite
      await this.cleanupOldVersions(relatedId, uploadType, originalName);

      console.log(`Nova versão criada: ${originalName} v${versionNumber}`);
      
      return {
        isDuplicate: false,
        version: versionRecord,
        message: `Nova versão ${versionNumber} criada com sucesso`
      };
    } catch (error) {
      console.error('Erro ao criar versão do arquivo:', error);
      throw new AppError('Erro ao criar versão do arquivo');
    }
  }

  /**
   * Remove versões antigas mantendo apenas as mais recentes
   */
  async cleanupOldVersions(relatedId, uploadType, originalName) {
    try {
      // Buscar todas as versões ordenadas por número de versão (mais recente primeiro)
      const { data: versions, error } = await supabase
        .from('file_versions')
        .select('id, version_number, storage_path')
        .eq('related_id', relatedId)
        .eq('upload_type', uploadType)
        .eq('original_name', originalName)
        .eq('is_active', true)
        .order('version_number', { ascending: false });

      if (error) {
        throw error;
      }

      if (versions.length > this.maxVersionsPerFile) {
        const versionsToRemove = versions.slice(this.maxVersionsPerFile);
        
        for (const version of versionsToRemove) {
          // Marcar como inativa no banco
          await supabase
            .from('file_versions')
            .update({ is_active: false, deleted_at: new Date().toISOString() })
            .eq('id', version.id);

          // Remover do storage (opcional - pode manter para auditoria)
          // await supabase.storage.from('uploads').remove([version.storage_path]);
          
          console.log(`Versão antiga removida: v${version.version_number}`);
        }
      }
    } catch (error) {
      console.error('Erro ao limpar versões antigas:', error);
      // Não falhar o upload por causa da limpeza
    }
  }

  /**
   * Lista todas as versões de um arquivo
   */
  async getFileVersions(relatedId, uploadType, originalName) {
    try {
      const { data, error } = await supabase
        .from('file_versions')
        .select(`
          id,
          version_number,
          file_hash,
          filename,
          original_name,
          file_size,
          mime_type,
          public_url,
          description,
          change_reason,
          created_at,
          created_by,
          is_active
        `)
        .eq('related_id', relatedId)
        .eq('upload_type', uploadType)
        .eq('original_name', originalName)
        .eq('is_active', true)
        .order('version_number', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar versões do arquivo:', error);
      throw new AppError('Erro ao buscar versões do arquivo');
    }
  }

  /**
   * Restaura uma versão específica como a versão atual
   */
  async restoreVersion(versionId, user) {
    try {
      // Buscar dados da versão
      const { data: version, error: versionError } = await supabase
        .from('file_versions')
        .select('*')
        .eq('id', versionId)
        .eq('is_active', true)
        .single();

      if (versionError || !version) {
        throw new AppError('Versão não encontrada');
      }

      // Criar nova versão baseada na versão restaurada
      const nextVersion = await this.getNextVersionNumber(
        version.related_id,
        version.upload_type,
        version.original_name
      );

      const restoredVersionData = {
        ...version,
        id: uuidv4(),
        version_number: nextVersion,
        created_by: user.id,
        created_at: new Date().toISOString(),
        change_reason: `Restaurado da versão ${version.version_number}`
      };

      delete restoredVersionData.updated_at;
      delete restoredVersionData.deleted_at;

      const { data: newVersion, error: createError } = await supabase
        .from('file_versions')
        .insert(restoredVersionData)
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      console.log(`Versão ${version.version_number} restaurada como v${nextVersion}`);
      
      return newVersion;
    } catch (error) {
      console.error('Erro ao restaurar versão:', error);
      throw new AppError('Erro ao restaurar versão do arquivo');
    }
  }

  /**
   * Middleware para versionamento automático
   */
  middleware() {
    return async (req, res, next) => {
      try {
        // Adicionar serviço de versionamento ao request
        req.fileVersioning = this;
        next();
      } catch (error) {
        console.error('Erro no middleware de versionamento:', error);
        next(error);
      }
    };
  }
}

// Instância singleton
const fileVersioningService = new FileVersioningService();

module.exports = {
  FileVersioningService,
  fileVersioningService,
  fileVersioningMiddleware: fileVersioningService.middleware()
};