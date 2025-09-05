import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Configurar comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: boolean;
  badge?: number;
  categoryId?: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'max';
}

export interface PushToken {
  token: string;
  userId?: string;
  deviceId: string;
  platform: string;
  appVersion: string;
  createdAt: string;
}

class NotificationService {
  private static instance: NotificationService;
  private pushToken: string | null = null;
  private isInitialized = false;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Inicializa o serviço de notificações
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) return true;

      // Verificar se é um dispositivo físico
      if (!Device.isDevice) {
        console.warn('Push notifications não funcionam no simulador');
        return false;
      }

      // Solicitar permissões
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Permissões de notificação negadas');
        return false;
      }

      // Registrar para push notifications
      const token = await this.registerForPushNotifications();
      if (!token) {
        console.warn('Não foi possível obter o token de push');
        return false;
      }

      this.pushToken = token;
      this.isInitialized = true;

      // Salvar token no servidor
      await this.savePushTokenToServer(token);

      // Configurar listeners
      this.setupNotificationListeners();

      console.log('Serviço de notificações inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao inicializar serviço de notificações:', error);
      return false;
    }
  }

  /**
   * Solicita permissões de notificação
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      // Configurar canal de notificação no Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });

        // Canal para notificações de vistoria
        await Notifications.setNotificationChannelAsync('vistoria', {
          name: 'Vistorias',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3B82F6',
          sound: 'default',
          description: 'Notificações relacionadas a vistorias',
        });

        // Canal para notificações de sistema
        await Notifications.setNotificationChannelAsync('system', {
          name: 'Sistema',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250],
          lightColor: '#10B981',
          sound: 'default',
          description: 'Notificações do sistema',
        });
      }

      return true;
    } catch (error) {
      console.error('Erro ao solicitar permissões:', error);
      return false;
    }
  }

  /**
   * Registra o dispositivo para receber push notifications
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      if (!projectId) {
        console.warn('Project ID não encontrado na configuração');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      return token.data;
    } catch (error) {
      console.error('Erro ao registrar para push notifications:', error);
      return null;
    }
  }

  /**
   * Salva o token de push no servidor
   */
  async savePushTokenToServer(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('Usuário não autenticado, salvando token localmente');
        await AsyncStorage.setItem('pendingPushToken', token);
        return;
      }

      const deviceId = await this.getDeviceId();
      const appVersion = Constants.expoConfig?.version || '1.0.0';

      const pushTokenData: Omit<PushToken, 'createdAt'> = {
        token,
        userId: user.id,
        deviceId,
        platform: Platform.OS,
        appVersion,
      };

      // Verificar se já existe um token para este dispositivo
      const { data: existingToken } = await supabase
        .from('push_tokens')
        .select('id')
        .eq('device_id', deviceId)
        .eq('user_id', user.id)
        .single();

      if (existingToken) {
        // Atualizar token existente
        const { error } = await supabase
          .from('push_tokens')
          .update({
            token,
            app_version: appVersion,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingToken.id);

        if (error) throw error;
      } else {
        // Criar novo token
        const { error } = await supabase
          .from('push_tokens')
          .insert({
            token,
            user_id: user.id,
            device_id: deviceId,
            platform: Platform.OS,
            app_version: appVersion,
          });

        if (error) throw error;
      }

      console.log('Token de push salvo no servidor');
    } catch (error) {
      console.error('Erro ao salvar token no servidor:', error);
      // Salvar localmente para tentar novamente depois
      await AsyncStorage.setItem('pendingPushToken', token);
    }
  }

  /**
   * Configura os listeners de notificação
   */
  setupNotificationListeners(): void {
    // Listener para quando uma notificação é recebida
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notificação recebida:', notification);
      // Aqui você pode processar a notificação recebida
    });

    // Listener para quando o usuário toca na notificação
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notificação tocada:', response);
      const data = response.notification.request.content.data;
      
      // Navegar baseado no tipo de notificação
      this.handleNotificationTap(data);
    });
  }

  /**
   * Lida com o toque na notificação
   */
  private handleNotificationTap(data: any): void {
    if (data?.type === 'vistoria' && data?.vistoriaId) {
      // Navegar para a vistoria específica
      // Implementar navegação aqui
      console.log('Navegar para vistoria:', data.vistoriaId);
    } else if (data?.type === 'contestacao' && data?.contestacaoId) {
      // Navegar para a contestação específica
      console.log('Navegar para contestação:', data.contestacaoId);
    }
  }

  /**
   * Envia uma notificação local
   */
  async sendLocalNotification(notificationData: NotificationData): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data || {},
          sound: notificationData.sound !== false ? 'default' : undefined,
          badge: notificationData.badge,
          categoryIdentifier: notificationData.categoryId,
        },
        trigger: null, // Enviar imediatamente
      });

      return identifier;
    } catch (error) {
      console.error('Erro ao enviar notificação local:', error);
      return null;
    }
  }

  /**
   * Agenda uma notificação para o futuro
   */
  async scheduleNotification(
    notificationData: NotificationData,
    trigger: Date | number
  ): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data || {},
          sound: notificationData.sound !== false ? 'default' : undefined,
          badge: notificationData.badge,
          categoryIdentifier: notificationData.categoryId,
        },
        trigger: trigger instanceof Date ? trigger : { seconds: trigger },
      });

      return identifier;
    } catch (error) {
      console.error('Erro ao agendar notificação:', error);
      return null;
    }
  }

  /**
   * Cancela uma notificação agendada
   */
  async cancelNotification(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch (error) {
      console.error('Erro ao cancelar notificação:', error);
    }
  }

  /**
   * Cancela todas as notificações agendadas
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Erro ao cancelar todas as notificações:', error);
    }
  }

  /**
   * Obtém o número de notificações pendentes
   */
  async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Erro ao obter badge count:', error);
      return 0;
    }
  }

  /**
   * Define o número do badge
   */
  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Erro ao definir badge count:', error);
    }
  }

  /**
   * Limpa o badge
   */
  async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  /**
   * Obtém o ID único do dispositivo
   */
  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      
      if (!deviceId) {
        // Gerar um ID único baseado em informações do dispositivo
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2);
        deviceId = `${Platform.OS}-${timestamp}-${random}`;
        
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('Erro ao obter device ID:', error);
      return `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    }
  }

  /**
   * Processa tokens pendentes após login
   */
  async processPendingToken(): Promise<void> {
    try {
      const pendingToken = await AsyncStorage.getItem('pendingPushToken');
      
      if (pendingToken) {
        await this.savePushTokenToServer(pendingToken);
        await AsyncStorage.removeItem('pendingPushToken');
      }
    } catch (error) {
      console.error('Erro ao processar token pendente:', error);
    }
  }

  /**
   * Obtém o token de push atual
   */
  getPushToken(): string | null {
    return this.pushToken;
  }

  /**
   * Verifica se o serviço está inicializado
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

export default NotificationService.getInstance();