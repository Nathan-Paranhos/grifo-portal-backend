import React, { useRef } from 'react';
import { 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ViewStyle, 
  TextStyle,
  Animated,
  Pressable
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius } from '@/constants/colors';

interface ModernButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'gradient' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  gradientColors?: string[];
  glowEffect?: boolean;
  hapticFeedback?: boolean;
  testID?: string;
}

export function ModernButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  gradientColors,
  glowEffect = false,
  hapticFeedback = true,
  testID,
}: ModernButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getButtonStyle = () => {
    const baseStyle = [
      styles.base,
      styles[variant],
      styles[size],
      (disabled || loading) && styles.disabled,
      glowEffect && styles.glow,
      style,
    ];
    return baseStyle;
  };

  const getTextStyle = () => {
    return [
      styles.text,
      styles[`${variant}Text`],
      styles[`${size}Text`],
      textStyle,
    ];
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator 
          size="small" 
          color={variant === 'primary' || variant === 'gradient' ? colors.textPrimary : colors.primary} 
        />
      );
    }

    return (
      <>
        {icon}
        <Text style={getTextStyle()}>{title}</Text>
      </>
    );
  };

  const renderButton = () => {
    if (variant === 'gradient') {
      const gradColors = gradientColors || colors.gradients.primary;
      return (
        <Animated.View
          style={[
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}
            testID={testID}
            style={({ pressed }) => [
              getButtonStyle(),
              pressed && styles.pressed,
            ]}
          >
            <LinearGradient
              colors={gradColors as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.gradientContainer, styles[size]]}
            >
              {renderContent()}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      );
    }

    return (
      <Animated.View
        style={[
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || loading}
          testID={testID}
          style={({ pressed }) => [
            getButtonStyle(),
            pressed && styles.pressed,
          ]}
        >
          {renderContent()}
        </Pressable>
      </Animated.View>
    );
  };

  return renderButton();
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.borderRadius.lg,
    gap: spacing.sm,
  },
  
  // Variants
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  gradient: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  glass: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  
  // Sizes
  sm: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  md: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  lg: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    minHeight: 60,
  },
  
  // Text Styles
  text: {
    fontFamily: typography.fontFamily.semibold,
    textAlign: 'center',
  },
  
  primaryText: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
  },
  outlineText: {
    color: colors.primary,
    fontSize: typography.size.md,
  },
  dangerText: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
  },
  gradientText: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
  },
  glassText: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
  },
  
  smText: {
    fontSize: typography.size.sm,
  },
  mdText: {
    fontSize: typography.size.md,
  },
  lgText: {
    fontSize: typography.size.lg,
  },
  
  gradientContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.borderRadius.lg,
    gap: spacing.sm,
  },
  
  disabled: {
    opacity: 0.5,
  },
  
  pressed: {
    opacity: 0.8,
  },
  
  glow: {
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
});