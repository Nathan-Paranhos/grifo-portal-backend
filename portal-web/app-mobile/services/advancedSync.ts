import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { OfflineService } from './offline';
import { SyncService } from './sync';
import { SupabaseService } from './supabase';
import grifoApiService from './grifoApi';
import { DraftVistoria, FileUploadQueue } from '@/types';

export interface SyncConflict {
  id: string;
  type: 'vistoria' | 'property' | 'photo';
  localData: any;
  remoteData: any;
  conflictFields: string[];
  timestamp: string;
}

export interface SyncStrategy {
  priority: 'local' | 'remote' | 'merge' | 'manual';
  batchSize: number;
  retryAttempts: number;
  syncInterval: number;
  backgroundSync: boolean;
}

export interface SyncMetrics {
  totalSynced: number;
  totalFailed: number;
  averageTime: number;
  lastSyncTime: string;
  conflictsResolved: number;
  dataTransferred: number;
}

export class AdvancedSyncService {
  private static readonly CONFLICTS_KEY = 'sync_conflicts';
  private static readonly METRICS_KEY = 'sync_metrics';
  private static readonly STRATEGY_KEY = 'sync_strategy';
  private static readonly CACHE_KEY = 'sync_cache';
  
  private static isProcessing = false;
  private static syncTimer: NodeJS.Timeout | null = null;
  private static networkListener: any = null;

  /**
   * Inicializa o serviço de sincronização avançado
   */
  static async initialize(): Promise<void> {
    try {
      // Configurar estratégia padrão
      const strategy = await this.getSyncStrategy();
      if (!strategy.priority) {
        await this.setSyncStrategy({
          priority: 'merge',
          batchSize: 10,
          retryAttempts: 3,
          syncInterval: 300000, // 5 minutos
          backgroundSync: true,
        });
      }

      // Configurar listener de rede
      this.setupNetworkListener();

      // Iniciar sincronização em background se habilitada
      if (strategy.backgroundSync) {
        this.startBackgroundSync();
      }

      console.log('Advanced Sync Service initialized');
    } catch (error) {
      console.error('Error initializing Advanced Sync Service:', error);
    }
  }

  /**
   * Sincronização inteligente com resolução de conflitos
   */
  static async intelligentSync(): Promise<{
    success: boolean;
    conflicts: SyncConflict[];
    metrics: SyncMetrics;
  }> {
    if (this.isProcessing) {
      return {
        success: false,
        conflicts: [],
        metrics: await this.getSyncMetrics(),
      };
    }

    const startTime = Date.now();
    this.isProcessing = true;
    const conflicts: SyncConflict[] = [];
    let totalSynced = 0;
    let totalFailed = 0;

    try {
      // Verificar conectividade
      const networkStatus = await SyncService.getNetworkStatus();
      if (!networkStatus.isConnected) {
        throw new Error('No network connection available');
      }

      const strategy = await this.getSyncStrategy();

      // 1. Sincronizar dados locais pendentes
      const localSyncResult = await this.syncLocalData(strategy);
      totalSynced += localSyncResult.synced;
      totalFailed += localSyncResult.failed;
      conflicts.push(...localSyncResult.conflicts);

      // 2. Sincronizar dados remotos
      const remoteSyncResult = await this.syncRemoteData(strategy);
      totalSynced += remoteSyncResult.synced;
      totalFailed += remoteSyncResult.failed;
      conflicts.push(...remoteSyncResult.conflicts);

      // 3. Processar fila de upload
      const uploadResult = await this.processUploadQueueAdvanced(strategy);
      totalSynced += uploadResult.synced;
      totalFailed += uploadResult.failed;

      // 4. Atualizar métricas
      const syncTime = Date.now() - startTime;
      await this.updateSyncMetrics({
        totalSynced,
        totalFailed,
        averageTime: syncTime,
        lastSyncTime: new Date().toISOString(),
        conflictsResolved: conflicts.length,
        dataTransferred: this.calculateDataTransferred(totalSynced),
      });

      // 5. Salvar conflitos para resolução manual
      if (conflicts.length > 0) {
        await this.saveConflicts(conflicts);
      }

      console.log(`Intelligent sync completed: ${totalSynced} synced, ${totalFailed} failed, ${conflicts.length} conflicts`);

      return {
        success: totalFailed === 0,
        conflicts,
        metrics: await this.getSyncMetrics(),
      };

    } catch (error) {
      console.error('Intelligent sync error:', error);
      return {
        success: false,
        conflicts,
        metrics: await this.getSyncMetrics(),
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Sincronizar dados locais com resolução de conflitos
   */
  private static async syncLocalData(strategy: SyncStrategy): Promise<{
    synced: number;
    failed: number;
    conflicts: SyncConflict[];
  }> {
    const conflicts: SyncConflict[] = [];
    let synced = 0;
    let failed = 0;

    try {
      // Sincronizar vistorias pendentes
      const pendingVistorias = await OfflineService.getPendingVistorias();
      
      for (const vistoria of pendingVistorias.slice(0, strategy.batchSize)) {
        try {
          // Verificar se existe versão remota
          const remoteVistoria = await SupabaseService.getVistoria(vistoria.id);
          
          if (remoteVistoria && this.hasConflict(vistoria, remoteVistoria)) {
            // Detectar conflito
            const conflict: SyncConflict = {
              id: vistoria.id,
              type: 'vistoria',
              localData: vistoria,
              remoteData: remoteVistoria,
              conflictFields: this.getConflictFields(vistoria, remoteVistoria),
              timestamp: new Date().toISOString(),
            };
            conflicts.push(conflict);

            // Resolver conflito baseado na estratégia
            const resolvedData = await this.resolveConflict(conflict, strategy.priority);
            if (resolvedData) {
              await SupabaseService.updateVistoria(vistoria.id, resolvedData);
              synced++;
            }
          } else {
            // Sem conflito, sincronizar normalmente
            await SupabaseService.updateVistoria(vistoria.id, vistoria);
            synced++;
          }
        } catch (error) {
          console.error(`Error syncing vistoria ${vistoria.id}:`, error);
          failed++;
        }
      }

      return { synced, failed, conflicts };
    } catch (error) {
      console.error('Error syncing local data:', error);
      return { synced, failed, conflicts };
    }
  }

  /**
   * Sincronizar dados remotos
   */
  private static async syncRemoteData(strategy: SyncStrategy): Promise<{
    synced: number;
    failed: number;
    conflicts: SyncConflict[];
  }> {
    const conflicts: SyncConflict[] = [];
    let synced = 0;
    let failed = 0;

    try {
      // Obter dados remotos atualizados
      const remoteData = await grifoApiService.getSyncData();
      
      if (remoteData.success && remoteData.data) {
        // Processar vistorias remotas
        if (remoteData.data.inspections) {
          for (const inspection of remoteData.data.inspections.slice(0, strategy.batchSize)) {
            try {
              const localVistoria = await this.getLocalVistoria(inspection.id);
              
              if (localVistoria && this.hasConflict(localVistoria, inspection)) {
                const conflict: SyncConflict = {
                  id: inspection.id,
                  type: 'vistoria',
                  localData: localVistoria,
                  remoteData: inspection,
                  conflictFields: this.getConflictFields(localVistoria, inspection),
                  timestamp: new Date().toISOString(),
                };
                conflicts.push(conflict);

                const resolvedData = await this.resolveConflict(conflict, strategy.priority);
                if (resolvedData) {
                  await OfflineService.saveVistoria(resolvedData);
                  synced++;
                }
              } else {
                await OfflineService.saveVistoria(inspection);
                synced++;
              }
            } catch (error) {
              console.error(`Error syncing remote inspection ${inspection.id}:`, error);
              failed++;
            }
          }
        }
      }

      return { synced, failed, conflicts };
    } catch (error) {
      console.error('Error syncing remote data:', error);
      return { synced, failed, conflicts };
    }
  }

  /**
   * Processar fila de upload com retry inteligente
   */
  private static async processUploadQueueAdvanced(strategy: SyncStrategy): Promise<{
    synced: number;
    failed: number;
  }> {
    let synced = 0;
    let failed = 0;

    try {
      const queue = await OfflineService.getUploadQueue();
      const pendingItems = queue.filter(item => 
        item.pending && item.try_count < strategy.retryAttempts
      ).slice(0, strategy.batchSize);

      for (const item of pendingItems) {
        let retryCount = 0;
        let success = false;

        while (retryCount < strategy.retryAttempts && !success) {
          try {
            // Implementar backoff exponencial
            if (retryCount > 0) {
              const delay = Math.pow(2, retryCount) * 1000;
              await new Promise(resolve => setTimeout(resolve, delay));
            }

            await SyncService.startSync();
            success = true;
            synced++;
          } catch (error) {
            retryCount++;
            console.error(`Upload attempt ${retryCount} failed for ${item.id}:`, error);
          }
        }

        if (!success) {
          failed++;
        }
      }

      return { synced, failed };
    } catch (error) {
      console.error('Error processing upload queue:', error);
      return { synced, failed };
    }
  }

  /**
   * Detectar conflitos entre dados locais e remotos
   */
  private static hasConflict(localData: any, remoteData: any): boolean {
    if (!localData || !remoteData) return false;

    const localTimestamp = new Date(localData.updated_at || localData.created_at);
    const remoteTimestamp = new Date(remoteData.updated_at || remoteData.created_at);

    // Considerar conflito se ambos foram modificados e têm diferenças
    return Math.abs(localTimestamp.getTime() - remoteTimestamp.getTime()) < 60000 && // Dentro de 1 minuto
           JSON.stringify(localData) !== JSON.stringify(remoteData);
  }

  /**
   * Identificar campos em conflito
   */
  private static getConflictFields(localData: any, remoteData: any): string[] {
    const conflicts: string[] = [];
    const localKeys = Object.keys(localData);
    const remoteKeys = Object.keys(remoteData);
    const allKeys = [...new Set([...localKeys, ...remoteKeys])];

    for (const key of allKeys) {
      if (JSON.stringify(localData[key]) !== JSON.stringify(remoteData[key])) {
        conflicts.push(key);
      }
    }

    return conflicts;
  }

  /**
   * Resolver conflitos baseado na estratégia
   */
  private static async resolveConflict(
    conflict: SyncConflict, 
    priority: 'local' | 'remote' | 'merge' | 'manual'
  ): Promise<any | null> {
    switch (priority) {
      case 'local':
        return conflict.localData;
      
      case 'remote':
        return conflict.remoteData;
      
      case 'merge':
        return this.mergeData(conflict.localData, conflict.remoteData);
      
      case 'manual':
        // Salvar para resolução manual posterior
        return null;
      
      default:
        return conflict.remoteData; // Fallback para remoto
    }
  }

  /**
   * Mesclar dados em conflito
   */
  private static mergeData(localData: any, remoteData: any): any {
    const merged = { ...remoteData };
    
    // Priorizar dados locais mais recentes
    const localTimestamp = new Date(localData.updated_at || localData.created_at);
    const remoteTimestamp = new Date(remoteData.updated_at || remoteData.created_at);
    
    if (localTimestamp > remoteTimestamp) {
      // Manter campos específicos do local se mais recentes
      merged.status = localData.status || remoteData.status;
      merged.observacoes = localData.observacoes || remoteData.observacoes;
      merged.fotos = [...(localData.fotos || []), ...(remoteData.fotos || [])];
    }
    
    merged.updated_at = new Date().toISOString();
    return merged;
  }

  /**
   * Configurar listener de rede para sincronização automática
   */
  private static setupNetworkListener(): void {
    this.networkListener = NetInfo.addEventListener(state => {
      if (state.isConnected && !this.isProcessing) {
        console.log('Network connected, starting automatic sync...');
        this.intelligentSync().catch(error => {
          console.error('Automatic sync failed:', error);
        });
      }
    });
  }

  /**
   * Iniciar sincronização em background
   */
  private static startBackgroundSync(): void {
    this.stopBackgroundSync(); // Limpar timer anterior
    
    const strategy = this.getSyncStrategy();
    strategy.then(config => {
      this.syncTimer = setInterval(() => {
        if (!this.isProcessing) {
          this.intelligentSync().catch(error => {
            console.error('Background sync failed:', error);
          });
        }
      }, config.syncInterval);
    });
  }

  /**
   * Parar sincronização em background
   */
  private static stopBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Limpar recursos
   */
  static cleanup(): void {
    this.stopBackgroundSync();
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }
  }

  // Métodos de configuração e dados
  static async getSyncStrategy(): Promise<SyncStrategy> {
    try {
      const data = await AsyncStorage.getItem(this.STRATEGY_KEY);
      return data ? JSON.parse(data) : {
        priority: 'merge',
        batchSize: 10,
        retryAttempts: 3,
        syncInterval: 300000,
        backgroundSync: true,
      };
    } catch (error) {
      console.error('Error getting sync strategy:', error);
      return {
        priority: 'merge',
        batchSize: 10,
        retryAttempts: 3,
        syncInterval: 300000,
        backgroundSync: true,
      };
    }
  }

  static async setSyncStrategy(strategy: SyncStrategy): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STRATEGY_KEY, JSON.stringify(strategy));
      
      // Reiniciar background sync se necessário
      if (strategy.backgroundSync) {
        this.startBackgroundSync();
      } else {
        this.stopBackgroundSync();
      }
    } catch (error) {
      console.error('Error setting sync strategy:', error);
    }
  }

  static async getSyncMetrics(): Promise<SyncMetrics> {
    try {
      const data = await AsyncStorage.getItem(this.METRICS_KEY);
      return data ? JSON.parse(data) : {
        totalSynced: 0,
        totalFailed: 0,
        averageTime: 0,
        lastSyncTime: '',
        conflictsResolved: 0,
        dataTransferred: 0,
      };
    } catch (error) {
      console.error('Error getting sync metrics:', error);
      return {
        totalSynced: 0,
        totalFailed: 0,
        averageTime: 0,
        lastSyncTime: '',
        conflictsResolved: 0,
        dataTransferred: 0,
      };
    }
  }

  private static async updateSyncMetrics(metrics: Partial<SyncMetrics>): Promise<void> {
    try {
      const current = await this.getSyncMetrics();
      const updated = { ...current, ...metrics };
      await AsyncStorage.setItem(this.METRICS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating sync metrics:', error);
    }
  }

  static async getConflicts(): Promise<SyncConflict[]> {
    try {
      const data = await AsyncStorage.getItem(this.CONFLICTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting conflicts:', error);
      return [];
    }
  }

  private static async saveConflicts(conflicts: SyncConflict[]): Promise<void> {
    try {
      const existing = await this.getConflicts();
      const updated = [...existing, ...conflicts];
      await AsyncStorage.setItem(this.CONFLICTS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving conflicts:', error);
    }
  }

  static async resolveConflictManually(conflictId: string, resolution: any): Promise<void> {
    try {
      const conflicts = await this.getConflicts();
      const updatedConflicts = conflicts.filter(c => c.id !== conflictId);
      await AsyncStorage.setItem(this.CONFLICTS_KEY, JSON.stringify(updatedConflicts));
      
      // Aplicar resolução
      const conflict = conflicts.find(c => c.id === conflictId);
      if (conflict) {
        if (conflict.type === 'vistoria') {
          await SupabaseService.updateVistoria(conflictId, resolution);
          await OfflineService.saveVistoria(resolution);
        }
      }
    } catch (error) {
      console.error('Error resolving conflict manually:', error);
    }
  }

  private static async getLocalVistoria(id: string): Promise<any | null> {
    try {
      const drafts = await OfflineService.getDraftVistorias();
      return drafts.find(d => d.id === id) || null;
    } catch (error) {
      console.error('Error getting local vistoria:', error);
      return null;
    }
  }

  private static calculateDataTransferred(itemCount: number): number {
    // Estimativa aproximada de dados transferidos (em KB)
    return itemCount * 50; // ~50KB por item em média
  }
}