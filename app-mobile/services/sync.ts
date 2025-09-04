import { OfflineService } from './offline';
import { StorageService } from './storage';
import { SupabaseService } from './supabase';
import grifoApiService from './grifoApi';
import { FileUploadQueue } from '@/types';
import NetInfo from '@react-native-community/netinfo';

export class SyncService {
  private static isProcessing = false;

  static async startSync(): Promise<void> {
    if (this.isProcessing) return;
    
    try {
      this.isProcessing = true;
      
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('No network connection, sync skipped');
        return;
      }

      console.log('Starting sync process...');
      
      // Sync with Grifo API first
      await this.syncWithGrifoApi();
      
      // Process upload queue
      await this.processUploadQueue();
      
      // Update sync stats
      await this.updateStats();
      
      console.log('Sync completed successfully');
    } catch (error) {
      // Error syncing data handled silently
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  private static async processUploadQueue(): Promise<void> {
    const queue = await OfflineService.getUploadQueue();
    const pendingItems = queue.filter(item => item.pending && item.try_count < 3);
    
    for (const item of pendingItems) {
      try {
        console.log(`Processing upload: ${item.id}`);
        
        await OfflineService.updateQueueItem(item.id, { 
          try_count: item.try_count + 1 
        });
        
        let uploadedUrl: string;
        
        if (item.type === 'photo') {
          uploadedUrl = await StorageService.uploadPhoto(
            item.local_path,
            item.storage_path
          );
        } else {
          uploadedUrl = await StorageService.uploadPdf(
            item.local_path,
            item.storage_path
          );
        }
        
        // Mark as completed
        await OfflineService.updateQueueItem(item.id, { 
          pending: false 
        });
        
        // If this is a PDF upload, update the vistoria record and send to portal
        if (item.type === 'pdf') {
          await SupabaseService.updateVistoria(item.vistoria_id, {
            pdf_url: uploadedUrl,
            status: 'finalizada',
          });
          
          // Send vistoria to portal after finalizing
          try {
            await SupabaseService.sendVistoriaToPortal(item.vistoria_id, uploadedUrl);
            console.log(`Vistoria ${item.vistoria_id} sent to portal successfully`);
          } catch (portalError) {
            console.error(`Failed to send vistoria ${item.vistoria_id} to portal:`, portalError);
            // Don't fail the entire sync process if portal send fails
          }
        }
        
        console.log(`Upload completed: ${item.id}`);
        
      } catch (error) {
        // Error uploading pending data handled silently
        
        // Mark as failed if max retries reached
        if (item.try_count >= 2) {
          await OfflineService.updateQueueItem(item.id, { 
            pending: false 
          });
        }
      }
    }
  }

  private static async updateStats(): Promise<void> {
    const queue = await OfflineService.getUploadQueue();
    const pendingPhotos = queue.filter(item => item.pending && item.type === 'photo').length;
    const pendingPdfs = queue.filter(item => item.pending && item.type === 'pdf').length;
    
    await OfflineService.updateSyncStats({
      pendingPhotos,
      pendingPdfs,
    });
  }

  static async queuePhotoUpload(
    vistoriaId: string, 
    localPath: string, 
    fileName: string
  ): Promise<void> {
    const storagePath = StorageService.generateStoragePath('photo', vistoriaId, fileName);
    
    const queueItem: FileUploadQueue = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      local_path: localPath,
      storage_path: storagePath,
      type: 'photo',
      vistoria_id: vistoriaId,
      try_count: 0,
      pending: true,
      created_at: new Date().toISOString(),
    };
    
    await OfflineService.addToUploadQueue(queueItem);
  }

  static async queuePdfUpload(
    vistoriaId: string, 
    localPath: string, 
    fileName: string
  ): Promise<void> {
    const storagePath = StorageService.generateStoragePath('pdf', vistoriaId, fileName);
    
    const queueItem: FileUploadQueue = {
      id: `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      local_path: localPath,
      storage_path: storagePath,
      type: 'pdf',
      vistoria_id: vistoriaId,
      try_count: 0,
      pending: true,
      created_at: new Date().toISOString(),
    };
    
    await OfflineService.addToUploadQueue(queueItem);
  }

  private static async syncWithGrifoApi(): Promise<void> {
    try {
      console.log('Syncing with Grifo API...');
      
      // Get local data to sync
      const localData = await this.getLocalDataForSync();
      
      if (localData.inspections?.length || localData.properties?.length) {
        // Send local data to API
        const syncResponse = await grifoApiService.sendSyncData(localData);
        
        if (syncResponse.success) {
          console.log('Local data synced to Grifo API successfully');
        } else {
          console.error('Failed to sync local data:', syncResponse.error);
        }
      }
      
      // Get updated data from API
      const remoteData = await grifoApiService.getSyncData();
      
      if (remoteData.success && remoteData.data) {
        await this.processRemoteData(remoteData.data);
        console.log('Remote data synced from Grifo API successfully');
      } else {
        console.error('Failed to get remote data:', remoteData.error);
      }
      
    } catch (error) {
      console.error('Grifo API sync error:', error);
      // Don't throw - allow fallback to Supabase sync
    }
  }

  private static async getLocalDataForSync(): Promise<any> {
    try {
      // Get pending vistorias and other local data
      const pendingVistorias = await OfflineService.getPendingVistorias();
      const pendingProperties = await OfflineService.getPendingProperties();
      
      return {
        inspections: pendingVistorias || [],
        properties: pendingProperties || [],
        lastSync: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting local data for sync:', error);
      return { inspections: [], properties: [] };
    }
  }

  private static async processRemoteData(data: any): Promise<void> {
    try {
      // Process inspections from API
      if (data.inspections?.length) {
        for (const inspection of data.inspections) {
          await OfflineService.saveVistoria({
            id: inspection.id,
            imovel_id: inspection.property_id,
            usuario_id: inspection.user_id,
            status: inspection.status,
            data: inspection.data,
            fotos: inspection.photos || [],
            created_at: inspection.created_at,
            updated_at: inspection.updated_at,
          });
        }
      }
      
      // Process properties from API
      if (data.properties?.length) {
        for (const property of data.properties) {
          await OfflineService.saveProperty({
            id: property.id,
            endereco: property.address,
            tipo: property.type,
            cep: property.cep,
            cidade: property.city,
            estado: property.state,
            empresa_id: property.company_id,
            referencia: property.reference,
            created_at: property.created_at,
            updated_at: property.updated_at,
          });
        }
      }
      
      // Process notifications
      if (data.notifications?.length) {
        for (const notification of data.notifications) {
          await OfflineService.saveNotification(notification);
        }
      }
      
    } catch (error) {
      console.error('Error processing remote data:', error);
    }
  }

  static async getNetworkStatus(): Promise<{ isConnected: boolean; type: string | null }> {
    const netInfo = await NetInfo.fetch();
    return {
      isConnected: netInfo.isConnected || false,
      type: netInfo.type,
    };
  }
}