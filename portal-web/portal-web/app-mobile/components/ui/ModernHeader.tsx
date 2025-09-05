import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MoreVertical } from 'lucide-react-native';
import { colors, typography, spacing } from '@/constants/colors';

interface ModernHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  showMenuButton?: boolean;
  onBackPress?: () => void;
  onMenuPress?: () => void;
  variant?: 'default' | 'gradient' | 'glass';
  rightComponent?: React.ReactNode;
}

export function ModernHeader({
  title,
  subtitle,
  showBackButton = false,
  showMenuButton = false,
  onBackPress,
  onMenuPress,
  variant = 'default',
  rightComponent,
}: ModernHeaderProps) {
  const renderContent = () => (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {showBackButton && (
          <TouchableOpacity
            onPress={onBackPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.centerSection}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <View style={styles.rightSection}>
        {rightComponent}
        {showMenuButton && (
          <TouchableOpacity
            onPress={onMenuPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <MoreVertical size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={colors.gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        {renderContent()}
      </LinearGradient>
    );
  }

  if (variant === 'glass') {
    return (
      <View style={[styles.baseContainer, styles.glassContainer]}>
        {renderContent()}
      </View>
    );
  }

  return (
    <View style={[styles.baseContainer, styles.defaultContainer]}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  baseContainer: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  defaultContainer: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  gradientContainer: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  glassContainer: {
    backgroundColor: `${colors.surface}CC`,
    backdropFilter: 'blur(20px)',
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}40`,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.sm,
    borderRadius: spacing.borderRadius.sm,
    backgroundColor: `${colors.surface}80`,
  },
  title: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight as any,
    color: colors.text,
    textAlign: 'center',
    textShadowColor: `${colors.shadow}30`,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: typography.size.caption,
    fontWeight: '400' as any,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});