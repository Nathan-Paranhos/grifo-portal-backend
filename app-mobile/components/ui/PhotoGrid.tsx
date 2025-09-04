import React, { useState, useCallback, useMemo } from 'react';
import { View, FlatList, Dimensions, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { OptimizedImage } from './OptimizedImage';
import { colors, spacing, typography } from '@/constants/colors';
import { Eye, Download, Trash2 } from 'lucide-react-native';

interface Photo {
  id: string;
  url: string;
  thumbnailUrl?: string;
  descricao?: string;
  ambiente?: string;
  tamanho_arquivo?: number;
  largura?: number;
  altura?: number;
}

interface PhotoGridProps {
  photos: Photo[];
  numColumns?: number;
  onPhotoPress?: (photo: Photo, index: number) => void;
  onPhotoLongPress?: (photo: Photo, index: number) => void;
  showActions?: boolean;
  onDownload?: (photo: Photo) => void;
  onDelete?: (photo: Photo) => void;
  loading?: boolean;
  emptyMessage?: string;
  itemSpacing?: number;
}

const { width: screenWidth } = Dimensions.get('window');

export function PhotoGrid({
  photos,
  numColumns = 2,
  onPhotoPress,
  onPhotoLongPress,
  showActions = false,
  onDownload,
  onDelete,
  loading = false,
  emptyMessage = 'Nenhuma foto encontrada',
  itemSpacing = spacing.sm
}: PhotoGridProps) {
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});

  // Calcular dimensões dos itens
  const itemSize = useMemo(() => {
    const totalSpacing = (numColumns + 1) * itemSpacing;
    const availableWidth = screenWidth - (spacing.lg * 2) - totalSpacing;
    return availableWidth / numColumns;
  }, [numColumns, itemSpacing]);

  const handlePhotoLoad = useCallback((photoId: string) => {
    setLoadingStates(prev => ({ ...prev, [photoId]: false }));
  }, []);

  const handlePhotoError = useCallback((photoId: string, error: any) => {
    // Error loading image handled silently
    setLoadingStates(prev => ({ ...prev, [photoId]: false }));
  }, []);

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  }, []);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const renderPhotoItem = useCallback(({ item: photo, index }: { item: Photo; index: number }) => {
    const isSelected = selectedPhotos.has(photo.id);
    const isLoading = loadingStates[photo.id] ?? true;

    return (
      <TouchableOpacity
        style={[
          styles.photoItem,
          {
            width: itemSize,
            height: itemSize,
            marginRight: (index + 1) % numColumns === 0 ? 0 : itemSpacing,
            marginBottom: itemSpacing,
          },
          isSelected && styles.selectedPhoto
        ]}
        onPress={() => {
          if (showActions) {
            togglePhotoSelection(photo.id);
          } else {
            onPhotoPress?.(photo, index);
          }
        }}
        onLongPress={() => {
          if (!showActions) {
            onPhotoLongPress?.(photo, index);
          }
        }}
        activeOpacity={0.8}
      >
        <OptimizedImage
          uri={photo.url}
          thumbnailUri={photo.thumbnailUrl}
          style={styles.photoImage}
          onLoad={() => handlePhotoLoad(photo.id)}
          onError={(error) => handlePhotoError(photo.id, error)}
          lazy={true}
          cachePolicy="default"
        />
        
        {/* Overlay com informações */}
        <View style={styles.photoOverlay}>
          {photo.ambiente && (
            <View style={styles.ambienteTag}>
              <Text style={styles.ambienteText}>{photo.ambiente}</Text>
            </View>
          )}
          
          {photo.tamanho_arquivo && (
            <Text style={styles.fileSizeText}>
              {formatFileSize(photo.tamanho_arquivo)}
            </Text>
          )}
        </View>

        {/* Ações */}
        {showActions && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onDownload?.(photo)}
            >
              <Download size={16} color={colors.background} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => onDelete?.(photo)}
            >
              <Trash2 size={16} color={colors.background} />
            </TouchableOpacity>
          </View>
        )}

        {/* Indicador de seleção */}
        {isSelected && (
          <View style={styles.selectionIndicator}>
            <View style={styles.selectionCheckmark} />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [itemSize, itemSpacing, numColumns, selectedPhotos, loadingStates, showActions, onPhotoPress, onPhotoLongPress, onDownload, onDelete]);

  const keyExtractor = useCallback((item: Photo) => item.id, []);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: itemSize + itemSpacing,
    offset: (itemSize + itemSpacing) * Math.floor(index / numColumns),
    index,
  }), [itemSize, itemSpacing, numColumns]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando fotos...</Text>
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Eye size={48} color={colors.textMuted} />
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {selectedPhotos.size > 0 && (
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionText}>
            {selectedPhotos.size} foto(s) selecionada(s)
          </Text>
          <TouchableOpacity
            onPress={() => setSelectedPhotos(new Set())}
            style={styles.clearSelectionButton}
          >
            <Text style={styles.clearSelectionText}>Limpar</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <FlatList
        data={photos}
        renderItem={renderPhotoItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        getItemLayout={getItemLayout}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={6}
        updateCellsBatchingPeriod={50}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
  },
  photoItem: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.border,
    position: 'relative',
  },
  selectedPhoto: {
    borderWidth: 3,
    borderColor: colors.primary,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: spacing.xs,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  ambienteTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  ambienteText: {
    color: colors.background,
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.medium,
  },
  fileSizeText: {
    color: colors.background,
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.regular,
  },
  actionsContainer: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.xs,
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: colors.danger + 'CC',
  },
  selectionIndicator: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCheckmark: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary + '10',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectionText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textPrimary,
  },
  clearSelectionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearSelectionText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});