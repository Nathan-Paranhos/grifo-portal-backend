import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdvancedSync } from '@/hooks/useAdvancedSync';
import { SyncConflict } from '@/services/advancedSync';

interface SyncStatusProps {
  showDetails?: boolean;
  onPress?: () => void;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({ 
  showDetails = false, 
  onPress 
}) => {
  const {
    status,
    strategy,
    performSync,
    forceFullSync,
    resolveConflict,
    refreshMetrics,
    getSyncSummary,
    isOnline,
    isSyncing,
    hasConflicts,
    hasError,
  } = useAdvancedSync();

  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const summary = getSyncSummary();

  /**
   * Obter cor do status
   */
  const getStatusColor = () => {
    if (!isOnline) return '#f59e0b'; // amber
    if (hasError) return '#ef4444'; // red
    if (hasConflicts) return '#f59e0b'; // amber
    if (isSyncing) return '#3b82f6'; // blue
    return '#10b981'; // green
  };

  /**
   * Obter ícone do status
   */
  const getStatusIcon = () => {
    if (!isOnline) return 'cloud-offline-outline';
    if (hasError) return 'alert-circle-outline';
    if (hasConflicts) return 'warning-outline';
    if (isSyncing) return 'sync-outline';
    return 'checkmark-circle-outline';
  };

  /**
   * Obter texto do status
   */
  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (hasError) return 'Erro';
    if (hasConflicts) return `${status.conflicts.length} conflitos`;
    if (isSyncing) return 'Sincronizando...';
    return 'Sincronizado';
  };

  /**
   * Executar sincronização
   */
  const handleSync = async () => {
    try {
      await performSync();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao sincronizar dados');
    }
  };

  /**
   * Executar sincronização completa
   */
  const handleFullSync = async () => {
    Alert.alert(
      'Sincronização Completa',
      'Isso pode demorar alguns minutos. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: async () => {
            try {
              await forceFullSync();
            } catch (error) {
              Alert.alert('Erro', 'Falha na sincronização completa');
            }
          },
        },
      ]
    );
  };

  /**
   * Resolver conflito
   */
  const handleResolveConflict = (conflict: SyncConflict) => {
    Alert.alert(
      'Resolver Conflito',
      `Conflito em ${conflict.tableName}\n\nEscolha a versão a manter:`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Versão Local',
          onPress: () => resolveConflict(conflict.id, conflict.localData),
        },
        {
          text: 'Versão Remota',
          onPress: () => resolveConflict(conflict.id, conflict.remoteData),
        },
      ]
    );
  };

  /**
   * Atualizar métricas
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshMetrics();
    } catch (error) {
      console.error('Error refreshing metrics:', error);
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Formatar tempo
   */
  const formatTime = (minutes: number | null) => {
    if (minutes === null) return 'Nunca';
    if (minutes < 1) return 'Agora mesmo';
    if (minutes < 60) return `${minutes}min atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  /**
   * Renderizar status compacto
   */
  const renderCompactStatus = () => (
    <TouchableOpacity
      style={[styles.compactContainer, { borderColor: getStatusColor() }]}
      onPress={onPress || (() => setShowModal(true))}
      disabled={isSyncing}
    >
      <Ionicons
        name={getStatusIcon() as any}
        size={16}
        color={getStatusColor()}
        style={isSyncing ? styles.spinning : undefined}
      />
      <Text style={[styles.compactText, { color: getStatusColor() }]}>
        {getStatusText()}
      </Text>
      {hasConflicts && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{status.conflicts.length}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  /**
   * Renderizar status detalhado
   */
  const renderDetailedStatus = () => (
    <View style={styles.detailedContainer}>
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <Ionicons
            name={getStatusIcon() as any}
            size={24}
            color={getStatusColor()}
            style={isSyncing ? styles.spinning : undefined}
          />
          <Text style={[styles.statusTitle, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.syncButton, { opacity: isSyncing ? 0.5 : 1 }]}
          onPress={handleSync}
          disabled={isSyncing || !isOnline}
        >
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text style={styles.syncButtonText}>Sincronizar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metricsContainer}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{status.metrics.totalSynced}</Text>
          <Text style={styles.metricLabel}>Sincronizados</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{status.metrics.totalFailed}</Text>
          <Text style={styles.metricLabel}>Falharam</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{summary.successRate.toFixed(0)}%</Text>
          <Text style={styles.metricLabel}>Taxa Sucesso</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{formatTime(summary.lastSyncAgo)}</Text>
          <Text style={styles.metricLabel}>Última Sync</Text>
        </View>
      </View>

      {hasConflicts && (
        <View style={styles.conflictsContainer}>
          <Text style={styles.conflictsTitle}>Conflitos Pendentes</Text>
          {status.conflicts.slice(0, 3).map((conflict) => (
            <TouchableOpacity
              key={conflict.id}
              style={styles.conflictItem}
              onPress={() => handleResolveConflict(conflict)}
            >
              <Ionicons name="warning-outline" size={16} color="#f59e0b" />
              <Text style={styles.conflictText}>
                {conflict.tableName} - {conflict.field}
              </Text>
              <Ionicons name="chevron-forward-outline" size={16} color="#6b7280" />
            </TouchableOpacity>
          ))}
          {status.conflicts.length > 3 && (
            <Text style={styles.moreConflicts}>
              +{status.conflicts.length - 3} mais conflitos
            </Text>
          )}
        </View>
      )}

      {hasError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{status.error}</Text>
        </View>
      )}
    </View>
  );

  /**
   * Renderizar modal detalhado
   */
  const renderModal = () => (
    <Modal
      visible={showModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Status de Sincronização</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowModal(false)}
          >
            <Ionicons name="close-outline" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {renderDetailedStatus()}

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.fullSyncButton]}
              onPress={handleFullSync}
              disabled={isSyncing || !isOnline}
            >
              <Ionicons name="cloud-download-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Sincronização Completa</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.strategyContainer}>
            <Text style={styles.sectionTitle}>Configurações</Text>
            <View style={styles.strategyItem}>
              <Text style={styles.strategyLabel}>Prioridade:</Text>
              <Text style={styles.strategyValue}>{strategy.priority}</Text>
            </View>
            <View style={styles.strategyItem}>
              <Text style={styles.strategyLabel}>Tamanho do Lote:</Text>
              <Text style={styles.strategyValue}>{strategy.batchSize}</Text>
            </View>
            <View style={styles.strategyItem}>
              <Text style={styles.strategyLabel}>Tentativas:</Text>
              <Text style={styles.strategyValue}>{strategy.retryAttempts}</Text>
            </View>
            <View style={styles.strategyItem}>
              <Text style={styles.strategyLabel}>Intervalo:</Text>
              <Text style={styles.strategyValue}>
                {Math.floor(strategy.syncInterval / 1000 / 60)}min
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  if (showDetails) {
    return (
      <View>
        {renderDetailedStatus()}
        {renderModal()}
      </View>
    );
  }

  return (
    <View>
      {renderCompactStatus()}
      {renderModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#f9fafb',
  },
  compactText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  badge: {
    marginLeft: 6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  detailedContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '600',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  conflictsContainer: {
    marginBottom: 16,
  },
  conflictsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  conflictItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    marginBottom: 4,
  },
  conflictText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#92400e',
  },
  moreConflicts: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#dc2626',
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  actionsContainer: {
    margin: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  fullSyncButton: {
    backgroundColor: '#059669',
  },
  actionButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  strategyContainer: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  strategyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  strategyLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  strategyValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  spinning: {
    // Animação de rotação seria implementada com Animated
  },
});