import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SupabaseService } from '@/services/supabase';
import { OfflineService } from '@/services/offline';
import { SyncService } from '@/services/sync';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { colors, typography, spacing, borderRadius } from '@/constants/colors';
import { SyncStats, User } from '@/types';
import { FileText, Upload, Clock, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Camera } from 'lucide-react-native';

export default function DashboardScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Verificar se há usuário autenticado
      const currentUser = await SupabaseService.getCurrentUser();
      
      if (!currentUser) {
        // No authenticated user found
        setUser(null);
        setStats(null);
        return;
      }
      
      setUser(currentUser as any);
      
      // Carregar estatísticas locais
      const syncStats = await OfflineService.getSyncStats();
      setStats(syncStats);
      
      // Tentar carregar KPIs do dashboard se houver empresa_id
      if (currentUser.user_metadata?.empresa_id) {
        try {
          const dashboardData = await SupabaseService.getDashboardKPIs(currentUser.user_metadata.empresa_id);
          // Dashboard KPIs loaded successfully
        } catch (kpiError) {
          // Could not load dashboard KPIs
        }
      }
      
    } catch (error) {
      // Error loading dashboard data
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await SyncService.startSync();
      await loadData(); // Refresh stats after sync
    } catch (error) {
      // Sync error handled silently
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Carregando dashboard..." />;
  }

  const hasPendingUploads = (stats?.pendingPhotos || 0) + (stats?.pendingPdfs || 0) > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Olá, {user?.nome || 'Vistoriador'}</Text>
          <Text style={styles.subtitle}>Bem-vindo ao seu dashboard</Text>
        </View>

        {/* Sync Status */}
        {hasPendingUploads && (
          <Card style={styles.syncCard}>
            <View style={styles.syncHeader}>
              <AlertCircle size={20} color={colors.warning} />
              <Text style={styles.syncTitle}>Sincronização Pendente</Text>
            </View>
            <Text style={styles.syncText}>
              {stats?.pendingPhotos || 0} fotos e {stats?.pendingPdfs || 0} PDFs aguardando upload
            </Text>
            <Button
              title={syncing ? "Sincronizando..." : "Sincronizar Agora"}
              onPress={handleSync}
              loading={syncing}
              size="sm"
              style={styles.syncButton}
            />
          </Card>
        )}

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <View style={styles.statIcon}>
              <CheckCircle size={24} color={colors.success} />
            </View>
            <Text style={styles.statNumber}>{stats?.completedToday || 0}</Text>
            <Text style={styles.statLabel}>Finalizadas Hoje</Text>
          </Card>

          <Card style={styles.statCard}>
            <View style={styles.statIcon}>
              <Upload size={24} color={colors.primary} />
            </View>
            <Text style={styles.statNumber}>{stats?.pendingPhotos || 0}</Text>
            <Text style={styles.statLabel}>Fotos Pendentes</Text>
          </Card>

          <Card style={styles.statCard}>
            <View style={styles.statIcon}>
              <FileText size={24} color={colors.info} />
            </View>
            <Text style={styles.statNumber}>{stats?.pendingPdfs || 0}</Text>
            <Text style={styles.statLabel}>PDFs Pendentes</Text>
          </Card>

          <Card style={styles.statCard}>
            <View style={styles.statIcon}>
              <Clock size={24} color={colors.warning} />
            </View>
            <Text style={styles.statNumber}>{Math.round(stats?.averageUploadTime || 0)}s</Text>
            <Text style={styles.statLabel}>Tempo Médio</Text>
          </Card>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          
          <TouchableOpacity style={styles.actionCard}>
            <Camera size={24} color={colors.primary} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Nova Vistoria</Text>
              <Text style={styles.actionSubtitle}>Iniciar wizard de vistoria</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <FileText size={24} color={colors.info} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Vistorias Recentes</Text>
              <Text style={styles.actionSubtitle}>Ver histórico e relatórios</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
  },
  syncCard: {
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.warning,
    marginBottom: spacing.lg,
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  syncTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.warning,
  },
  syncText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  syncButton: {
    alignSelf: 'flex-start',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: spacing.lg,
  },
  statIcon: {
    marginBottom: spacing.sm,
  },
  statNumber: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
  quickActions: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  actionTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  actionSubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
  },
});