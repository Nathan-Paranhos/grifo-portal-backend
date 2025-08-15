import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Cloud,
  CloudOff,
  Download,
  Upload,
  Sync,
  CheckCircle,
  Settings,
  FileText,
  Image as ImageIcon,
} from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/colors';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernCard } from '@/components/ui/ModernCard';
import { ModernLoadingSpinner } from '@/components/ui/ModernLoadingSpinner';
import { ModernToast } from '@/components/ui/ModernToast';
import { oneDriveService } from '@/services/oneDriveService';

interface OneDriveConnection {
  isConnected: boolean;
  userEmail?: string;
  lastSync?: string;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  totalFiles?: number;
  syncedFiles?: number;
}

interface SyncStats {
  vistorias: number;
  photos: number;
  reports: number;
  lastSyncDate: string;
}

export default function OneDriveScreen() {
  const [connection, setConnection] = useState<OneDriveConnection>({
    isConnected: false,
    syncStatus: 'idle',
  });
  const [syncStats, setSyncStats] = useState<SyncStats>({
    vistorias: 0,
    photos: 0,
    reports: 0,
    lastSyncDate: 'Nunca',
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as any });

  useEffect(() => {
    loadConnectionStatus();
  }, []);

  const loadConnectionStatus = async () => {
    try {
      setLoading(true);
      const connectionData = await AsyncStorage.getItem('onedrive_connection');
      const statsData = await AsyncStorage.getItem('onedrive_sync_stats');
      
      if (connectionData) {
        setConnection(JSON.parse(connectionData));
      }
      
      if (statsData) {
        setSyncStats(JSON.parse(statsData));
      }
    } catch (error) {
      // Error loading connection status handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnection(prev => ({ ...prev, syncStatus: 'syncing' }));
      
      const result = await oneDriveService.authenticate();
      
      if (result.success) {
        const user = await oneDriveService.getCurrentUser();
        
        const newConnection: OneDriveConnection = {
          isConnected: true,
          userEmail: user?.mail || 'usuario@exemplo.com',
          lastSync: new Date().toISOString(),
          syncStatus: 'success',
          totalFiles: 0,
          syncedFiles: 0,
        };
        
        setConnection(newConnection);
        await AsyncStorage.setItem('onedrive_connection', JSON.stringify(newConnection));
        
        showToast('Conectado ao OneDrive com sucesso!', 'success');
      } else {
        setConnection(prev => ({ ...prev, syncStatus: 'error' }));
        showToast(result.error || 'Erro ao conectar com OneDrive', 'error');
      }
    } catch (err) {
      setConnection(prev => ({ ...prev, syncStatus: 'error' }));
      // Error connecting to OneDrive handled silently
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Desconectar OneDrive',
      'Tem certeza que deseja desconectar sua conta do OneDrive? Isso não afetará os arquivos já sincronizados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            await oneDriveService.disconnect();
            
            const newConnection: OneDriveConnection = {
              isConnected: false,
              syncStatus: 'idle',
            };
            
            setConnection(newConnection);
            setSyncStats({
              vistorias: 0,
              photos: 0,
              reports: 0,
              lastSyncDate: 'Nunca',
            });
            showToast('Desconectado do OneDrive', 'info');
          },
        },
      ]
    );
  };

  const handleSync = async () => {
    if (!connection.isConnected) return;
    
    try {
      setConnection(prev => ({ ...prev, syncStatus: 'syncing' }));
      
      const syncResult = await oneDriveService.fullSync();
      
      if (syncResult.success) {
        const newStats: SyncStats = {
          vistorias: syncResult.vistoriasResult.uploadedFiles,
          photos: syncResult.photosResult.uploadedFiles,
          reports: syncResult.vistoriasResult.uploadedFiles, // Relatórios são baseados nas vistorias
          lastSyncDate: new Date().toLocaleString('pt-BR'),
        };
        
        setSyncStats(newStats);
        await AsyncStorage.setItem('onedrive_sync_stats', JSON.stringify(newStats));
        
        setConnection(prev => ({
          ...prev,
          syncStatus: 'success',
          lastSync: new Date().toISOString(),
          totalFiles: newStats.vistorias + newStats.photos + newStats.reports,
          syncedFiles: newStats.vistorias + newStats.photos + newStats.reports,
        }));
        
        showToast(
          `Sincronização concluída! ${newStats.vistorias} vistorias e ${newStats.photos} fotos sincronizadas.`,
          'success'
        );
      } else {
        setConnection(prev => ({ ...prev, syncStatus: 'error' }));
        
        const allErrors = [
          ...syncResult.vistoriasResult.errors,
          ...syncResult.photosResult.errors,
        ];
        
        showToast(
          `Sincronização parcial. ${allErrors.length} erros encontrados.`,
          'warning'
        );
        
        // Ainda atualizar as estatísticas com o que foi sincronizado
        const newStats: SyncStats = {
          vistorias: syncResult.vistoriasResult.uploadedFiles,
          photos: syncResult.photosResult.uploadedFiles,
          reports: syncResult.vistoriasResult.uploadedFiles,
          lastSyncDate: new Date().toLocaleString('pt-BR'),
        };
        
        setSyncStats(newStats);
        await AsyncStorage.setItem('onedrive_sync_stats', JSON.stringify(newStats));
      }
    } catch (err) {
      setConnection(prev => ({ ...prev, syncStatus: 'error' }));
      // Error during synchronization handled silently
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConnectionStatus();
    setRefreshing(false);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ModernLoadingSpinner
            variant="gradient"
            size="large"
            text="Carregando configurações do OneDrive..."
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.background, colors.surface]}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Cloud size={32} color={colors.accent} />
            </View>
            <Text style={styles.title}>OneDrive</Text>
            <Text style={styles.subtitle}>
              Sincronize suas vistorias e fotos com a nuvem
            </Text>
          </View>

          {/* Connection Status */}
          <ModernCard variant="elevated" style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusIcon}>
                {connection.isConnected ? (
                  <CheckCircle size={24} color={colors.success} />
                ) : (
                  <CloudOff size={24} color={colors.textMuted} />
                )}
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>
                  {connection.isConnected ? 'Conectado' : 'Desconectado'}
                </Text>
                {connection.userEmail && (
                  <Text style={styles.statusEmail}>{connection.userEmail}</Text>
                )}
              </View>
            </View>

            {connection.isConnected ? (
              <View style={styles.connectionActions}>
                <ModernButton
                  title="Sincronizar"
                  onPress={handleSync}
                  variant="primary"
                  size="medium"
                  icon={Sync}
                  loading={connection.syncStatus === 'syncing'}
                  style={styles.actionButton}
                />
                <ModernButton
                  title="Desconectar"
                  onPress={handleDisconnect}
                  variant="outline"
                  size="medium"
                  style={styles.actionButton}
                />
              </View>
            ) : (
              <ModernButton
                title="Conectar ao OneDrive"
                onPress={handleConnect}
                variant="primary"
                size="large"
                icon={Cloud}
                loading={connection.syncStatus === 'syncing'}
                fullWidth
              />
            )}
          </ModernCard>

          {/* Sync Statistics */}
          {connection.isConnected && (
            <ModernCard variant="elevated" style={styles.statsCard}>
              <Text style={styles.sectionTitle}>Estatísticas de Sincronização</Text>
              
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <FileText size={20} color={colors.accent} />
                  <Text style={styles.statNumber}>{syncStats.vistorias}</Text>
                  <Text style={styles.statLabel}>Vistorias</Text>
                </View>
                
                <View style={styles.statItem}>
                  <ImageIcon size={20} color={colors.success} />
                  <Text style={styles.statNumber}>{syncStats.photos}</Text>
                  <Text style={styles.statLabel}>Fotos</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Download size={20} color={colors.info} />
                  <Text style={styles.statNumber}>{syncStats.reports}</Text>
                  <Text style={styles.statLabel}>Relatórios</Text>
                </View>
              </View>
              
              <View style={styles.lastSync}>
                <Text style={styles.lastSyncLabel}>Última sincronização:</Text>
                <Text style={styles.lastSyncDate}>{syncStats.lastSyncDate}</Text>
              </View>
            </ModernCard>
          )}

          {/* Features */}
          <ModernCard variant="elevated" style={styles.featuresCard}>
            <Text style={styles.sectionTitle}>Recursos do OneDrive</Text>
            
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Upload size={20} color={colors.accent} />
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Backup Automático</Text>
                  <Text style={styles.featureDescription}>
                    Suas vistorias e fotos são automaticamente enviadas para a nuvem
                  </Text>
                </View>
              </View>
              
              <View style={styles.featureItem}>
                <Sync size={20} color={colors.success} />
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Sincronização em Tempo Real</Text>
                  <Text style={styles.featureDescription}>
                    Acesse seus dados de qualquer dispositivo conectado
                  </Text>
                </View>
              </View>
              
              <View style={styles.featureItem}>
                <Settings size={20} color={colors.info} />
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Configuração Flexível</Text>
                  <Text style={styles.featureDescription}>
                    Escolha quais tipos de arquivo sincronizar
                  </Text>
                </View>
              </View>
            </View>
          </ModernCard>
        </ScrollView>
      </LinearGradient>

      <ModernToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.xxxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statusCard: {
    marginBottom: spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusIcon: {
    marginRight: spacing.md,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  statusEmail: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  connectionActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  statsCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  lastSync: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lastSyncLabel: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  lastSyncDate: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textPrimary,
  },
  featuresCard: {
    marginBottom: spacing.lg,
  },
  featuresList: {
    gap: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  featureTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  featureDescription: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});