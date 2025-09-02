import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { SupabaseService } from '@/services/supabase';
import grifoApiService from '@/services/grifoApi';
import { PhotoOptimizer } from '@/services/photoOptimizer';

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

interface UsePhotoManagerOptions {
  vistoriaId?: string;
  enableCache?: boolean;
  maxCacheSize?: number; 
  preloadThumbnails?: boolean;
}

interface PhotoManagerState {
  photos: Photo[];
  loading: boolean;
  error: string | null;
  uploading: boolean;
  downloadProgress: { [photoId: string]: number };
  cacheSize: number;
}

export function usePhotoManager(options: UsePhotoManagerOptions = {}) {
  const {
    vistoriaId,
    enableCache = true,
    maxCacheSize = 100, 
    preloadThumbnails = true
  } = options;

  const [state, setState] = useState<PhotoManagerState>({
    photos: [],
    loading: false,
    error: null,
    uploading: false,
    downloadProgress: {},
    cacheSize: 0
  });

  const isMountedRef = useRef(true);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const downloadQueueRef = useRef<Set<string>>(new Set());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Função para setState seguro (evita atualizações em componentes desmontados)
  const safeSetState = useCallback((updater: (prev: PhotoManagerState) => PhotoManagerState) => {
    if (isMountedRef.current) {
      setState(updater);
    }
  }, []);

  // Diretório de cache
  const cacheDir = `${FileSystem.cacheDirectory}photos/`;

  // Inicializar diretório de cache
  useEffect(() => {
    const initCache = async () => {
      try {
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
        }
        await calculateCacheSize();
      } catch (error) {
        console.warn('Erro ao inicializar cache de fotos:', error);
      }
    };

    if (enableCache) {
      initCache();
    }
  }, [enableCache]);

  // Calcular tamanho do cache
  const calculateCacheSize = useCallback(async () => {
    if (!enableCache) return;

    try {
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      let totalSize = 0;

      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(`${cacheDir}${file}`);
        if (fileInfo.exists && fileInfo.size) {
          totalSize += fileInfo.size;
        }
      }

      safeSetState(prev => ({ ...prev, cacheSize: totalSize / (1024 * 1024) })); // MB
    } catch (error) {
      console.warn('Erro ao calcular tamanho do cache:', error);
    }
  }, [enableCache, cacheDir, safeSetState]);

  // Limpar cache se exceder o limite
  const cleanupCache = useCallback(async () => {
    if (!enableCache || state.cacheSize <= maxCacheSize) return;

    try {
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      const fileInfos = await Promise.all(
        files.map(async (file) => {
          const info = await FileSystem.getInfoAsync(`${cacheDir}${file}`);
          return { name: file, ...info };
        })
      );

      // Ordenar por data de modificação (mais antigos primeiro)
      const sortedFiles = fileInfos
        .filter(f => f.exists && 'modificationTime' in f && f.modificationTime)
        .sort((a, b) => {
          const aTime = 'modificationTime' in a ? (a.modificationTime || 0) : 0;
          const bTime = 'modificationTime' in b ? (b.modificationTime || 0) : 0;
          return aTime - bTime;
        });

      // Remover arquivos até ficar abaixo do limite
      let currentSize = state.cacheSize;
      for (const file of sortedFiles) {
        if (currentSize <= maxCacheSize * 0.8) break; // Deixar 20% de margem

        await FileSystem.deleteAsync(`${cacheDir}${file.name}`);
        cacheRef.current.delete(file.name);
        const fileSize = 'size' in file ? (file.size || 0) : 0;
        currentSize -= fileSize / (1024 * 1024);
      }

      await calculateCacheSize();
    } catch (error) {
      console.warn('Erro ao limpar cache:', error);
    }
  }, [enableCache, state.cacheSize, maxCacheSize, cacheDir]);

  // Obter URL em cache ou fazer download
  const getCachedPhotoUrl = useCallback(async (photoUrl: string, photoId: string): Promise<string> => {
    if (!enableCache) return photoUrl;

    const cacheKey = `${photoId}.jpg`;
    const cachedPath = `${cacheDir}${cacheKey}`;

    // Verificar se já está em cache
    if (cacheRef.current.has(cacheKey)) {
      const cachedUrl = cacheRef.current.get(cacheKey)!;
      const fileInfo = await FileSystem.getInfoAsync(cachedUrl);
      if (fileInfo.exists) {
        return cachedUrl;
      }
    }

    // Evitar downloads duplicados
    if (downloadQueueRef.current.has(photoId)) {
      return photoUrl; // Retornar URL original enquanto baixa
    }

    try {
      downloadQueueRef.current.add(photoId);
      
      // Criar AbortController para cancelar download se necessário
      const abortController = new AbortController();
      abortControllersRef.current.set(photoId, abortController);

      // Download com progresso
      const downloadResult = await FileSystem.downloadAsync(
        photoUrl,
        cachedPath,
        {
          headers: {
            'Cache-Control': 'max-age=31536000', // 1 ano
          },
        }
      );

      if (downloadResult.status === 200) {
        cacheRef.current.set(cacheKey, cachedPath);
        await calculateCacheSize();
        await cleanupCache();
        return cachedPath;
      }
    } catch (error) {
      console.warn(`Erro ao fazer cache da foto ${photoId}:`, error);
    } finally {
      downloadQueueRef.current.delete(photoId);
      abortControllersRef.current.delete(photoId);
    }

    return photoUrl; // Fallback para URL original
  }, [enableCache, cacheDir, calculateCacheSize, cleanupCache]);

  // Carregar fotos da vistoria
  const loadPhotos = useCallback(async (vistoriaId?: string) => {
    if (!vistoriaId) return;

    safeSetState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Usar grifoApiService para buscar fotos
      const response = await grifoApiService.getVistoriaFotos(vistoriaId);
      
      if (!response.success) {
        throw new Error(response.error || 'Erro ao carregar fotos');
      }
      
      const fotos = response.data || [];

      const photosWithCache = await Promise.all(
        (fotos || []).map(async (foto) => {
          const cachedUrl = await getCachedPhotoUrl(foto.url, foto.id);
          const cachedThumbnailUrl = foto.thumbnail_url 
            ? await getCachedPhotoUrl(foto.thumbnail_url, `${foto.id}_thumb`)
            : undefined;

          return {
            id: foto.id,
            url: cachedUrl,
            thumbnailUrl: cachedThumbnailUrl,
            descricao: foto.descricao,
            ambiente: foto.ambiente,
            tamanho_arquivo: foto.tamanho_arquivo,
            largura: foto.largura,
            altura: foto.altura,
          };
        })
      );

      safeSetState(prev => ({ ...prev, photos: photosWithCache, loading: false }));

      // Pré-carregar thumbnails se habilitado
      if (preloadThumbnails) {
        photosWithCache.forEach(photo => {
          if (photo.thumbnailUrl && !photo.thumbnailUrl.startsWith('file://')) {
            getCachedPhotoUrl(photo.thumbnailUrl, `${photo.id}_thumb`);
          }
        });
      }
    } catch (error) {
      // Error loading photos handled silently
      safeSetState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }));
    }
  }, [getCachedPhotoUrl, preloadThumbnails, safeSetState]);

  // Upload de foto
  const uploadPhoto = useCallback(async (
    photoUri: string,
    vistoriaId: string,
    ambiente: string,
    descricao?: string
  ): Promise<boolean> => {
    safeSetState(prev => ({ ...prev, uploading: true }));

    try {
      // Otimizar foto antes do upload
      const optimizedResult = await PhotoOptimizer.uploadOptimizedPhoto(photoUri, {
        vistoriaId,
        ambiente,
        descricao,
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
        generateThumbnail: true,
      });

      if (!optimizedResult) {
        throw new Error('Falha ao otimizar foto');
      }

      // O PhotoOptimizer já fez o upload e salvou no banco
      // Apenas precisamos atualizar a lista local

      // Recarregar fotos
      await loadPhotos(vistoriaId);
      
      safeSetState(prev => ({ ...prev, uploading: false }));
      return true;
    } catch (error) {
      // Error saving photo handled silently
      safeSetState(prev => ({ 
        ...prev, 
        uploading: false,
        error: error instanceof Error ? error.message : 'Erro no upload'
      }));
      return false;
    }
  }, [loadPhotos, safeSetState]);

  // Download de foto para galeria
  const downloadPhoto = useCallback(async (photo: Photo): Promise<boolean> => {
    try {
      // Solicitar permissão
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'É necessário permitir acesso à galeria para salvar fotos.');
        return false;
      }

      safeSetState(prev => ({ 
        ...prev, 
        downloadProgress: { ...prev.downloadProgress, [photo.id]: 0 }
      }));

      // Download da foto
      const fileUri = `${FileSystem.documentDirectory}temp_${photo.id}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(photo.url, fileUri);

      if (downloadResult.status === 200) {
        // Salvar na galeria
        await MediaLibrary.saveToLibraryAsync(fileUri);
        
        // Limpar arquivo temporário
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
        
        safeSetState(prev => {
          const newProgress = { ...prev.downloadProgress };
          delete newProgress[photo.id];
          return { ...prev, downloadProgress: newProgress };
        });

        Alert.alert('Sucesso', 'Foto salva na galeria!');
        return true;
      }
    } catch (error) {
      console.error('Erro ao baixar foto:', error);
      Alert.alert('Erro', 'Falha ao salvar foto na galeria.');
    }

    safeSetState(prev => {
      const newProgress = { ...prev.downloadProgress };
      delete newProgress[photo.id];
      return { ...prev, downloadProgress: newProgress };
    });
    return false;
  }, []);

  // Deletar foto
  const deletePhoto = useCallback(async (photo: Photo): Promise<boolean> => {
    try {
      // A remoção do storage será feita pela API do backend
      // que já gerencia tanto o banco quanto o storage

      // Remover do banco via API
      const deleteResponse = await grifoApiService.deleteVistoriaFoto(photo.id);
      if (!deleteResponse.success) {
        throw new Error(deleteResponse.error || 'Erro ao deletar foto do banco');
      }

      // Remover do cache local
      const cacheKey = `${photo.id}.jpg`;
      const thumbCacheKey = `${photo.id}_thumb.jpg`;
      
      if (cacheRef.current.has(cacheKey)) {
        const cachedPath = cacheRef.current.get(cacheKey)!;
        await FileSystem.deleteAsync(cachedPath, { idempotent: true });
        cacheRef.current.delete(cacheKey);
      }
      
      if (cacheRef.current.has(thumbCacheKey)) {
        const cachedThumbPath = cacheRef.current.get(thumbCacheKey)!;
        await FileSystem.deleteAsync(cachedThumbPath, { idempotent: true });
        cacheRef.current.delete(thumbCacheKey);
      }

      // Atualizar lista
      safeSetState(prev => ({
        ...prev,
        photos: prev.photos.filter(p => p.id !== photo.id)
      }));

      await calculateCacheSize();
      return true;
    } catch (error) {
      // Error deleting photo handled silently
      safeSetState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Erro ao deletar foto'
      }));
      return false;
    }
  }, [calculateCacheSize, safeSetState]);

  // Limpar cache manualmente
  const clearCache = useCallback(async () => {
    try {
      await FileSystem.deleteAsync(cacheDir, { idempotent: true });
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      cacheRef.current.clear();
      await calculateCacheSize();
    } catch (error) {
      console.warn('Erro ao limpar cache:', error);
    }
  }, [cacheDir, calculateCacheSize]);

  // Cancelar downloads em andamento
  const cancelDownloads = useCallback(() => {
    abortControllersRef.current.forEach(controller => {
      controller.abort();
    });
    abortControllersRef.current.clear();
    downloadQueueRef.current.clear();
  }, []);

  // Carregar fotos quando vistoriaId mudar
  useEffect(() => {
    if (vistoriaId) {
      loadPhotos(vistoriaId);
    }
  }, [vistoriaId, loadPhotos]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cancelDownloads();
    };
  }, [cancelDownloads]);

  return {
    ...state,
    loadPhotos,
    uploadPhoto,
    downloadPhoto,
    deletePhoto,
    clearCache,
    cancelDownloads,
    refreshPhotos: () => loadPhotos(vistoriaId),
  };
}