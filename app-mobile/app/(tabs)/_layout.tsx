import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { colors, spacing } from '@/constants/colors';
import { AuthGuard } from '@/components/AuthGuard';
import { Home, FileText, Camera, Settings, Cloud } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: `${colors.surface}F0`,
            borderTopColor: `${colors.border}60`,
            borderTopWidth: 1,
            paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
            paddingTop: spacing.md,
            height: Platform.OS === 'ios' ? 85 : 70,
            shadowColor: colors.shadow,
            shadowOffset: {
              width: 0,
              height: -4,
            },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 8,
            backdropFilter: 'blur(20px)',
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: spacing.xs,
            textShadowColor: `${colors.shadow}20`,
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 1,
          },
          tabBarIconStyle: {
            marginBottom: spacing.xs / 2,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Home size={size || 24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="vistorias"
          options={{
            title: 'Vistorias',
            tabBarIcon: ({ color, size }) => (
              <FileText size={size || 24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="camera"
          options={{
            title: 'Câmera',
            tabBarIcon: ({ color, size }) => (
              <Camera size={size || 24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="onedrive"
          options={{
            title: 'OneDrive',
            tabBarIcon: ({ color, size }) => (
              <Cloud size={size || 24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Configurações',
            tabBarIcon: ({ color, size }) => (
              <Settings size={size || 24} color={color} />
            ),
          }}
        />
      </Tabs>
    </AuthGuard>
  );
}