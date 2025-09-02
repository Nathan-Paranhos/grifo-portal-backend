import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius } from '@/constants/colors';

interface ModernCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'none' | 'small' | 'medium' | 'large';
  variant?: 'default' | 'elevated' | 'outlined' | 'glass' | 'gradient';
  size?: 'small' | 'medium' | 'large';
  shadow?: boolean;
  borderRadius?: 'none' | 'small' | 'medium' | 'large' | 'full';
  gradientColors?: string[];
  borderColor?: string;
  glowEffect?: boolean;
  testID?: string;
}

export function ModernCard({ 
  children, 
  style, 
  padding = 'medium',
  variant = 'default',
  size = 'medium',
  shadow = false,
  borderRadius = 'medium',
  gradientColors,
  borderColor,
  glowEffect = false,
  testID
}: ModernCardProps) {
  const getCardStyle = () => {
    const baseStyle = [styles.card, styles[`padding_${padding}`], styles[`size_${size}`], styles[`radius_${borderRadius}`], style];
    
    switch (variant) {
      case 'elevated':
        return [...baseStyle, styles.elevated];
      case 'outlined':
        return [...baseStyle, styles.outlined];
      case 'glass':
        return [...baseStyle, styles.glass];
      default:
        return baseStyle;
    }
  };

  const renderCard = () => {
    if (variant === 'gradient' && gradientColors) {
      return (
        <LinearGradient
          colors={gradientColors as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={getCardStyle()}
        >
          {children}
        </LinearGradient>
      );
    }

    return (
      <View 
        style={[
          getCardStyle(),
          borderColor && { borderColor },
          (glowEffect || shadow) && styles.glow
        ]}
        testID={testID}
      >
        {children}
      </View>
    );
  };

  return renderCard();
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  elevated: {
    backgroundColor: colors.surfaceElevated,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  
  glass: {
    backgroundColor: colors.glass,
    borderColor: colors.borderLight,
    backdropFilter: 'blur(20px)',
  },
  
  glow: {
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  
  // Padding styles
  padding_none: {
    padding: 0,
  },
  padding_small: {
    padding: spacing.sm,
  },
  padding_medium: {
    padding: spacing.md,
  },
  padding_large: {
    padding: spacing.lg,
  },
  
  // Size styles
  size_small: {
    minHeight: 80,
  },
  size_medium: {
    minHeight: 120,
  },
  size_large: {
    minHeight: 160,
  },
  
  // Border radius styles
  radius_none: {
    borderRadius: 0,
  },
  radius_small: {
    borderRadius: borderRadius.sm,
  },
  radius_medium: {
    borderRadius: borderRadius.md,
  },
  radius_large: {
    borderRadius: borderRadius.lg,
  },
  radius_full: {
    borderRadius: 9999,
  },
});