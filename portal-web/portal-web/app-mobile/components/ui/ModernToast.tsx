import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react-native';
import { colors, typography, spacing } from '@/constants/colors';

interface ModernToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onHide?: () => void;
  position?: 'top' | 'bottom';
}

export function ModernToast({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onHide,
  position = 'top',
}: ModernToastProps) {
  const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  const typeConfig = {
    success: {
      icon: CheckCircle,
      colors: [colors.success, `${colors.success}E0`, colors.success] as const,
      iconColor: colors.surface,
    },
    error: {
      icon: XCircle,
      colors: [colors.danger, `${colors.danger}E0`, colors.danger] as const,
      iconColor: colors.surface,
    },
    warning: {
      icon: AlertCircle,
      colors: [colors.warning, `${colors.warning}E0`, colors.warning] as const,
      iconColor: colors.surface,
    },
    info: {
      icon: Info,
      colors: [colors.secondary, `${colors.secondary}E0`, colors.secondary] as const,
      iconColor: colors.surface,
    },
  };

  const config = typeConfig[type];
  const IconComponent = config.icon;

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();

      // Auto hide
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible, duration]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -100 : 100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.topPosition : styles.bottomPosition,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <LinearGradient
        colors={config.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <IconComponent size={24} color={config.iconColor} />
          <Text style={styles.message}>{message}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  topPosition: {
    top: spacing.xl + 20,
  },
  bottomPosition: {
    bottom: spacing.xl + 20,
  },
  gradient: {
    borderRadius: 16,
    padding: spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.surface,
    textShadowColor: `${colors.overlay}40`,
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 2,
  },
});