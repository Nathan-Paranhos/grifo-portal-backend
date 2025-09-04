import { useState, useEffect, useCallback } from 'react';
import { AdvancedSyncService, SyncConflict, SyncStrategy, SyncMetrics } from '@/services/advancedSync';
import { SyncService } from '@/services/sync';
import NetInfo from '@react-native-community/netinfo';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingItems: number;
  conflicts: SyncConflict[];
  metrics: SyncMetrics;
  error: string | null;
}

export const useAdvancedSync = () => {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: false,
    isSyncing: false,
    lastSyncTime: null,
    pendingItems: 0,
    conflicts: [],
    metrics: {
      totalSynced: 0,
      totalFailed: 0,
      averageTime: 0,
      lastSyncTime: '',
      conflictsResolved: 0,
      dataTransferred: 0,
    },
    error: null,
  });

  const [strategy, setStrategyState] = useState<SyncStrategy>({
    priority: 'merge',
    batchSize: 10,
    retryAttempts: 3,
    syncInterval: 300000,
    backgroundSync: true,
  });

  /**
   * Inicializar o hook
   */
  useEffect(() => {
    initializeSync();
    setupNetworkListener();
    loadInitialData();

    return () => {
      AdvancedSyncService.cleanup();
    };
  }, []);

  /**
   * Inicializar serviço de sincronização
   */
  const initializeSync = async () => {
    try {
      await AdvancedSyncService.initialize();
      console.log('Advanced sync initialized');
    } catch (error) {
      console.error('Error initializing advanced sync:', error);
      setStatus(prev => ({ ...prev, error: 'Erro ao inicializar sincronização' }));
    }
  };

  /**
   * Configurar listener de rede
   */
  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setStatus(prev => ({ ...prev, isOnline: state.isConnected || false }));
    });

    return unsubscribe;
  };

  /**
   * Carregar dados iniciais
   */
  const loadInitialData = async () => {
    try {
      const [currentStrategy, conflicts, metrics, networkStatus] = await Promise.all([
        AdvancedSyncService.getSyncStrategy(),
        AdvancedSyncService.getConflicts(),
        AdvancedSyncService.getSyncMetrics(),
        SyncService.getNetworkStatus(),
      ]);

      setStrategyState(currentStrategy);
      setStatus(prev => ({
        ...prev,
        isOnline: networkStatus.isConnected,
        conflicts,
        metrics,
        lastSyncTime: metrics.lastSyncTime || null,
      }));
    } catch (error) {
      console.error('Error loading initial data:', error);
      setStatus(prev => ({ ...prev, error: 'Erro ao carregar dados iniciais' }));
    }
  };

  /**
   * Executar sincronização inteligente
   */
  const performSync = useCallback(async () => {
    if (status.isSyncing) return;

    setStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const result = await AdvancedSyncService.intelligentSync();
      
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        conflicts: result.conflicts,
        metrics: result.metrics,
        lastSyncTime: result.metrics.lastSyncTime,
        error: result.success ? null : 'Sincronização parcialmente falhada',
      }));

      return result;
    } catch (error) {
      console.error('Sync error:', error);
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: 'Erro durante sincronização',
      }));
      throw error;
    }
  }, [status.isSyncing]);

  /**
   * Atualizar estratégia de sincronização
   */
  const updateStrategy = useCallback(async (newStrategy: Partial<SyncStrategy>) => {
    try {
      const updatedStrategy = { ...strategy, ...newStrategy };
      await AdvancedSyncService.setSyncStrategy(updatedStrategy);
      setStrategyState(updatedStrategy);
    } catch (error) {
      console.error('Error updating strategy:', error);
      setStatus(prev => ({ ...prev, error: 'Erro ao atualizar estratégia' }));
    }
  }, [strategy]);

  /**
   * Resolver conflito manualmente
   */
  const resolveConflict = useCallback(async (conflictId: string, resolution: any) => {
    try {
      await AdvancedSyncService.resolveConflictManually(conflictId, resolution);
      
      // Atualizar lista de conflitos
      const updatedConflicts = await AdvancedSyncService.getConflicts();
      setStatus(prev => ({ ...prev, conflicts: updatedConflicts }));
      
      return true;
    } catch (error) {
      console.error('Error resolving conflict:', error);
      setStatus(prev => ({ ...prev, error: 'Erro ao resolver conflito' }));
      return false;
    }
  }, []);

  /**
   * Obter estatísticas de sincronização
   */
  const refreshMetrics = useCallback(async () => {
    try {
      const metrics = await AdvancedSyncService.getSyncMetrics();
      setStatus(prev => ({ ...prev, metrics }));
      return metrics;
    } catch (error) {
      console.error('Error refreshing metrics:', error);
      return null;
    }
  }, []);

  /**
   * Limpar dados de sincronização
   */
  const clearSyncData = useCallback(async () => {
    try {
      // Implementar limpeza se necessário
      await refreshMetrics();
      setStatus(prev => ({ ...prev, error: null }));
    } catch (error) {
      console.error('Error clearing sync data:', error);
      setStatus(prev => ({ ...prev, error: 'Erro ao limpar dados' }));
    }
  }, [refreshMetrics]);

  /**
   * Verificar se há sincronização pendente
   */
  const checkPendingSync = useCallback(async () => {
    try {
      // Implementar verificação de itens pendentes
      // Por enquanto, retorna 0
      return 0;
    } catch (error) {
      console.error('Error checking pending sync:', error);
      return 0;
    }
  }, []);

  /**
   * Forçar sincronização completa
   */
  const forceFullSync = useCallback(async () => {
    if (status.isSyncing) return;

    setStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      // Primeiro executar sincronização básica
      await SyncService.startSync();
      
      // Depois executar sincronização avançada
      const result = await AdvancedSyncService.intelligentSync();
      
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        conflicts: result.conflicts,
        metrics: result.metrics,
        lastSyncTime: result.metrics.lastSyncTime,
        error: result.success ? null : 'Sincronização completa parcialmente falhada',
      }));

      return result;
    } catch (error) {
      console.error('Force sync error:', error);
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: 'Erro durante sincronização completa',
      }));
      throw error;
    }
  }, [status.isSyncing]);

  /**
   * Obter resumo do status de sincronização
   */
  const getSyncSummary = useCallback(() => {
    const { metrics, conflicts, isOnline, isSyncing } = status;
    
    return {
      isHealthy: isOnline && !isSyncing && conflicts.length === 0,
      totalItems: metrics.totalSynced + metrics.totalFailed,
      successRate: metrics.totalSynced > 0 
        ? (metrics.totalSynced / (metrics.totalSynced + metrics.totalFailed)) * 100 
        : 0,
      hasConflicts: conflicts.length > 0,
      lastSyncAgo: metrics.lastSyncTime 
        ? Math.floor((Date.now() - new Date(metrics.lastSyncTime).getTime()) / 1000 / 60) 
        : null,
    };
  }, [status]);

  return {
    // Estado
    status,
    strategy,
    
    // Ações
    performSync,
    forceFullSync,
    updateStrategy,
    resolveConflict,
    refreshMetrics,
    clearSyncData,
    checkPendingSync,
    
    // Utilitários
    getSyncSummary,
    
    // Estados derivados
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    hasConflicts: status.conflicts.length > 0,
    hasError: !!status.error,
  };
};