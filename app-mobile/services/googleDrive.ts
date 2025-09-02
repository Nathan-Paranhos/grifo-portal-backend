import { google } from 'googleapis';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
  accessToken?: string;
}

interface BackupFile {
  id: string;
  name: string;
  localPath: string;
  driveFileId?: string;
  size: number;
  mimeType: string;
  createdAt: string;
  lastBackup?: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retryCount: number;
}

interface BackupStats {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  totalSize: number;
  uploadedSize: number;
  lastBackup: string | null;
  isBackupRunning: boolean;
}

class GoogleDriveService {
  private oauth2Client: any;
  private drive: any;
  private config: GoogleDriveConfig | null = null;
  private backupQueue: BackupFile[] = [];
  private isInitialized = false;
  private backupInProgress = false;

  private readonly STORAGE_KEYS = {
    CONFIG: 'google_drive_config',
    BACKUP_QUEUE: 'google_drive_backup_queue',
    BACKUP_STATS: 'google_drive_backup_stats',
  };

  /**
   * Inicializar o serviço Google Drive
   */
  async initialize(config: GoogleDriveConfig): Promise<void> {
    try {
      this.config = config;
      
      // Configurar OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
      );

      // Definir credenciais se disponíveis
      if (config.accessToken && config.refreshToken) {
        this.oauth2Client.setCredentials({
          access_token: config.accessToken,
          refresh_token: config.refreshToken,
        });
      }

      // Inicializar Google Drive API
      this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      // Salvar configuração
      await this.saveConfig(config);
      
      // Carregar fila de backup
      await this.loadBackupQueue();

      this.isInitialized = true;
      console.log('Google Drive service initialized successfully');
    } catch (error) {
      console.error('Error initializing Google Drive service:', error);
      throw error;
    }
  }

  /**
   * Verificar se o serviço está autenticado
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.oauth2Client) {
        return false;
      }

      // Tentar fazer uma chamada simples para verificar autenticação
      await this.drive.files.list({ pageSize: 1 });
      return true;
    } catch (error) {
      console.warn('Google Drive authentication check failed:', error);
      return false;
    }
  }

  /**
   * Obter URL de autorização
   */
  getAuthUrl(): string {
    if (!this.oauth2Client) {
      throw new Error('OAuth2 client not initialized');
    }

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.appdata',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  /**
   * Trocar código de autorização por tokens
   */
  async exchangeCodeForTokens(code: string): Promise<void> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Atualizar configuração com tokens
      if (this.config) {
        this.config.accessToken = tokens.access_token;
        this.config.refreshToken = tokens.refresh_token;
        await this.saveConfig(this.config);
      }

      console.log('Google Drive tokens obtained successfully');
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  /**
   * Adicionar arquivo à fila de backup
   */
  async addToBackupQueue(filePath: string, fileName?: string): Promise<void> {
    try {
      const fileStats = await RNFS.stat(filePath);
      const backupFile: BackupFile = {
        id: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: fileName || fileStats.name,
        localPath: filePath,
        size: fileStats.size,
        mimeType: this.getMimeType(filePath),
        createdAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
      };

      this.backupQueue.push(backupFile);
      await this.saveBackupQueue();

      console.log(`File added to backup queue: ${fileName || fileStats.name}`);
    } catch (error) {
      console.error('Error adding file to backup queue:', error);
      throw error;
    }
  }

  /**
   * Processar fila de backup
   */
  async processBackupQueue(): Promise<void> {
    if (this.backupInProgress) {
      console.log('Backup already in progress');
      return;
    }

    try {
      this.backupInProgress = true;
      
      // Verificar conectividade
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('No internet connection, skipping backup');
        return;
      }

      // Verificar autenticação
      if (!(await this.isAuthenticated())) {
        console.log('Not authenticated with Google Drive');
        return;
      }

      const pendingFiles = this.backupQueue.filter(file => 
        file.status === 'pending' || (file.status === 'failed' && file.retryCount < 3)
      );

      console.log(`Processing ${pendingFiles.length} files in backup queue`);

      for (const file of pendingFiles) {
        try {
          await this.uploadFile(file);
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          file.status = 'failed';
          file.retryCount++;
        }
      }

      await this.saveBackupQueue();
      await this.updateBackupStats();
    } catch (error) {
      console.error('Error processing backup queue:', error);
    } finally {
      this.backupInProgress = false;
    }
  }

  /**
   * Upload de arquivo individual
   */
  private async uploadFile(backupFile: BackupFile): Promise<void> {
    try {
      backupFile.status = 'uploading';
      await this.saveBackupQueue();

      // Verificar se o arquivo ainda existe
      const fileExists = await RNFS.exists(backupFile.localPath);
      if (!fileExists) {
        throw new Error('File no longer exists');
      }

      // Ler arquivo
      const fileContent = await RNFS.readFile(backupFile.localPath, 'base64');
      const buffer = Buffer.from(fileContent, 'base64');

      // Criar pasta do app no Google Drive se não existir
      const folderId = await this.ensureAppFolder();

      // Metadata do arquivo
      const fileMetadata = {
        name: backupFile.name,
        parents: [folderId],
      };

      // Upload do arquivo
      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: {
          mimeType: backupFile.mimeType,
          body: buffer,
        },
      });

      // Atualizar informações do backup
      backupFile.driveFileId = response.data.id;
      backupFile.status = 'completed';
      backupFile.lastBackup = new Date().toISOString();

      console.log(`File uploaded successfully: ${backupFile.name}`);
    } catch (error) {
      console.error(`Error uploading file ${backupFile.name}:`, error);
      backupFile.status = 'failed';
      throw error;
    }
  }

  /**
   * Garantir que a pasta do app existe no Google Drive
   */
  private async ensureAppFolder(): Promise<string> {
    try {
      const folderName = 'Grifo Vistoria App';
      
      // Procurar pasta existente
      const response = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name)',
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Criar nova pasta
      const folderResponse = await this.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
      });

      return folderResponse.data.id;
    } catch (error) {
      console.error('Error ensuring app folder:', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas de backup
   */
  async getBackupStats(): Promise<BackupStats> {
    try {
      const savedStats = await AsyncStorage.getItem(this.STORAGE_KEYS.BACKUP_STATS);
      if (savedStats) {
        return JSON.parse(savedStats);
      }

      // Calcular estatísticas da fila atual
      return this.calculateBackupStats();
    } catch (error) {
      console.error('Error getting backup stats:', error);
      return this.getDefaultStats();
    }
  }

  /**
   * Calcular estatísticas de backup
   */
  private calculateBackupStats(): BackupStats {
    const totalFiles = this.backupQueue.length;
    const completedFiles = this.backupQueue.filter(f => f.status === 'completed').length;
    const failedFiles = this.backupQueue.filter(f => f.status === 'failed').length;
    const totalSize = this.backupQueue.reduce((sum, f) => sum + f.size, 0);
    const uploadedSize = this.backupQueue
      .filter(f => f.status === 'completed')
      .reduce((sum, f) => sum + f.size, 0);
    
    const completedBackups = this.backupQueue.filter(f => f.lastBackup);
    const lastBackup = completedBackups.length > 0 
      ? completedBackups.sort((a, b) => new Date(b.lastBackup!).getTime() - new Date(a.lastBackup!).getTime())[0].lastBackup
      : null;

    return {
      totalFiles,
      completedFiles,
      failedFiles,
      totalSize,
      uploadedSize,
      lastBackup,
      isBackupRunning: this.backupInProgress,
    };
  }

  /**
   * Atualizar estatísticas de backup
   */
  private async updateBackupStats(): Promise<void> {
    try {
      const stats = this.calculateBackupStats();
      await AsyncStorage.setItem(this.STORAGE_KEYS.BACKUP_STATS, JSON.stringify(stats));
    } catch (error) {
      console.error('Error updating backup stats:', error);
    }
  }

  /**
   * Limpar arquivos completados da fila
   */
  async clearCompletedBackups(): Promise<void> {
    try {
      this.backupQueue = this.backupQueue.filter(file => file.status !== 'completed');
      await this.saveBackupQueue();
      await this.updateBackupStats();
    } catch (error) {
      console.error('Error clearing completed backups:', error);
    }
  }

  /**
   * Obter tipo MIME do arquivo
   */
  private getMimeType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      pdf: 'application/pdf',
      txt: 'text/plain',
      json: 'application/json',
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * Salvar configuração
   */
  private async saveConfig(config: GoogleDriveConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving Google Drive config:', error);
    }
  }

  /**
   * Carregar configuração
   */
  async loadConfig(): Promise<GoogleDriveConfig | null> {
    try {
      const config = await AsyncStorage.getItem(this.STORAGE_KEYS.CONFIG);
      return config ? JSON.parse(config) : null;
    } catch (error) {
      console.error('Error loading Google Drive config:', error);
      return null;
    }
  }

  /**
   * Salvar fila de backup
   */
  private async saveBackupQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.BACKUP_QUEUE, JSON.stringify(this.backupQueue));
    } catch (error) {
      console.error('Error saving backup queue:', error);
    }
  }

  /**
   * Carregar fila de backup
   */
  private async loadBackupQueue(): Promise<void> {
    try {
      const queue = await AsyncStorage.getItem(this.STORAGE_KEYS.BACKUP_QUEUE);
      this.backupQueue = queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Error loading backup queue:', error);
      this.backupQueue = [];
    }
  }

  /**
   * Obter estatísticas padrão
   */
  private getDefaultStats(): BackupStats {
    return {
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      totalSize: 0,
      uploadedSize: 0,
      lastBack