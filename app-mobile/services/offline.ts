import AsyncStorage from '@react-native-async-storage/async-storage';
import { DraftVistoria, FileUploadQueue, SyncStats } from '@/types';

export class OfflineService {
  private static readonly DRAFT_KEY = 'draft_vistorias';
  private static readonly QUEUE_KEY = 'upload_queue';
  private static readonly STATS_KEY = 'sync_stats';

  // Draft Vistorias Management
  static async saveDraftVistoria(vistoria: DraftVistoria): Promise<void> {
    try {
      const drafts = await this.getDraftVistorias();
      const index = drafts.findIndex(d => d.id === vistoria.id);
      
      if (index >= 0) {
        drafts[index] = vistoria;
      } else {
        drafts.push(vistoria);
      }
      
      await AsyncStorage.setItem(this.DRAFT_KEY, JSON.stringify(drafts));
    } catch (error) {
      console.error('Error saving draft vistoria:', error);
      throw error;
    }
  }

  static async getDraftVistorias(): Promise<DraftVistoria[]> {
    try {
      const data = await AsyncStorage.getItem(this.DRAFT_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting draft vistorias:', error);
      return [];
    }
  }

  static async removeDraftVistoria(id: string): Promise<void> {
    try {
      const drafts = await this.getDraftVistorias();
      const filtered = drafts.filter(d => d.id !== id);
      await AsyncStorage.setItem(this.DRAFT_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing draft vistoria:', error);
      throw error;
    }
  }

  // Upload Queue Management
  static async addToUploadQueue(item: FileUploadQueue): Promise<void> {
    try {
      const queue = await this.getUploadQueue();
      queue.push(item);
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Error adding to upload queue:', error);
      throw error;
    }
  }

  static async getUploadQueue(): Promise<FileUploadQueue[]> {
    try {
      const data = await AsyncStorage.getItem(this.QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting upload queue:', error);
      return [];
    }
  }

  static async updateQueueItem(id: string, updates: Partial<FileUploadQueue>): Promise<void> {
    try {
      const queue = await this.getUploadQueue();
      const index = queue.findIndex(item => item.id === id);
      
      if (index >= 0) {
        queue[index] = { ...queue[index], ...updates };
        await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
      }
    } catch (error) {
      console.error('Error updating queue item:', error);
      throw error;
    }
  }

  static async removeFromQueue(id: string): Promise<void> {
    try {
      const queue = await this.getUploadQueue();
      const filtered = queue.filter(item => item.id !== id);
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing from queue:', error);
      throw error;
    }
  }

  // Sync Stats
  static async updateSyncStats(stats: Partial<SyncStats>): Promise<void> {
    try {
      const currentStats = await this.getSyncStats();
      const updatedStats = { ...currentStats, ...stats };
      await AsyncStorage.setItem(this.STATS_KEY, JSON.stringify(updatedStats));
    } catch (error) {
      console.error('Error updating sync stats:', error);
      throw error;
    }
  }

  static async getSyncStats(): Promise<SyncStats> {
    try {
      const data = await AsyncStorage.getItem(this.STATS_KEY);
      return data ? JSON.parse(data) : {
        pendingPhotos: 0,
        pendingPdfs: 0,
        completedToday: 0,
        averageUploadTime: 0,
      };
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return {
        pendingPhotos: 0,
        pendingPdfs: 0,
        completedToday: 0,
        averageUploadTime: 0,
      };
    }
  }

  /**
   * Salvar dados de relatório para cache offline
   */
  static async saveReportData(reportData: any): Promise<void> {
    try {
      await AsyncStorage.setItem('report_data_cache', JSON.stringify({
        ...reportData,
        cachedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error saving report data:', error);
    }
  }

  /**
   * Obter dados de relatório do cache
   */
  static async getReportData(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem('report_data_cache');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting report data:', error);
      return null;
    }
  }

  /**
   * Obter estatísticas locais para relatórios
   */
  static async getLocalStats(): Promise<any> {
    try {
      // Obter vistorias salvas localmente
       const drafts = await this.getVistoriaDrafts();
       const syncStats = await this.getSyncStats();
       const uploadQueue = await this.getUploadQueue();

      // Calcular estatísticas
      const totalVistorias = drafts.length;
      const vistoriasFinalizadas = drafts.filter(v => v.status === 'finalizada').length;
      const vistoriasEmAndamento = drafts.filter(v => v.status === 'em_andamento').length;
      const vistoriasPendentes = drafts.filter(v => v.status === 'pendente').length;

      // Contar fotos
      let fotosCapturadas = 0;
      drafts.forEach(vistoria => {
        if (vistoria.fotos) {
          fotosCapturadas += vistoria.fotos.length;
        }
      });

      // Contar assinaturas (simulado)
      const assinaturasColetadas = Math.floor(vistoriasFinalizadas * 0.8);

      // Calcular tempo médio (simulado)
      const mediaTempoVistoria = 85; // minutos

      // Calcular porcentagem de sincronização
       const totalItens = uploadQueue.length + syncStats.totalSynced;
       const dadosSincronizados = totalItens > 0 ? Math.round((syncStats.totalSynced / totalItens) * 100) : 100;

      return {
        totalVistorias,
        vistoriasPendentes,
        vistoriasFinalizadas,
        vistoriasEmAndamento,
        mediaTempoVistoria,
        fotosCapturadas,
        assinaturasColetadas,
        dadosSincronizados,
        ultimaAtualizacao: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting local stats:', error);
      return {
        totalVistorias: 0,
        vistoriasPendentes: 0,
        vistoriasFinalizadas: 0,
        vistoriasEmAndamento: 0,
        mediaTempoVistoria: 0,
        fotosCapturadas: 0,
        assinaturasColetadas: 0,
        dadosSincronizados: 0,
        ultimaAtualizacao: new Date().toISOString(),
      };
    }
  }

  // Utility Methods
  static async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([this.DRAFT_KEY, this.QUEUE_KEY, this.STATS_KEY]);
    } catch (error) {
      // Error saving offline data handled silently
    }
  }

  static async getStorageInfo(): Promise<{ used: number; available: number }> {
    try {
      // Calculate actual storage usage from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      let totalUsed = 0;
      
      for (const key of keys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalUsed += new Blob([data]).size;
        }
      }
      
      return {
        used: totalUsed,
        available: 100 * 1024 * 1024, // 100MB available space estimate
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return { used: 0, available: 0 };
    }
  }

  // Sync-specific methods for Grifo API integration
  static async getPendingVistorias(): Promise<any[]> {
    try {
      const drafts = await this.getDraftVistorias();
      return drafts.filter(draft => draft.status === 'pending_sync');
    } catch (error) {
      console.error('Error getting pending vistorias:', error);
      return [];
    }
  }

  static async getPendingProperties(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem('pending_properties');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting pending properties:', error);
      return [];
    }
  }

  static async saveVistoria(vistoria: any): Promise<void> {
    try {
      const vistorias = await AsyncStorage.getItem('synced_vistorias');
      const list = vistorias ? JSON.parse(vistorias) : [];
      
      const index = list.findIndex((v: any) => v.id === vistoria.id);
      if (index >= 0) {
        list[index] = vistoria;
      } else {
        list.push(vistoria);
      }
      
      await AsyncStorage.setItem('synced_vistorias', JSON.stringify(list));
    } catch (error) {
      console.error('Error saving vistoria:', error);
      throw error;
    }
  }

  static async saveProperty(property: any): Promise<void> {
    try {
      const properties = await AsyncStorage.getItem('synced_properties');
      const list = properties ? JSON.parse(properties) : [];
      
      const index = list.findIndex((p: any) => p.id === property.id);
      if (index >= 0) {
        list[index] = property;
      } else {
        list.push(property);
      }
      
      await AsyncStorage.setItem('synced_properties', JSON.stringify(list));
    } catch (error) {
      console.error('Error saving property:', error);
      throw error;
    }
  }

  static async saveNotification(notification: any): Promise<void> {
    try {
      const notifications = await AsyncStorage.getItem('notifications');
      const list = notifications ? JSON.parse(notifications) : [];
      
      const index = list.findIndex((n: any) => n.id === notification.id);
      if (index >= 0) {
        list[index] = notification;
      } else {
        list.push(notification);
      }
      
      await AsyncStorage.setItem('notifications', JSON.stringify(list));
    } catch (error) {
      console.error('Error saving notification:', error);
      throw error;
    }
  }

  static async getNotifications(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem('notifications');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }
}