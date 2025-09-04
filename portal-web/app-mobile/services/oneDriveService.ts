import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';

export interface OneDriveConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface OneDriveToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface OneDriveUser {
  id: string;
  displayName: string;
  mail: string;
}

export interface SyncResult {
  success: boolean;
  uploadedFiles: number;
  errors: string[];
}

class OneDriveService {
  private config: OneDriveConfig = {
    clientId: 'your-client-id', // Substituir pelo Client ID real
    redirectUri: 'your-app://auth',
    scopes: ['Files.ReadWrite', 'User.Read'],
  };

  private baseUrl = 'https://graph.microsoft.com/v1.0';

  /**
   * Inicia o processo de autenticação OAuth2
   */
  async authenticate(): Promise<{ success: boolean; error?: string }> {
    try {
      // Em uma implementação real, você abriria o navegador para autenticação
      // Por enquanto, vamos simular o processo
      
      const authUrl = this.buildAuthUrl();
      console.log('Auth URL:', authUrl);
      
      // TODO: Implementar WebBrowser quando expo-web-browser estiver disponível
      // const { WebBrowser } = await import('expo-web-browser');
      // const result = await WebBrowser.openAuthSessionAsync(
      //   authUrl,
      //   'exp://localhost:8081/--/auth/callback' // Redirect URI para desenvolvimento
      // );
      
      // Temporariamente retornar erro até implementar alternativa
      throw new Error('Autenticação OneDrive temporariamente indisponível');
      
      // TODO: Descomentar quando WebBrowser estiver disponível
      // if (result.type === 'success' && result.url) {
      //   const url = new URL(result.url);
      //   const code = url.searchParams.get('code');
      //   
      //   if (code) {
      //     const tokenData = await this.exchangeCodeForToken(code);
      //     if (tokenData) {
      //       const token: OneDriveToken = {
      //         accessToken: tokenData.access_token,
      //         refreshToken: tokenData.refresh_token,
      //         expiresAt: Date.now() + (tokenData.expires_in * 1000)
      //       };
      //       await this.saveToken(token);
      //     }
      //   }
      // } else {
      //   throw new Error('Autenticação cancelada ou falhou');
      // }
      
      // Buscar informações do usuário
      const user = await this.getCurrentUser();
      if (user) {
        await AsyncStorage.setItem('onedrive_user', JSON.stringify(user));
      }
      
      return { success: true };
    } catch (error) {
      console.error('Erro na autenticação:', error);
      return { success: false, error: 'Falha na autenticação' };
    }
  }

  /**
   * Constrói a URL de autenticação OAuth2
   */
  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      response_mode: 'query',
    });
    
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Obtém informações do usuário atual
   */
  async getCurrentUser(): Promise<OneDriveUser | null> {
    try {
      const token = await this.getValidToken();
      if (!token) return null;
      
      // Buscar dados reais do usuário via Microsoft Graph API
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Microsoft Graph API error: ${response.status}`);
      }
      
      const userData = await response.json();
      
      return {
        id: userData.id,
        displayName: userData.displayName,
        mail: userData.mail || userData.userPrincipalName,
      };
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }
  }

  /**
   * Sincroniza vistorias com OneDrive
   */
  async syncVistorias(): Promise<SyncResult> {
    try {
      const token = await this.getValidToken();
      if (!token) {
        return { success: false, uploadedFiles: 0, errors: ['Token não encontrado'] };
      }

      // Buscar vistorias do Supabase
      const { data: vistorias, error } = await supabase
        .from('vistorias')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, uploadedFiles: 0, errors: [error.message] };
      }

      const errors: string[] = [];
      let uploadedFiles = 0;

      // Criar pasta para vistorias se não existir
      await this.createFolder('Vistorias');

      // Upload de cada vistoria
      for (const vistoria of vistorias || []) {
        try {
          const fileName = `vistoria_${vistoria.id}_${new Date(vistoria.created_at).toISOString().split('T')[0]}.json`;
          const content = JSON.stringify(vistoria, null, 2);
          
          await this.uploadFile(`Vistorias/${fileName}`, content);
          uploadedFiles++;
        } catch (error) {
          errors.push(`Erro ao fazer upload da vistoria ${vistoria.id}: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        uploadedFiles,
        errors,
      };
    } catch (error) {
      console.error('Erro na sincronização de vistorias:', error);
      return {
        success: false,
        uploadedFiles: 0,
        errors: ['Erro geral na sincronização'],
      };
    }
  }

  /**
   * Sincroniza fotos com OneDrive
   */
  async syncPhotos(): Promise<SyncResult> {
    try {
      const token = await this.getValidToken();
      if (!token) {
        return { success: false, uploadedFiles: 0, errors: ['Token não encontrado'] };
      }

      // Buscar fotos do Supabase Storage
      const { data: files, error } = await supabase.storage
        .from('vistoria-photos')
        .list();

      if (error) {
        return { success: false, uploadedFiles: 0, errors: [error.message] };
      }

      const errors: string[] = [];
      let uploadedFiles = 0;

      // Criar pasta para fotos se não existir
      await this.createFolder('Fotos');

      // Upload de cada foto
      for (const file of files || []) {
        try {
          // Download da foto do Supabase
          const { data: photoData, error: downloadError } = await supabase.storage
            .from('vistoria-photos')
            .download(file.name);

          if (downloadError) {
            errors.push(`Erro ao baixar foto ${file.name}: ${downloadError.message}`);
            continue;
          }

          // Upload para OneDrive
          const arrayBuffer = await photoData.arrayBuffer();
          await this.uploadBinaryFile(`Fotos/${file.name}`, arrayBuffer);
          uploadedFiles++;
        } catch (error) {
          errors.push(`Erro ao fazer upload da foto ${file.name}: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        uploadedFiles,
        errors,
      };
    } catch (error) {
      console.error('Erro na sincronização de fotos:', error);
      return {
        success: false,
        uploadedFiles: 0,
        errors: ['Erro geral na sincronização'],
      };
    }
  }

  /**
   * Cria uma pasta no OneDrive
   */
  private async createFolder(folderName: string): Promise<void> {
    try {
      const token = await this.getValidToken();
      if (!token) throw new Error('Token não encontrado');
      
      const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao criar pasta: ${response.status}`);
      }
      
      console.log(`Pasta criada com sucesso: ${folderName}`);
    } catch (error) {
      console.error(`Erro ao criar pasta ${folderName}:`, error);
      throw error;
    }
  }

  /**
   * Faz upload de um arquivo de texto para OneDrive
   */
  private async uploadFile(path: string, content: string): Promise<void> {
    try {
      const token = await this.getValidToken();
      if (!token) throw new Error('Token não encontrado');
      
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: content
      });
      
      if (!response.ok) {
        throw new Error(`Erro no upload: ${response.status}`);
      }
      
      console.log(`Upload realizado com sucesso: ${path}`);
    } catch (error) {
      console.error(`Erro no upload de ${path}:`, error);
      throw error;
    }
  }

  /**
   * Faz upload de um arquivo binário para OneDrive
   */
  private async uploadBinaryFile(path: string, data: ArrayBuffer): Promise<void> {
    try {
      const token = await this.getValidToken();
      if (!token) throw new Error('Token não encontrado');
      
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/octet-stream'
        },
        body: data
      });
      
      if (!response.ok) {
        throw new Error(`Erro no upload binário: ${response.status}`);
      }
      
      console.log(`Upload binário realizado com sucesso: ${path}`);
    } catch (error) {
      console.error(`Erro no upload binário de ${path}:`, error);
      throw error;
    }
  }

  /**
   * Obtém um token válido, renovando se necessário
   */
  private async getValidToken(): Promise<OneDriveToken | null> {
    try {
      const tokenData = await AsyncStorage.getItem('onedrive_token');
      if (!tokenData) return null;
      
      const token: OneDriveToken = JSON.parse(tokenData);
      
      // Verificar se o token ainda é válido
      if (Date.now() < token.expiresAt) {
        return token;
      }
      
      // Token expirado, tentar renovar
      const newToken = await this.refreshToken(token.refreshToken);
      if (newToken) {
        await this.saveToken(newToken);
        return newToken;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao obter token:', error);
      return null;
    }
  }

  /**
   * Renova o token de acesso
   */
  private async refreshToken(refreshToken: string): Promise<OneDriveToken | null> {
    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope: 'Files.ReadWrite User.Read offline_access'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }
      
      const tokenData = await response.json();
      
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
      };
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      return null;
    }
  }

  /**
   * Salva o token no AsyncStorage
   */
  private async saveToken(token: OneDriveToken): Promise<void> {
    await AsyncStorage.setItem('onedrive_token', JSON.stringify(token));
  }

  /**
   * Troca o código de autorização por tokens de acesso
   */
  private async exchangeCodeForToken(code: string): Promise<any> {
    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          code: code,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
          scope: 'Files.ReadWrite User.Read offline_access'
        })
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      throw new Error(`Token exchange failed: ${response.status}`);
    } catch (error) {
      console.error('Erro ao trocar código por token:', error);
      return null;
    }
  }

  /**
   * Remove a autenticação
   */
  async disconnect(): Promise<void> {
    await AsyncStorage.multiRemove([
      'onedrive_token',
      'onedrive_user',
      'onedrive_connection',
      'onedrive_sync_stats',
    ]);
  }

  /**
   * Verifica se está conectado
   */
  async isConnected(): Promise<boolean> {
    const token = await this.getValidToken();
    return token !== null;
  }

  /**
   * Sincronização completa
   */
  async fullSync(): Promise<{
    success: boolean;
    vistoriasResult: SyncResult;
    photosResult: SyncResult;
  }> {
    const vistoriasResult = await this.syncVistorias();
    const photosResult = await this.syncPhotos();
    
    return {
      success: vistoriasResult.success && photosResult.success,
      vistoriasResult,
      photosResult,
    };
  }
}

export const oneDriveService = new OneDriveService();