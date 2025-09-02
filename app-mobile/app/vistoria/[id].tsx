import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { SupabaseService, supabase } from '@/services/supabase';
import { usePhotoManager } from '@/hooks/usePhotoManager';
import { PhotoGrid } from '@/components/ui/PhotoGrid';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { colors, typography, spacing } from '@/constants/colors';
import { Vistoria, Imovel, User } from '@/types';
import { 
  ArrowLeft, 
  Camera, 
  FileText, 
  MapPin, 
  Calendar, 
  User as UserIcon,
  Building,
  Eye,
  Download,
  Trash2,
  Settings,
  RefreshCw,
  CheckCircle
} from 'lucide-react-native';
import LocationCapture from '@/components/LocationCapture';
import { SignatureCapture } from '@/components/SignatureCapture';
import { SignatureList } from '@/components/SignatureList';

interface VistoriaDetalhes extends Vistoria {
  imovel?: Imovel;
  vistoriador?: User;
  empresa?: { nome: string };
}

export default function VistoriaDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vistoria, setVistoria] = useState<VistoriaDetalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'info' | 'fotos' | 'relatorio'>('info');
  const [finalizing, setFinalizing] = useState(false);
  const [locationData, setLocationData] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [locationSaved, setLocationSaved] = useState(false);

  // Hook para gerenciar fotos
  const {
    photos,
    loading: photosLoading,
    error: photosError,
    uploading,
    downloadProgress,
    cacheSize,
    uploadPhoto,
    downloadPhoto,
    deletePhoto,
    clearCache,
    refreshPhotos
  } = usePhotoManager({
    vistoriaId: id,
    enableCache: true,
    maxCacheSize: 150, // 150MB
    preloadThumbnails: true
  });

  useEffect(() => {
    if (id) {
      loadVistoriaDetails();
    }
  }, [id]);

  // Verificar se já existe localização salva
  useEffect(() => {
    if (vistoria?.latitude && vistoria?.longitude) {
      setLocationData({
        latitude: vistoria.latitude,
        longitude: vistoria.longitude,
        address: vistoria.endereco_gps
      });
      setLocationSaved(true);
    }
  }, [vistoria]);

  const loadVistoriaDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);
      
      // Carregar detalhes da vistoria com relacionamentos
      const { data: vistoriaData, error } = await supabase
        .from('vistorias')
        .select(`
          *,
          imovel:imoveis(*),
          vistoriador:users(*),
          empresa:empresas(nome)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setVistoria(vistoriaData);
    } catch (error) {
        // Error loading vistoria details handled silently
        Alert.alert('Erro', 'Não foi possível carregar os detalhes da vistoria');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadVistoriaDetails(),
      refreshPhotos()
    ]);
    setRefreshing(false);
  }, [refreshPhotos]);

  const handlePhotoPress = useCallback((photo: any, index: number) => {
    // Navegar para visualizador de fotos
    router.push({
      pathname: '/(tabs)/camera',
      params: {
        photoId: photo.id,
        vistoriaId: id,
        initialIndex: index.toString()
      }
    });
  }, [id]);

  const handlePhotoLongPress = useCallback((photo: any) => {
    Alert.alert(
      'Opções da Foto',
      `Foto: ${photo.ambiente || 'Sem ambiente'}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Baixar', 
          onPress: () => downloadPhoto(photo)
        },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: () => handleDeletePhoto(photo)
        }
      ]
    );
  }, [downloadPhoto]);

  const handleDeletePhoto = useCallback(async (photo: any) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir esta foto? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const success = await deletePhoto(photo);
            if (success) {
              Alert.alert('Sucesso', 'Foto excluída com sucesso');
            }
          }
        }
      ]
    );
  }, [deletePhoto]);

  const handleTakePhoto = () => {
    if (vistoria?.status === 'finalizada') {
      Alert.alert(
        'Vistoria Finalizada',
        'Esta vistoria já foi finalizada, mas você pode adicionar fotos complementares.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Continuar', 
            onPress: () => {
              router.push({
                pathname: '/(tabs)/camera',
                params: { vistoriaId: id }
              });
            }
          }
        ]
      );
    } else {
      router.push({
        pathname: '/(tabs)/camera',
        params: { vistoriaId: id }
      });
    }
  };

  const handleBatchPhoto = () => {
    if (vistoria?.status === 'finalizada') {
      Alert.alert(
        'Vistoria Finalizada',
        'Esta vistoria já foi finalizada, mas você pode adicionar fotos complementares em lote.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Continuar', 
            onPress: () => {
              router.push({
                pathname: '/vistoria/batch-camera',
                params: { vistoriaId: id }
              });
            }
          }
        ]
      );
    } else {
      router.push({
        pathname: '/vistoria/batch-camera',
        params: { vistoriaId: id }
      });
    }
  };

  const handleGenerateReport = async () => {
    if (!vistoria) return;

    try {
      Alert.alert('Gerando Relatório', 'O relatório está sendo gerado...');
      // Implementar geração de relatório
    } catch (error) {
        // Error generating report handled silently
        Alert.alert('Erro', 'Não foi possível gerar o relatório');
    }
  };

  const handleLocationCapture = useCallback(async (location: { latitude: number; longitude: number; address?: string }) => {
    setLocationData(location);
    
    // Salvar localização no banco de dados
    try {
      const { error } = await supabase
        .from('vistorias')
        .update({
          latitude: location.latitude,
          longitude: location.longitude,
          endereco_gps: location.address,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      setLocationSaved(true);
      Alert.alert('Sucesso', 'Localização capturada e salva com sucesso!');
      
      // Recarregar dados da vistoria
      await loadVistoriaDetails();
    } catch (error) {
      console.error('Erro ao salvar localização:', error);
      Alert.alert('Erro', 'Localização capturada, mas não foi possível salvar no servidor.');
    }
  }, [id]);

  const handleLocationError = useCallback((error: string) => {
    console.error('Erro de localização:', error);
  }, []);

  const handleFinalizeVistoria = async () => {
    if (!vistoria || vistoria.status === 'finalizada') return;

    Alert.alert(
      'Finalizar Vistoria',
      'Tem certeza que deseja finalizar esta vistoria? Após finalizada, você ainda poderá adicionar fotos complementares.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'default',
          onPress: async () => {
            try {
              setFinalizing(true);
              
              // Atualizar status da vistoria para finalizada
              const { error } = await supabase
                .from('vistorias')
                .update({
                  status: 'finalizada',
                  finalized_at: new Date().toISOString()
                })
                .eq('id', vistoria.id);

              if (error) throw error;

              // Recarregar dados da vistoria
              await loadVistoriaDetails();
              
              Alert.alert(
                'Sucesso',
                'Vistoria finalizada com sucesso! Você ainda pode adicionar fotos complementares se necessário.'
              );
            } catch (error) {
              console.error('Erro ao finalizar vistoria:', error);
              Alert.alert('Erro', 'Não foi possível finalizar a vistoria. Tente novamente.');
            } finally {
              setFinalizing(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendada': return colors.warning;
      case 'em_andamento': return colors.info;
      case 'finalizada': return colors.success;
      case 'cancelada': return colors.danger;
      default: return colors.textMuted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'agendada': return 'Agendada';
      case 'em_andamento': return 'Em Andamento';
      case 'finalizada': return 'Finalizada';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  const renderInfoTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Status Card */}
      <Card style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(vistoria?.status || '') + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: getStatusColor(vistoria?.status || '') }
            ]}>
              {getStatusText(vistoria?.status || '')}
            </Text>
          </View>
          <Text style={styles.vistoriaId}>#{vistoria?.id.slice(-8)}</Text>
        </View>
        <Text style={styles.vistoriaTipo}>
          Vistoria de {vistoria?.tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </Text>
      </Card>

      {/* Captura de Localização */}
      <LocationCapture
        onLocationCapture={handleLocationCapture}
        onError={handleLocationError}
        autoCapture={vistoria?.status === 'em_andamento' && !locationSaved}
        showAddress={true}
        disabled={vistoria?.status === 'finalizada' && locationSaved}
        style={{ marginBottom: spacing.md }}
      />

      {/* Informações do Imóvel */}
      <Card style={styles.infoCard}>
        <View style={styles.cardHeader}>
          <Building size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Imóvel</Text>
        </View>
        <View style={styles.infoRow}>
          <MapPin size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>{vistoria?.imovel?.endereco}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Código:</Text>
          <Text style={styles.infoValue}>{vistoria?.imovel?.codigo}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tipo:</Text>
          <Text style={styles.infoValue}>{vistoria?.imovel?.tipo}</Text>
        </View>
      </Card>

      {/* Informações do Vistoriador */}
      <Card style={styles.infoCard}>
        <View style={styles.cardHeader}>
          <UserIcon size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Vistoriador</Text>
        </View>
        <Text style={styles.infoText}>{vistoria?.vistoriador?.nome}</Text>
        <Text style={styles.infoSubtext}>{vistoria?.vistoriador?.email}</Text>
      </Card>

      {/* Informações da Empresa */}
      <Card style={styles.infoCard}>
        <View style={styles.cardHeader}>
          <Building size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Empresa</Text>
        </View>
        <Text style={styles.infoText}>{vistoria?.empresa?.nome}</Text>
      </Card>

      {/* Datas */}
      <Card style={styles.infoCard}>
        <View style={styles.cardHeader}>
          <Calendar size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Datas</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Data:</Text>
          <Text style={styles.infoValue}>{formatDate(vistoria?.created_at || '')}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Criada:</Text>
          <Text style={styles.infoValue}>{formatDate(vistoria?.created_at || '')}</Text>
        </View>
        {vistoria?.updated_at && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Atualizada:</Text>
            <Text style={styles.infoValue}>{formatDate(vistoria.updated_at)}</Text>
          </View>
        )}
      </Card>

      {/* Observações */}
      <Card style={styles.infoCard}>
        <View style={styles.cardHeader}>
          <FileText size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Observações</Text>
        </View>
        <Text style={styles.observacoes}>Nenhuma observação registrada</Text>
      </Card>

      {/* Assinaturas Digitais */}
      <Card style={styles.infoCard}>
        <SignatureList
          vistoriaId={id!}
          showActions={vistoria?.status !== 'finalizada'}
        />
      </Card>

      {/* Captura de Assinatura */}
      {vistoria?.status !== 'finalizada' && (
        <Card style={styles.infoCard}>
          <SignatureCapture
            vistoriaId={id!}
            onSignatureSaved={() => {
              // Recarregar a lista de assinaturas
              // A SignatureList já tem seu próprio refresh
            }}
          />
        </Card>
      )}

      {/* Botão de Finalização */}
      {vistoria?.status !== 'finalizada' && (
        <Card style={styles.finalizeCard}>
          <View style={styles.finalizeHeader}>
            <CheckCircle size={20} color={colors.success} />
            <Text style={styles.finalizeTitle}>Finalizar Vistoria</Text>
          </View>
          <Text style={styles.finalizeDescription}>
            Finalize esta vistoria para marcar como concluída. Você ainda poderá adicionar fotos complementares após a finalização.
          </Text>
          <Button
            title="Finalizar Vistoria"
            onPress={handleFinalizeVistoria}
            loading={finalizing}
            style={styles.finalizeButton}
          />
        </Card>
      )}
    </ScrollView>
  );

  const renderFotosTab = () => (
    <View style={styles.tabContent}>
      {/* Banner informativo para vistoria finalizada */}
      {vistoria?.status === 'finalizada' && (
        <Card style={styles.finalizadaBanner}>
          <Text style={styles.finalizadaBannerText}>
            ✅ Vistoria finalizada - Você ainda pode adicionar fotos complementares
          </Text>
        </Card>
      )}
      
      {/* Header com estatísticas */}
      <Card style={styles.photoStatsCard}>
        <View style={styles.photoStats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{photos.length}</Text>
            <Text style={styles.statLabel}>Fotos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{cacheSize.toFixed(1)}MB</Text>
            <Text style={styles.statLabel}>Cache</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{Object.keys(downloadProgress).length}</Text>
            <Text style={styles.statLabel}>Downloads</Text>
          </View>
        </View>
        
        <View style={styles.photoActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowPhotoActions(!showPhotoActions)}
          >
            <Settings size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={refreshPhotos}
          >
            <RefreshCw size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </Card>

      {/* Ações de foto (quando habilitado) */}
      {showPhotoActions && (
        <Card style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Ações</Text>
          <View style={styles.actionsRow}>
            <Button
              title="Limpar Cache"
              onPress={clearCache}
              variant="outline"
              size="sm"
              style={styles.actionBtn}
            />
            <Button
              title="Baixar Todas"
              onPress={() => {
                photos.forEach(photo => downloadPhoto(photo));
              }}
              variant="outline"
              size="sm"
              style={styles.actionBtn}
            />
          </View>
        </Card>
      )}

      {/* Grid de fotos */}
      <PhotoGrid
        photos={photos}
        loading={photosLoading}
        onPhotoPress={handlePhotoPress}
        onPhotoLongPress={handlePhotoLongPress}
        onDownload={downloadPhoto}
        onDelete={handleDeletePhoto}
        showActions={showPhotoActions}
        emptyMessage="Nenhuma foto encontrada para esta vistoria"
        numColumns={2}
      />

      {/* Botões flutuantes para adicionar fotos */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fabButton, styles.fabSecondary]}
          onPress={handleTakePhoto}
          disabled={uploading}
        >
          <Camera size={20} color={colors.background} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.fabButton}
          onPress={handleBatchPhoto}
          disabled={uploading}
        >
          <View style={styles.fabBatchIcon}>
            <Camera size={16} color={colors.background} />
            <Text style={styles.fabBatchText}>+</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRelatorioTab = () => (
    <View style={styles.tabContent}>
      <Card style={styles.reportCard}>
        <FileText size={48} color={colors.primary} />
        <Text style={styles.reportTitle}>Relatório da Vistoria</Text>
        <Text style={styles.reportDescription}>
          Gere um relatório completo desta vistoria incluindo todas as fotos e observações.
        </Text>
        <Button
          title="Gerar Relatório PDF"
          onPress={handleGenerateReport}
          style={styles.reportButton}
        />
      </Card>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
          <Text style={styles.loadingText}>Carregando detalhes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vistoria) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Vistoria não encontrada</Text>
          <Button
            title="Voltar"
            onPress={() => router.back()}
            variant="outline"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes da Vistoria</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'info' && styles.activeTab]}
          onPress={() => setSelectedTab('info')}
        >
          <Eye size={16} color={selectedTab === 'info' ? colors.primary : colors.textMuted} />
          <Text style={[
            styles.tabText,
            selectedTab === 'info' && styles.activeTabText
          ]}>Info</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'fotos' && styles.activeTab]}
          onPress={() => setSelectedTab('fotos')}
        >
          <Camera size={16} color={selectedTab === 'fotos' ? colors.primary : colors.textMuted} />
          <Text style={[
            styles.tabText,
            selectedTab === 'fotos' && styles.activeTabText
          ]}>Fotos ({photos.length})</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'relatorio' && styles.activeTab]}
          onPress={() => setSelectedTab('relatorio')}
        >
          <FileText size={16} color={selectedTab === 'relatorio' ? colors.primary : colors.textMuted} />
          <Text style={[
            styles.tabText,
            selectedTab === 'relatorio' && styles.activeTabText
          ]}>Relatório</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {selectedTab === 'info' && renderInfoTab()}
        {selectedTab === 'fotos' && renderFotosTab()}
        {selectedTab === 'relatorio' && renderRelatorioTab()}
      </View>

      {/* Error display */}
      {photosError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{photosError}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: spacing.lg,
  },
  statusCard: {
    marginBottom: spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  statusText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
  },
  vistoriaId: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
  },
  vistoriaTipo: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  infoCard: {
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  infoText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    flex: 1,
  },
  infoSubtext: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
  },
  infoLabel: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    minWidth: 80,
  },
  infoValue: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    flex: 1,
  },
  observacoes: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  photoStatsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  photoStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.textMuted,
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.surfaceVariant,
  },
  actionsCard: {
    marginBottom: spacing.lg,
  },
  actionsTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  fabContainer: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    flexDirection: 'column',
    gap: spacing.sm,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.border,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabSecondary: {
    backgroundColor: colors.secondary,
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  fabBatchIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBatchText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    color: colors.background,
    marginLeft: 2,
  },
  reportCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  reportTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  reportDescription: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  reportButton: {
    minWidth: 200,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.medium,
    color: colors.danger,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  finalizadaBanner: {
    backgroundColor: colors.success + '20',
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  finalizadaBannerText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.success,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: colors.danger + '20',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.danger,
  },
  errorBannerText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.danger,
    textAlign: 'center',
  },
  finalizeCard: {
    marginBottom: spacing.lg,
  },
  finalizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  finalizeTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  finalizeDescription: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  finalizeButton: {
    backgroundColor: colors.success,
  },
});