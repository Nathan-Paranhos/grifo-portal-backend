import React, { useState, useEffect, useRef } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { colors } from '@/constants/colors';

interface OptimizedImageProps {
  uri: string;
  thumbnailUri?: string;
  style?: ImageStyle;
  containerStyle?: ViewStyle;
  placeholder?: React.ReactNode;
  lazy?: boolean;
  cachePolicy?: 'default' | 'reload' | 'none';
  onLoad?: () => void;
  onError?: (error: any) => void;
}

interface CacheEntry {
  uri: string;
  timestamp: number;
  loaded: boolean;
}

// Cache global de imagens
const imageCache: Record<string, CacheEntry> = {};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

export function OptimizedImage({
  uri,
  thumbnailUri,
  style,
  containerStyle,
  placeholder,
  lazy = true,
  cachePolicy = 'default',
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const mountedRef = useRef(true);
  const viewRef = useRef<View>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Lazy loading com Intersection Observer simulado
  useEffect(() => {
    if (!lazy || inView) return;

    const checkVisibility = () => {
      if (viewRef.current && mountedRef.current) {
        // Simular verificação de visibilidade
        // Em uma implementação real, usaríamos Intersection Observer ou similar
        setInView(true);
      }
    };

    const timer = setTimeout(checkVisibility, 100);
    return () => clearTimeout(timer);
  }, [lazy, inView]);

  // Gerenciamento de cache
  useEffect(() => {
    if (!inView || !uri) return;

    const cacheKey = uri;
    const cached = imageCache[cacheKey];
    const now = Date.now();

    // Verificar se existe cache válido
    if (cached && (now - cached.timestamp) < CACHE_DURATION && cachePolicy !== 'none') {
      if (cached.loaded) {
        setImageUri(cached.uri);
        setLoading(false);
        setError(false);
        return;
      }
    }

    // Carregar imagem
    loadImage();
  }, [inView, uri, cachePolicy]);

  const loadImage = async () => {
    if (!uri || !mountedRef.current) return;

    try {
      setLoading(true);
      setError(false);

      // Primeiro tentar carregar thumbnail se disponível
      if (thumbnailUri) {
        setImageUri(thumbnailUri);
      }

      // Pré-carregar imagem principal
      await preloadImage(uri);
      
      if (mountedRef.current) {
        setImageUri(uri);
        setLoading(false);
        
        // Atualizar cache
        if (cachePolicy !== 'none') {
          imageCache[uri] = {
            uri,
            timestamp: Date.now(),
            loaded: true
          };
        }
        
        onLoad?.();
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(true);
        setLoading(false);
        onError?.(err);
      }
    }
  };

  const preloadImage = (imageUri: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      Image.prefetch(imageUri)
        .then(() => resolve())
        .catch(reject);
    });
  };

  // Limpar cache antigo periodicamente
  useEffect(() => {
    const cleanupCache = () => {
      const now = Date.now();
      Object.keys(imageCache).forEach(key => {
        if (now - imageCache[key].timestamp > CACHE_DURATION) {
          delete imageCache[key];
        }
      });
    };

    const interval = setInterval(cleanupCache, 5 * 60 * 1000); // Limpar a cada 5 minutos
    return () => clearInterval(interval);
  }, []);

  if (!inView) {
    return (
      <View ref={viewRef} style={[styles.container, containerStyle]}>
        {placeholder || <View style={[styles.placeholder, style as ViewStyle]} />}
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer, containerStyle]}>
        <View style={[styles.errorPlaceholder, style as ViewStyle]} />
      </View>
    );
  }

  return (
    <View ref={viewRef} style={[styles.container, containerStyle]}>
      {loading && (
        <View style={[styles.loadingContainer, style as ViewStyle]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={[style, loading && styles.hidden]}
          onLoad={() => {
            if (mountedRef.current) {
              setLoading(false);
              onLoad?.();
            }
          }}
          onError={(err) => {
            if (mountedRef.current) {
              setError(true);
              setLoading(false);
              onError?.(err.nativeEvent.error);
            }
          }}
          resizeMode="cover"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  placeholder: {
    backgroundColor: colors.border,
    borderRadius: 8,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 8,
    zIndex: 1,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorPlaceholder: {
    backgroundColor: colors.danger + '20',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger + '40',
  },
  hidden: {
    opacity: 0,
  },
});

// Função utilitária para limpar cache manualmente
export const clearImageCache = () => {
  Object.keys(imageCache).forEach(key => {
    delete imageCache[key];
  });
};

// Função para pré-carregar imagens em lote
export const preloadImages = async (uris: string[]): Promise<void> => {
  const promises = uris.map(uri => Image.prefetch(uri));
  await Promise.allSettled(promises);
};