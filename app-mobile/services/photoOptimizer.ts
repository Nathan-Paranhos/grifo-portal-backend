import { supabase } from './supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';

interface PhotoUploadOptions {
  vistoriaId: string;
  ambiente: string;
  descricao?: string;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  generateThumbnail?: boolean;
}

interface PhotoMetadata {
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  format: string;
  hash: string;
  compressionRatio: number;
}

export class PhotoOptimizer {
  private static readonly DEFAULT_MAX_WIDTH = 1920;
  private static readonly DEFAULT_MAX_HEIGHT = 1080;
  private static readonly DEFAULT_QUALITY = 0.8;
  private static readonly THUMBNAIL_SIZE = 300;
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Otimiza e faz upload de uma foto
   */
  static async uploadOptimizedPhoto(
    uri: string,
    options: PhotoUploadOptions
  ): Promise<{ url: string; thumbnailUrl?: string; metadata: PhotoMetadata }> {
    try {
      console.log('🔄 Iniciando otimização da foto:', uri);
      
      // 1. Obter informações da imagem original
      const originalInfo = await this.getImageInfo(uri);
      console.log('📊 Informações originais:', originalInfo);

      // 2. Gerar hash da imagem original para evitar duplicatas
      const hash = await this.generateImageHash(uri);
      
      // 3. Verificar se já existe uma foto com o mesmo hash
      const existingPhoto = await this.checkDuplicatePhoto(hash);
      if (existingPhoto) {
        console.log('♻️ Foto duplicada encontrada, reutilizando:', existingPhoto.url);
        return {
          url: existingPhoto.url,
          thumbnailUrl: existingPhoto.url_thumbnail,
          metadata: {
            originalSize: existingPhoto.tamanho_arquivo,
            compressedSize: existingPhoto.tamanho_arquivo,
            width: existingPhoto.largura,
            height: existingPhoto.altura,
            format: existingPhoto.formato,
            hash: existingPhoto.hash_arquivo,
            compressionRatio: 1
          }
        };
      }

      // 4. Otimizar imagem principal
      const optimizedImage = await this.optimizeImage(uri, {
        maxWidth: options.maxWidth || this.DEFAULT_MAX_WIDTH,
        maxHeight: options.maxHeight || this.DEFAULT_MAX_HEIGHT,
        quality: options.quality || this.DEFAULT_QUALITY
      });

      // 5. Gerar thumbnail se solicitado
      let thumbnailResult;
      if (options.generateThumbnail !== false) {
        thumbnailResult = await this.generateThumbnail(uri);
      }

      // 6. Upload da imagem principal
      const timestamp = Date.now();
      const fileName = `vistoria_${options.vistoriaId}_${timestamp}.jpg`;
      const filePath = `fotos/${options.vistoriaId}/${fileName}`;
      
      const uploadResult = await this.uploadToStorage(optimizedImage.uri, filePath);
      
      // 7. Upload do thumbnail
      let thumbnailUrl;
      if (thumbnailResult) {
        const thumbnailPath = `thumbnails/${options.vistoriaId}/thumb_${fileName}`;
        const thumbnailUpload = await this.uploadToStorage(thumbnailResult.uri, thumbnailPath);
        thumbnailUrl = await this.getPublicUrl('fotos', thumbnailPath);
      }

      // 8. Obter URL pública
      const publicUrl = await this.getPublicUrl('fotos', filePath);

      // 9. Salvar metadados no banco
      const metadata: PhotoMetadata = {
        originalSize: originalInfo.size,
        compressedSize: optimizedImage.size,
        width: optimizedImage.width,
        height: optimizedImage.height,
        format: 'jpg',
        hash,
        compressionRatio: originalInfo.size / optimizedImage.size
      };

      await this.savePhotoMetadata({
        vistoriaId: options.vistoriaId,
        url: publicUrl,
        thumbnailUrl,
        ambiente: options.ambiente,
        descricao: options.descricao,
        metadata
      });

      console.log('✅ Upload otimizado concluído:', {
        originalSize: this.formatFileSize(metadata.originalSize),
        compressedSize: this.formatFileSize(metadata.compressedSize),
        compressionRatio: `${(metadata.compressionRatio * 100).toFixed(1)}%`,
        url: publicUrl
      });

      return { url: publicUrl, thumbnailUrl, metadata };
    } catch (error) {
      console.error('❌ Erro no upload otimizado:', error);
      throw error;
    }
  }

  /**
   * Upload em lote com otimização
   */
  static async uploadMultiplePhotos(
    photos: { uri: string; ambiente: string; descricao?: string }[],
    vistoriaId: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<Array<{ url: string; thumbnailUrl?: string; metadata: PhotoMetadata }>> {
    const results = [];
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      onProgress?.(i + 1, photos.length);
      
      try {
        const result = await this.uploadOptimizedPhoto(photo.uri, {
          vistoriaId,
          ambiente: photo.ambiente,
          descricao: photo.descricao
        });
        results.push(result);
      } catch (error) {
        console.error(`Erro no upload da foto ${i + 1}:`, error);
        // Continua com as outras fotos mesmo se uma falhar
      }
    }
    
    return results;
  }

  /**
   * Otimiza uma imagem
   */
  private static async optimizeImage(
    uri: string,
    options: { maxWidth: number; maxHeight: number; quality: number }
  ) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: options.maxWidth,
            height: options.maxHeight
          }
        }
      ],
      {
        compress: options.quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false
      }
    );

    // Obter tamanho do arquivo otimizado
    const response = await fetch(result.uri);
    const blob = await response.blob();
    
    return {
      ...result,
      size: blob.size
    };
  }

  /**
   * Gera thumbnail da imagem
   */
  private static async generateThumbnail(uri: string) {
    return await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: this.THUMBNAIL_SIZE,
            height: this.THUMBNAIL_SIZE
          }
        }
      ],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG
      }
    );
  }

  /**
   * Obtém informações da imagem
   */
  private static async getImageInfo(uri: string) {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return {
      size: blob.size,
      type: blob.type
    };
  }

  /**
   * Gera hash da imagem para evitar duplicatas
   */
  private static async generateImageHash(uri: string): Promise<string> {
    try {
      // Para desenvolvimento, usar timestamp + tamanho como hash simples
      const info = await this.getImageInfo(uri);
      const hashInput = `${uri}_${info.size}_${Date.now()}`;
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.MD5,
        hashInput
      );
    } catch (error) {
      console.warn('Erro ao gerar hash, usando fallback:', error);
      return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Verifica se já existe uma foto com o mesmo hash
   */
  private static async checkDuplicatePhoto(hash: string) {
    try {
      const { data, error } = await supabase
        .from('fotos')
        .select('*')
        .eq('hash_arquivo', hash)
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.warn('Erro ao verificar duplicata:', error);
      }
      
      return data;
    } catch (error) {
      console.warn('Erro ao verificar duplicata:', error);
      return null;
    }
  }

  /**
   * Upload para o Supabase Storage
   */
  private static async uploadToStorage(uri: string, path: string) {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const { data, error } = await supabase.storage
      .from('fotos')
      .upload(path, blob, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) throw error;
    return data;
  }

  /**
   * Obtém URL pública do arquivo
   */
  private static async getPublicUrl(bucket: string, path: string): Promise<string> {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return data.publicUrl;
  }

  /**
   * Salva metadados da foto no banco
   */
  private static async savePhotoMetadata(data: {
    vistoriaId: string;
    url: string;
    thumbnailUrl?: string;
    ambiente: string;
    descricao?: string;
    metadata: PhotoMetadata;
  }) {
    const { error } = await supabase
      .from('fotos')
      .insert({
        vistoria_id: data.vistoriaId,
        url: data.url,
        url_thumbnail: data.thumbnailUrl,
        ambiente: data.ambiente,
        descricao: data.descricao,
        tamanho_arquivo: data.metadata.compressedSize,
        formato: data.metadata.format,
        comprimida: data.metadata.compressionRatio > 1,
        largura: data.metadata.width,
        altura: data.metadata.height,
        hash_arquivo: data.metadata.hash
      });
    
    if (error) throw error;
  }

  /**
   * Formata tamanho de arquivo para exibição
   */
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Obtém estatísticas de uso de fotos
   */
  static async getPhotoStats(empresaId: string) {
    const { data, error } = await supabase
      .from('fotos_stats')
      .select('*')
      .eq('empresa_id', empresaId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.warn('Erro ao obter estatísticas:', error);
      return null;
    }
    
    return data;
  }

  /**
   * Limpa fotos antigas (manutenção)
   */
  static async cleanupOldPhotos(daysOld: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    try {
      // Buscar fotos antigas
      const { data: oldPhotos, error } = await supabase
        .from('fotos')
        .select('id, url, url_thumbnail')
        .lt('created_at', cutoffDate.toISOString());
      
      if (error) throw error;
      
      console.log(`🧹 Encontradas ${oldPhotos?.length || 0} fotos antigas para limpeza`);
      
      // Remover do storage e banco (implementar conforme necessário)
      // Esta função deve ser executada com cuidado em produção
      
      return oldPhotos?.length || 0;
    } catch (error) {
      console.error('Erro na limpeza de fotos antigas:', error);
      throw error;
    }
  }
}

export default PhotoOptimizer;