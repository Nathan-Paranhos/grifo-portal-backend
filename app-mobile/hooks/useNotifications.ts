import { useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import NotificationService, { NotificationData } from '../services/notificationService';

export interface UseNotificationsReturn {
  // Estados
  isInitialized: boolean;
  hasPermission: boolean;
  pushToken: string | null;
  badgeCount: number;
  isLoading: boolean;
  error: string | null;
  
  // Funções
  initialize: () => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
  sendLocalNotification: (data: NotificationData) => Promise<string | null>;
  scheduleNotification: (data: NotificationData, trigger: Date | number) => Promise<string | null>;
  cancelNotification: (identifier: string) => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
  setBadgeCount: (count: number) => Promise<void>;
  clearBadge: () => Promise<void>;
  refreshBadgeCount: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook personalizado para gerenciar notificações push
 */
export const useNotifications = (): UseNotificationsReturn => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [badgeCount, setBadgeCountState] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Inicializa o serviço de notificações
   */
  const initialize = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const success = await NotificationService.initialize();
      
      if (success) {
        setIsInitialized(true);
        setHasPermission(true);
        setPushToken(NotificationService.getPushToken());
        await refreshBadgeCount();
      } else {
        setError('Falha ao inicializar o serviço de notificações');
      }

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Solicita permissões de notificação
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const granted = await NotificationService.requestPermissions();
      setHasPermission(granted);

      if (!granted) {
        setError('Permissões de notificação negadas');
      }

      return granted;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao solicitar permissões';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Envia uma notificação local
   */
  const sendLocalNotification = useCallback(async (data: NotificationData): Promise<string | null> => {
    try {
      setError(null);
      
      if (!isInitialized) {
        throw new Error('Serviço de notificações não inicializado');
      }

      const identifier = await NotificationService.sendLocalNotification(data);
      
      if (!identifier) {
        throw new Error('Falha ao enviar notificação');
      }

      return identifier;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao enviar notificação';
      setError(errorMessage);
      return null;
    }
  }, [isInitialized]);

  /**
   * Agenda uma notificação
   */
  const scheduleNotification = useCallback(async (
    data: NotificationData,
    trigger: Date | number
  ): Promise<string | null> => {
    try {
      setError(null);
      
      if (!isInitialized) {
        throw new Error('Serviço de notificações não inicializado');
      }

      const identifier = await NotificationService.scheduleNotification(data, trigger);
      
      if (!identifier) {
        throw new Error('Falha ao agendar notificação');
      }

      return identifier;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao agendar notificação';
      setError(errorMessage);
      return null;
    }
  }, [isInitialized]);

  /**
   * Cancela uma notificação específica
   */
  const cancelNotification = useCallback(async (identifier: string): Promise<void> => {
    try {
      setError(null);
      await NotificationService.cancelNotification(identifier);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar notificação';
      setError(errorMessage);
    }
  }, []);

  /**
   * Cancela todas as notificações
   */
  const cancelAllNotifications = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await NotificationService.cancelAllNotifications();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar notificações';
      setError(errorMessage);
    }
  }, []);

  /**
   * Define o número do badge
   */
  const setBadgeCount = useCallback(async (count: number): Promise<void> => {
    try {
      setError(null);
      await NotificationService.setBadgeCount(count);
      setBadgeCountState(count);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao definir badge';
      setError(errorMessage);
    }
  }, []);

  /**
   * Limpa o badge
   */
  const clearBadge = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await NotificationService.clearBadge();
      setBadgeCountState(0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao limpar badge';
      setError(errorMessage);
    }
  }, []);

  /**
   * Atualiza o contador do badge
   */
  const refreshBadgeCount = useCallback(async (): Promise<void> => {
    try {
      const count = await NotificationService.getBadgeCount();
      setBadgeCountState(count);
    } catch (err) {
      console.error('Erro ao atualizar badge count:', err);
    }
  }, []);

  /**
   * Limpa o erro atual
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /**
   * Verifica o status das permissões na inicialização
   */
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setHasPermission(status === 'granted');
        
        // Verificar se o serviço já está inicializado
        if (NotificationService.isServiceInitialized()) {
          setIsInitialized(true);
          setPushToken(NotificationService.getPushToken());
          await refreshBadgeCount();
        }
      } catch (err) {
        console.error('Erro ao verificar permissões:', err);
      }
    };

    checkPermissions();
  }, [refreshBadgeCount]);

  /**
   * Listener para mudanças no badge count
   */
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      // Atualizar badge count quando uma notificação é recebida
      refreshBadgeCount();
    });

    return () => subscription.remove();
  }, [refreshBadgeCount]);

  return {
    // Estados
    isInitialized,
    hasPermission,
    pushToken,
    badgeCount,
    isLoading,
    error,
    
    // Funções
    initialize,
    requestPermissions,
    sendLocalNotification,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    setBadgeCount,
    clearBadge,
    refreshBadgeCount,
    clearError,
  };
};

export default useNotifications;