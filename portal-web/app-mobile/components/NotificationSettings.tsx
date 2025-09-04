import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Bell, BellOff, Settings, CheckCircle, XCircle } from 'lucide-react-native';
import { useNotifications } from '../hooks/useNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationSettingsProps {
  onClose?: () => void;
}

interface NotificationPreferences {
  vistoriaUpdates: boolean;
  contestacaoUpdates: boolean;
  systemNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  badgeEnabled: boolean;
}

const defaultPreferences: NotificationPreferences = {
  vistoriaUpdates: true,
  contestacaoUpdates: true,
  systemNotifications: true,
  soundEnabled: true,
  vibrationEnabled: true,
  badgeEnabled: true,
};

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onClose }) => {
  const {
    isInitialized,
    hasPermission,
    pushToken,
    badgeCount,
    isLoading,
    error,
    initialize,
    requestPermissions,
    sendLocalNotification,
    clearBadge,
    clearError,
  } = useNotifications();

  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Carrega as preferências salvas
   */
  useEffect(() => {
    loadPreferences();
  }, []);

  /**
   * Carrega preferências do AsyncStorage
   */
  const loadPreferences = async () => {
    try {
      const saved = await AsyncStorage.getItem('notificationPreferences');
      if (saved) {
        const parsedPreferences = JSON.parse(saved);
        setPreferences({ ...defaultPreferences, ...parsedPreferences });
      }
    } catch (error) {
      console.error('Erro ao carregar preferências:', error);
    }
  };

  /**
   * Salva as preferências
   */
  const savePreferences = async (newPreferences: NotificationPreferences) => {
    try {
      setIsSaving(true);
      await AsyncStorage.setItem('notificationPreferences', JSON.stringify(newPreferences));
      setPreferences(newPreferences);
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
      Alert.alert('Erro', 'Não foi possível salvar as preferências');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Atualiza uma preferência específica
   */
  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    const newPreferences = { ...preferences, [key]: value };
    savePreferences(newPreferences);
  };

  /**
   * Inicializa as notificações
   */
  const handleInitialize = async () => {
    const success = await initialize();
    if (success) {
      Alert.alert('Sucesso', 'Notificações configuradas com sucesso!');
    }
  };

  /**
   * Solicita permissões
   */
  const handleRequestPermissions = async () => {
    const granted = await requestPermissions();
    if (granted) {
      Alert.alert('Sucesso', 'Permissões concedidas!');
    } else {
      Alert.alert(
        'Permissões Negadas',
        'Para receber notificações, você precisa habilitar as permissões nas configurações do dispositivo.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Configurações', onPress: () => {/* Abrir configurações do app */} },
        ]
      );
    }
  };

  /**
   * Testa uma notificação
   */
  const testNotification = async () => {
    if (!isInitialized || !hasPermission) {
      Alert.alert('Erro', 'Notificações não estão configuradas');
      return;
    }

    const success = await sendLocalNotification({
      title: 'Teste de Notificação',
      body: 'Esta é uma notificação de teste do Sistema Grifo',
      data: { type: 'test' },
      sound: preferences.soundEnabled,
      badge: preferences.badgeEnabled ? badgeCount + 1 : undefined,
    });

    if (success) {
      Alert.alert('Sucesso', 'Notificação de teste enviada!');
    }
  };

  /**
   * Limpa o badge
   */
  const handleClearBadge = async () => {
    await clearBadge();
    Alert.alert('Sucesso', 'Badge limpo!');
  };

  /**
   * Renderiza um item de configuração
   */
  const renderSettingItem = (
    title: string,
    description: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    disabled = false
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled || isSaving}
        trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
        thumbColor={value ? '#FFFFFF' : '#9CA3AF'}
      />
    </View>
  );

  /**
   * Renderiza o status das notificações
   */
  const renderStatus = () => {
    let statusIcon;
    let statusText;
    let statusColor;

    if (isLoading) {
      statusIcon = <Settings size={20} color="#F59E0B" />;
      statusText = 'Configurando...';
      statusColor = '#F59E0B';
    } else if (error) {
      statusIcon = <XCircle size={20} color="#EF4444" />;
      statusText = 'Erro na configuração';
      statusColor = '#EF4444';
    } else if (isInitialized && hasPermission) {
      statusIcon = <CheckCircle size={20} color="#10B981" />;
      statusText = 'Configurado';
      statusColor = '#10B981';
    } else {
      statusIcon = <BellOff size={20} color="#6B7280" />;
      statusText = 'Não configurado';
      statusColor = '#6B7280';
    }

    return (
      <View style={styles.statusContainer}>
        {statusIcon}
        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Bell size={24} color="#3B82F6" />
          <Text style={styles.headerTitle}>Configurações de Notificação</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <XCircle size={24} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        {renderStatus()}
        
        {pushToken && (
          <View style={styles.tokenInfo}>
            <Text style={styles.tokenLabel}>Token:</Text>
            <Text style={styles.tokenValue} numberOfLines={1} ellipsizeMode="middle">
              {pushToken}
            </Text>
          </View>
        )}
        
        {badgeCount > 0 && (
          <View style={styles.badgeInfo}>
            <Text style={styles.badgeText}>Badge: {badgeCount}</Text>
            <TouchableOpacity onPress={handleClearBadge} style={styles.clearBadgeButton}>
              <Text style={styles.clearBadgeText}>Limpar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Erro */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError} style={styles.clearErrorButton}>
            <Text style={styles.clearErrorText}>Limpar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Ações */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ações</Text>
        
        {!isInitialized && (
          <TouchableOpacity
            onPress={handleInitialize}
            style={styles.actionButton}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>Inicializar Notificações</Text>
          </TouchableOpacity>
        )}
        
        {!hasPermission && (
          <TouchableOpacity
            onPress={handleRequestPermissions}
            style={styles.actionButton}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>Solicitar Permissões</Text>
          </TouchableOpacity>
        )}
        
        {isInitialized && hasPermission && (
          <TouchableOpacity
            onPress={testNotification}
            style={styles.testButton}
            disabled={isLoading}
          >
            <Text style={styles.testButtonText}>Testar Notificação</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Preferências */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipos de Notificação</Text>
        
        {renderSettingItem(
          'Atualizações de Vistoria',
          'Receber notificações sobre mudanças nas vistorias',
          preferences.vistoriaUpdates,
          (value) => updatePreference('vistoriaUpdates', value),
          !hasPermission
        )}
        
        {renderSettingItem(
          'Atualizações de Contestação',
          'Receber notificações sobre contestações',
          preferences.contestacaoUpdates,
          (value) => updatePreference('contestacaoUpdates', value),
          !hasPermission
        )}
        
        {renderSettingItem(
          'Notificações do Sistema',
          'Receber notificações gerais do sistema',
          preferences.systemNotifications,
          (value) => updatePreference('systemNotifications', value),
          !hasPermission
        )}
      </View>

      {/* Configurações de Apresentação */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Apresentação</Text>
        
        {renderSettingItem(
          'Som',
          'Reproduzir som ao receber notificações',
          preferences.soundEnabled,
          (value) => updatePreference('soundEnabled', value),
          !hasPermission
        )}
        
        {renderSettingItem(
          'Vibração',
          'Vibrar ao receber notificações',
          preferences.vibrationEnabled,
          (value) => updatePreference('vibrationEnabled', value),
          !hasPermission
        )}
        
        {renderSettingItem(
          'Badge',
          'Mostrar contador no ícone do app',
          preferences.badgeEnabled,
          (value) => updatePreference('badgeEnabled', value),
          !hasPermission
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  closeButton: {
    padding: 4,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  tokenInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tokenLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  tokenValue: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'monospace',
  },
  badgeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 14,
    color: '#374151',
  },
  clearBadgeButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#EF4444',
    borderRadius: 4,
  },
  clearBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 16,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 8,
  },
  clearErrorButton: {
    alignSelf: 'flex-start',
  },
  clearErrorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  actionButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
});

export default NotificationSettings;