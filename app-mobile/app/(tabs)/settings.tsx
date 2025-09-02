import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SupabaseService } from '@/services/supabase';
import grifoApiService from '@/services/grifoApi';
import { OfflineService } from '@/services/offline';
import { useMe } from '@/hooks/useMe';
import { Card } from '@/components/ui/Card';
import { colors, typography, spacing } from '@/constants/colors';
import { User, LogOut, Trash2, Download, HardDrive, Wifi, WifiOff } from 'lucide-react-native';
import NetInfo from '@react-native-community/netinfo';
import { NotificationSettings } from '@/components/NotificationSettings';
import { SyncStatus } from '@/components/SyncStatus';

export default function SettingsScreen() {
  const { data: user } = useMe(true);
  const [storageInfo, setStorageInfo] = useState({ used: 0, available: 0 });
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    loadStorageInfo();
    checkNetworkStatus();
    
    // Listen for network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected || false);
    });
    
    return () => unsubscribe();
  }, []);



  const loadStorageInfo = async () => {
    try {
      const info = await OfflineService.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      // Error loading storage info handled silently
    }
  };

  const checkNetworkStatus = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      setIsOnline(netInfo.isConnected || false);
    } catch (error) {
      // Error checking network status handled silently
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sair do App',
      'Tem certeza que deseja sair? Dados não sincronizados podem ser perdidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              // Logout do Supabase Auth
      await SupabaseService.signOut();
              
              // Limpar token local
              await grifoApiService.logout();
              
              router.replace('/login');
            } catch (error) {
              console.warn('Erro ao fazer logout:', error);
            }
          },
        },
      ]
    );
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Limpar Cache',
      'Isso removerá todos os dados locais. Certifique-se de que tudo foi sincronizado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineService.clearAllData();
              await loadStorageInfo();
              Alert.alert('Sucesso', 'Cache limpo com sucesso');
            } catch (error) {
                // Error clearing cache handled silently
                Alert.alert('Erro', 'Não foi possível limpar o cache');
            }
          },
        },
      ]
    );
  };

  const formatStorageSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Configurações</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Profile */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Perfil</Text>
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.email}</Text>
            <Text style={styles.profileRole}>Vistoriador</Text>
          </View>
        </Card>

        {/* Network Status */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            {isOnline ? (
              <Wifi size={20} color={colors.success} />
            ) : (
              <WifiOff size={20} color={colors.danger} />
            )}
            <Text style={styles.sectionTitle}>Status da Rede</Text>
          </View>
          
          <View style={styles.networkStatus}>
            <Text style={[styles.networkText, { color: isOnline ? colors.success : colors.danger }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Text style={styles.networkSubtext}>
              {isOnline ? 'Sincronização automática ativa' : 'Modo offline - dados serão sincronizados quando conectar'}
            </Text>
          </View>
        </Card>

        {/* Sync Status */}
        <SyncStatus showDetails={true} />

        {/* Storage Info */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <HardDrive size={20} color={colors.info} />
            <Text style={styles.sectionTitle}>Armazenamento Local</Text>
          </View>
          
          <View style={styles.storageInfo}>
            <Text style={styles.storageText}>
              Usado: {formatStorageSize(storageInfo.used)} / {formatStorageSize(storageInfo.available)}
            </Text>
            <View style={styles.storageBar}>
              <View 
                style={[
                  styles.storageProgress, 
                  { width: `${(storageInfo.used / storageInfo.available) * 100}%` }
                ]} 
              />
            </View>
          </View>
        </Card>

        {/* Notification Settings */}
        <NotificationSettings />

        {/* Actions */}
        <Card style={styles.section}>
          <TouchableOpacity style={styles.actionItem}>
            <Download size={20} color={colors.info} />
            <Text style={styles.actionText}>Exportar Dados</Text>
          </TouchableOpacity>
          
          <View style={styles.separator} />
          
          <TouchableOpacity style={styles.actionItem} onPress={handleClearCache}>
            <Trash2 size={20} color={colors.warning} />
            <Text style={styles.actionText}>Limpar Cache</Text>
          </TouchableOpacity>
          
          <View style={styles.separator} />
          
          <TouchableOpacity style={[styles.actionItem, styles.dangerAction]} onPress={handleSignOut}>
            <LogOut size={20} color={colors.danger} />
            <Text style={[styles.actionText, styles.dangerText]}>Sair do App</Text>
          </TouchableOpacity>
        </Card>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Versão 1.0.0</Text>
          <Text style={styles.appCopyright}>© 2025 Grifo App</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.size.xxl,
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
  },
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  profileInfo: {
    paddingLeft: spacing.lg + spacing.sm,
  },
  profileName: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  profileRole: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
  },
  networkStatus: {
    paddingLeft: spacing.lg + spacing.sm,
  },
  networkText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    marginBottom: spacing.xs,
  },
  networkSubtext: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    lineHeight: 20,
  },
  storageInfo: {
    paddingLeft: spacing.lg + spacing.sm,
  },
  storageText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  storageBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  storageProgress: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  actionText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  dangerAction: {
    // Additional styling for danger actions
  },
  dangerText: {
    color: colors.danger,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  appVersion: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  appCopyright: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
  },
});