import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  RefreshControl
} from 'react-native';
import { useSignature } from '@/hooks/useSignature';
import { SignatureData } from '@/services/signatureService';
import { Card } from '@/components/ui/Card';
import { SignatureViewer } from '@/components/SignatureViewer';
import { colors, typography, spacing } from '@/constants/colors';
import {
  PenTool,
  User,
  Calendar,
  Shield,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  WifiOff,
  RefreshCw
} from 'lucide-react-native';

export interface SignatureListProps {
  vistoriaId: string;
  onSignaturePress?: (signature: SignatureData) => void;
  showActions?: boolean;
}

export function SignatureList({
  vistoriaId,
  onSignaturePress,
  showActions = true
}: SignatureListProps) {
  const {
    signatures,
    isLoading,
    error,
    isOnline,
    loadSignatures,
    deleteSignature,
    syncSignatures,
    clearError,
    refreshSignatures
  } = useSignature();
  
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState<SignatureData | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);

  useEffect(() => {
    if (vistoriaId) {
      loadSignatures(vistoriaId);
    }
  }, [vistoriaId, loadSignatures]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSignatures(vistoriaId);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSync = async () => {
    if (!isOnline) {
      Alert.alert('Sem Conexão', 'Conecte-se à internet para sincronizar as assinaturas.');
      return;
    }

    setSyncing(true);
    try {
      const result = await syncSignatures();
      
      if (result.synced > 0) {
        Alert.alert(
          'Sincronização Concluída',
          `${result.synced} assinatura(s) sincronizada(s) com sucesso.`
        );
        await refreshSignatures(vistoriaId);
      } else {
        Alert.alert('Sincronização', 'Nenhuma assinatura pendente para sincronizar.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteSignature = (signature: SignatureData) => {
    Alert.alert(
      'Excluir Assinatura',
      `Tem certeza que deseja excluir a assinatura de ${signature.nome_assinante}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            if (signature.id) {
              await deleteSignature(signature.id);
            }
          }
        }
      ]
    );
  };

  const handleViewSignature = (signature: SignatureData) => {
    setSelectedSignature(signature);
    setViewerVisible(true);
    onSignaturePress?.(signature);
  };

  const handleCloseViewer = () => {
    setViewerVisible(false);
    setSelectedSignature(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'vistoriador':
        return 'Vistoriador';
      case 'cliente':
        return 'Cliente';
      case 'testemunha':
        return 'Testemunha';
      default:
        return tipo;
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'vistoriador':
        return colors.primary;
      case 'cliente':
        return colors.success;
      case 'testemunha':
        return colors.info;
      default:
        return colors.textMuted;
    }
  };

  const isLocalSignature = (signature: SignatureData) => {
    return signature.id?.startsWith('local_') || !signature.id;
  };

  if (error) {
    return (
      <Card style={styles.errorCard}>
        <View style={styles.errorContent}>
          <AlertCircle size={24} color={colors.danger} />
          <View style={styles.errorTextContainer}>
            <Text style={styles.errorTitle}>Erro ao Carregar Assinaturas</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            clearError();
            loadSignatures(vistoriaId);
          }}
        >
          <RefreshCw size={16} color={colors.primary} />
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <PenTool size={20} color={colors.primary} />
          <Text style={styles.headerTitle}>Assinaturas Digitais</Text>
          {!isOnline && (
            <View style={styles.offlineIndicator}>
              <WifiOff size={16} color={colors.warning} />
            </View>
          )}
        </View>
        
        {showActions && (
          <View style={styles.headerActions}>
            {!isOnline && signatures.some(s => isLocalSignature(s)) && (
              <TouchableOpacity
                style={[styles.syncButton, syncing && styles.disabledButton]}
                onPress={handleSync}
                disabled={syncing || !isOnline}
              >
                <RefreshCw size={16} color={isOnline ? colors.primary : colors.textMuted} />
                <Text style={[styles.syncButtonText, !isOnline && styles.disabledText]}>
                  {syncing ? 'Sincronizando...' : 'Sincronizar'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Lista de Assinaturas */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {signatures.length === 0 ? (
          <Card style={styles.emptyCard}>
            <PenTool size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhuma Assinatura</Text>
            <Text style={styles.emptyMessage}>
              {isLoading ? 'Carregando assinaturas...' : 'Ainda não há assinaturas coletadas para esta vistoria.'}
            </Text>
          </Card>
        ) : (
          signatures.map((signature, index) => (
            <Card key={signature.id || index} style={styles.signatureCard}>
              {/* Status da Assinatura */}
              <View style={styles.signatureHeader}>
                <View style={styles.signatureInfo}>
                  <View style={styles.tipoContainer}>
                    <View style={[styles.tipoBadge, { backgroundColor: getTipoColor(signature.tipo) + '20' }]}>
                      <Text style={[styles.tipoText, { color: getTipoColor(signature.tipo) }]}>
                        {getTipoLabel(signature.tipo)}
                      </Text>
                    </View>
                    
                    {isLocalSignature(signature) ? (
                      <View style={styles.statusBadge}>
                        <WifiOff size={12} color={colors.warning} />
                        <Text style={styles.statusText}>Local</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, styles.syncedBadge]}>
                        <CheckCircle size={12} color={colors.success} />
                        <Text style={[styles.statusText, styles.syncedText]}>Sincronizada</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Informações do Assinante */}
              <View style={styles.signerInfo}>
                <View style={styles.signerRow}>
                  <User size={16} color={colors.textSecondary} />
                  <Text style={styles.signerName}>{signature.nome_assinante}</Text>
                </View>
                
                {signature.cpf_assinante && (
                  <View style={styles.signerRow}>
                    <Shield size={16} color={colors.textSecondary} />
                    <Text style={styles.signerCpf}>CPF: {signature.cpf_assinante}</Text>
                  </View>
                )}
                
                <View style={styles.signerRow}>
                  <Calendar size={16} color={colors.textSecondary} />
                  <Text style={styles.signatureDate}>
                    {formatDate(signature.data_assinatura)}
                  </Text>
                </View>
              </View>

              {/* Preview da Assinatura */}
              <View style={styles.signaturePreview}>
                <Image
                  source={{ uri: signature.assinatura_base64 }}
                  style={styles.signatureImage}
                  resizeMode="contain"
                />
              </View>

              {/* Ações */}
              {showActions && (
                <View style={styles.signatureActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleViewSignature(signature)}
                  >
                    <Eye size={16} color={colors.info} />
                    <Text style={styles.actionButtonText}>Visualizar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteSignature(signature)}
                  >
                    <Trash2 size={16} color={colors.danger} />
                    <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
      
      {/* Visualizador de Assinatura */}
      <SignatureViewer
        signature={selectedSignature}
        visible={viewerVisible}
        onClose={handleCloseViewer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  offlineIndicator: {
    marginLeft: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
  },
  syncButtonText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledText: {
    color: colors.textMuted,
  },
  list: {
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyMessage: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  signatureCard: {
    marginBottom: spacing.md,
  },
  signatureHeader: {
    marginBottom: spacing.md,
  },
  signatureInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tipoContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tipoBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  tipoText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.semibold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.warningLight,
  },
  syncedBadge: {
    backgroundColor: colors.successLight,
  },
  statusText: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.warning,
  },
  syncedText: {
    color: colors.success,
  },
  signerInfo: {
    marginBottom: spacing.md,
  },
  signerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  signerName: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  signerCpf: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  signatureDate: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  signaturePreview: {
    height: 80,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  signatureImage: {
    width: '100%',
    height: '100%',
  },
  signatureActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteButton: {
    borderColor: colors.dangerLight,
    backgroundColor: colors.dangerLight,
  },
  actionButtonText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.info,
  },
  deleteButtonText: {
    color: colors.danger,
  },
  errorCard: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
    borderWidth: 1,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  errorTextContainer: {
    flex: 1,
  },
  errorTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  errorMessage: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.danger,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retryButtonText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
});