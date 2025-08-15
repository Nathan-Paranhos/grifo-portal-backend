import { SupabaseService } from './supabase';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export class StorageService {
  static async compressImage(uri: string, quality = 0.8): Promise<string> {
    try {
      const manipResult = await manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: quality, format: SaveFormat.JPEG }
      );
      
      return manipResult.uri;
    } catch (error) {
      // Error handled silently for production
      return uri;
    }
  }

  static async uploadPhoto(
    localPath: string, 
    storagePath: string, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      // Compress image before upload
      const compressedUri = await this.compressImage(localPath);
      
      // Read file as blob
      const response = await fetch(compressedUri);
      const blob = await response.blob();
      
      // Upload to Supabase Storage
      const uploadData = await SupabaseService.uploadFile('photos', storagePath, blob);
      
      // Get public URL
      const signedUrl = await SupabaseService.getSignedUrl('photos', storagePath);
      
      if (onProgress) onProgress(100);
      
      return signedUrl;
    } catch (error) {
      // Error handled silently for production
      throw error;
    }
  }

  static async uploadPdf(
    localPath: string, 
    storagePath: string, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      // Read PDF file
      const response = await fetch(localPath);
      const blob = await response.blob();
      
      // Upload to Supabase Storage
      const uploadData = await SupabaseService.uploadFile('pdfs', storagePath, blob);
      
      // Get public URL
      const signedUrl = await SupabaseService.getSignedUrl('pdfs', storagePath);
      
      if (onProgress) onProgress(100);
      
      return signedUrl;
    } catch (error) {
      // Error handled silently for production
      throw error;
    }
  }

  static generateStoragePath(type: 'photo' | 'pdf', vistoriaId: string, fileName: string): string {
    const timestamp = Date.now();
    return `${type}s/${vistoriaId}/${timestamp}-${fileName}`;
  }
}