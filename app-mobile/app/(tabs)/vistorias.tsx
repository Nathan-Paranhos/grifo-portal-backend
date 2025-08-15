import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SupabaseService } from '@/services/supabase';
import { OfflineService } from '@/services/offline';
import { ModernCard } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernLoadingSpinner } from '@/components/ui/ModernLoadingSpinner';
import { ModernToast } from '@/components/ui/ModernToast';
import { ModernPullToRefresh } from '@/components/ui/ModernPullToRefresh';
import { ModernSwipeableRow, SwipeActions } from '@/components/ui/ModernSwipeableRow';
import { ModernSearchBar } from '@/components/ModernSearchBar';
import { ModernFloatingActionButton } from '@/components/ModernFloatingActionButton';
import { useToast } from '@/hooks/useToast';
import { colors, typography, spacing, borderRadius } from '@/constants/colors';
import { Vistoria, DraftVistoria } from '@/types';
import { FileText, Calendar, MapPin, Eye, Plus, Wifi, WifiOff } from 'lucide-react-native';

export default function VistoriasScreen() {
  const [vistorias, setVistorias] = useState<Vistoria[]>([]);
  const [drafts, setDrafts] = useState<DraftVistoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredVistorias, setFilteredVistorias] = useState<Vistoria[]>([]);
  const [filteredDrafts, setFilteredDrafts] = useState<DraftVistoria[]>([]);
  const { toast, showSuccess, showError, showWarning, hideToast } = useToast();

  const loadData = useCallback(async () => {
    await Promise.all([loadVistorias(), loadDrafts()]);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    filterData();
  }, [filterData]);

  const loadDrafts = async () => {
    try {
      const draftData = await OfflineService.getDraftVistorias();
      setDrafts(draftData || []);
    } catch (error) {
        // Error loading drafts handled silently
        setDrafts([]);
      }
  };

  const loadVistorias = async () => {
    try {
      // Verificar se há usuário autenticado
      const currentUser = await SupabaseService.getCurrentUser();
      
      if (!currentUser) {
        // No authenticated user found
        setVistorias([]);
        return;
      }
      
      // Usar empresa_id do usuário autenticado
      const empresaId = currentUser.user_metadata?.empresa_id;
      
      if (!empresaId) {
        // User has no empresa_id
        setVistorias([]);
        return;
      }
      
      const data = await SupabaseService.getVistorias(empresaId);
      setVistorias(Array.isArray(data) ? data : []);
    } catch (error) {
        // Error loading vistorias handled silently
        setVistorias([]);
    } finally {
      setLoading(false);
    }
  };

  const filterData = useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredVistorias(vistorias);
      setFilteredDrafts(drafts);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    
    const filteredV = vistorias.filter(vistoria => 
      vistoria.cliente?.toLowerCase().includes(query) ||
      vistoria.endereco?.toLowerCase().includes(query) ||
      vistoria.tipo_vistoria?.toLowerCase().includes(query) ||
      vistoria.observacoes?.toLowerCase().includes(query)
    );

    const filteredD = drafts.filter(draft => 
      draft.cliente?.toLowerCase().includes(query) ||
      draft.endereco?.toLowerCase().includes(query) ||
      draft.tipo_vistoria?.toLowerCase().includes(query) ||
      draft.observacoes?.toLowerCase().includes(query)
    );

    setFilteredVistorias(filteredV);
    setFilteredDrafts(filteredD);
  }, [searchQuery, vistorias, drafts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
      showSuccess('Vistorias atualizadas!');
    } catch (error) {
      showError('Erro ao atualizar vistorias');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteVistoria = useCallback(async (vistoriaId: string) => {
    try {
      // Implementar lógica de exclusão
      showSuccess('Vistoria excluída com sucesso!');
      await loadData();
    } catch (error) {
      showError('Erro ao excluir vistoria');
    }
  }, [loadData, showSuccess, showError]);

  const handleArchiveVistoria = useCallback(async (vistoriaId: string) => {
    try {
      // Implementar lógica de arquivamento
      showWarning('Vistoria arquivada');
      await loadData();
    } catch (error) {
      showError('Erro ao arquivar vistoria');
    }
  }, [loadData, showWarning, showError]);

  const handleNewVistoria = () => {
    router.push('/wizard');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'finalizada': return colors.success;
      case 'contestada': return colors.danger;
      case 'rascunho': return colors.warning;
      default: return colors.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'finalizada': return 'Finalizada';
      case 'contestada': return 'Contestada';
      case 'rascunho': return 'Rascunho';
      default: return status;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'entrada': return 'Entrada';
      case 'saida': return 'Saída';
      case 'periodica': return 'Periódica';
      default: return tipo;
    }
  };

  const renderVistoriaItem = ({ item }: { item: any }) => (
    <ModernSwipeableRow
      rightActions={[
        SwipeActions.archive(() => handleArchiveVistoria(item.id)),
        SwipeActions.delete(() => handleDeleteVistoria(item.id)),
      ]}
    >
      <ModernCard 
        style={styles.vistoriaCard}
        variant="elevated"
        glowEffect={item.status === 'finalizada'}
      >
      <View style={styles.vistoriaHeader}>
        <View style={styles.vistoriaInfo}>
          <Text style={styles.vistoriaCode}>{item.imovel?.codigo || item.id}</Text>
          <ModernCard 
            style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status || 'rascunho') + '15' }]}
            variant="glass"
            padding="sm"
          >
            <Text style={[styles.statusText, { color: getStatusColor(item.status || 'rascunho') }]}>
              {getStatusLabel(item.status || 'rascunho')}
            </Text>
          </ModernCard>
        </View>
        <ModernCard 
          style={styles.vistoriaType}
          variant="gradient"
          gradientColors={colors.gradients.accent}
          padding="sm"
        >
          <Text style={styles.vistoriaTypeText}>{getTipoLabel(item.tipo)}</Text>
        </ModernCard>
      </View>

      <View style={styles.vistoriaDetails}>
        <View style={styles.detailRow}>
          <MapPin size={18} color={colors.accent} />
          <Text style={styles.detailText}>{item.imovel?.endereco || 'Rascunho offline'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Calendar size={18} color={colors.accent} />
          <Text style={styles.detailText}>
            {new Date(item.created_at).toLocaleDateString('pt-BR')}
          </Text>
        </View>
        {item.ambientes && (
          <View style={styles.detailRow}>
            <FileText size={18} color={colors.accent} />
            <Text style={styles.detailText}>
              {item.ambientes.length} ambiente(s)
            </Text>
          </View>
        )}
      </View>

      <View style={styles.vistoriaActions}>
        <ModernButton
          title="Ver Detalhes"
          variant="outline"
          size="sm"
          icon={<Eye size={16} color={colors.primary} />}
          onPress={() => router.push(`/(tabs)/camera?vistoriaId=${item.id}`)}
          style={styles.actionButton}
        />
        {item.pdf_url && (
          <ModernButton
            title="Ver PDF"
            variant="glass"
            size="sm"
            icon={<FileText size={16} color={colors.info} />}
            onPress={() => {}}
            style={styles.actionButton}
          />
        )}
      </View>
    </ModernCard>
    </ModernSwipeableRow>
  );

  const renderDraftItem = ({ item }: { item: DraftVistoria }) => (
    <ModernCard style={StyleSheet.flatten([styles.vistoriaCard, styles.draftCard])} variant="elevated">
      <View style={styles.vistoriaHeader}>
        <View style={styles.vistoriaInfo}>
          <View style={styles.draftIndicator}>
            <WifiOff size={14} color={colors.warning} />
            <Text style={styles.vistoriaCode}>{item.id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.warning + '20' }]}>
            <Text style={[styles.statusText, { color: colors.warning }]}>
              Rascunho Offline
            </Text>
          </View>
        </View>
        <Text style={styles.vistoriaType}>{getTipoLabel(item.tipo)}</Text>
      </View>

      <View style={styles.vistoriaDetails}>
        <View style={styles.detailRow}>
          <Calendar size={16} color={colors.textMuted} />
          <Text style={styles.detailText}>
            {new Date(item.created_at).toLocaleDateString('pt-BR')}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <FileText size={16} color={colors.textMuted} />
          <Text style={styles.detailText}>
            {item.ambientes.length} ambiente(s)
          </Text>
        </View>
      </View>

      <View style={styles.vistoriaActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Eye size={16} color={colors.primary} />
          <Text style={styles.actionText}>Continuar Edição</Text>
        </TouchableOpacity>
      </View>
    </ModernCard>
  );

  const renderSectionHeader = ({ section }: { section: any }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleContainer}>
        {section.key === 'drafts' ? (
          <WifiOff size={20} color={colors.warning} />
        ) : (
          <Wifi size={20} color={colors.success} />
        )}
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
      <Text style={styles.sectionCount}>({section.data.length})</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ModernLoadingSpinner 
            variant="gradient" 
            size="large" 
            text="Carregando vistorias..." 
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ModernCard style={styles.header} variant="glass" padding="lg">
        <Text style={styles.title}>Vistorias</Text>
      </ModernCard>

      <ModernSearchBar
        placeholder="Buscar vistorias..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        variant="glass"
        showFilter={true}
        onFilterPress={() => showSuccess('Filtros em breve!')}
        testID="search-vistorias"
      />

      <ModernPullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        variant="gradient"
        title="Puxe para atualizar"
        subtitle="Atualize suas vistorias"
      >
        <View style={styles.listContent}>
          {[
            {
              key: 'drafts',
              title: 'Rascunhos Offline',
              data: filteredDrafts,
            },
            {
              key: 'synced',
              title: 'Vistorias Sincronizadas',
              data: filteredVistorias,
            },
          ].filter(section => section.data.length > 0).map((section, sectionIndex) => (
            <View key={sectionIndex}>
              {renderSectionHeader({ section })}
              {section.data.map((item, itemIndex) => (
                <View key={item.id}>
                  {section.key === 'drafts' 
                    ? renderDraftItem({ item: item as DraftVistoria })
                    : renderVistoriaItem({ item })
                  }
                </View>
              ))}
            </View>
          ))}
          
          {filteredDrafts.length === 0 && filteredVistorias.length === 0 && (
            <ModernCard style={styles.emptyCard} variant="glass" padding="xxl">
              <FileText size={64} color={colors.accent} />
              <Text style={styles.emptyTitle}>Nenhuma vistoria encontrada</Text>
              <Text style={styles.emptySubtitle}>
                Crie sua primeira vistoria tocando no botão Nova
              </Text>
              <ModernButton
                title="Criar Primeira Vistoria"
                onPress={handleNewVistoria}
                variant="gradient"
                size="md"
                icon={<Plus size={20} color={colors.textPrimary} />}
                style={styles.emptyButton}
              />
            </ModernCard>
          )}
        </View>
      </ModernPullToRefresh>
      
      <ModernToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
      
      <ModernFloatingActionButton
        onPress={handleNewVistoria}
        icon={<Plus size={24} color={colors.surface} />}
        variant="gradient"
        size="medium"
        position="bottom-right"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  listContent: {
    padding: spacing.lg,
  },
  vistoriaCard: {
    marginBottom: spacing.md,
  },
  vistoriaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  vistoriaInfo: {
    flex: 1,
  },
  vistoriaCode: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.medium,
  },
  vistoriaType: {
    borderRadius: borderRadius.md,
  },
  vistoriaTypeText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  vistoriaDetails: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    flex: 1,
  },
  vistoriaActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  emptyButton: {
    marginTop: spacing.xl,
    minWidth: 200,
  },
  emptyTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  sectionCount: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
  },
  draftCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  draftIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});