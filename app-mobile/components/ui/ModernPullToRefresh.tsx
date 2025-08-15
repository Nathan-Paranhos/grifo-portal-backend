import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  RefreshControl,
  ScrollView,
  Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RefreshCw } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/colors';

interface ModernPullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  title?: string;
  subtitle?: string;
  variant?: 'default' | 'gradient' | 'minimal';
}

export function ModernPullToRefresh({
  children,
  onRefresh,
  refreshing,
  title = 'Puxe para atualizar',
  subtitle = 'Solte para recarregar',
  variant = 'gradient',
}: ModernPullToRefreshProps) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;
  const opacityValue = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (refreshing) {
      // Start spinning animation
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleValue, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleValue, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );

      const opacityAnimation = Animated.timing(opacityValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      });

      spinAnimation.start();
      pulseAnimation.start();
      opacityAnimation.start();

      return () => {
        spinAnimation.stop();
        pulseAnimation.stop();
      };
    } else {
      // Reset animations
      spinValue.setValue(0);
      scaleValue.setValue(1);
      Animated.timing(opacityValue, {
        toValue: 0.7,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [refreshing, opacityValue, scaleValue, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderRefreshIndicator = () => {
    if (variant === 'minimal') {
      return (
        <View style={styles.minimalIndicator}>
          <Animated.View
            style={{
              transform: [{ rotate: spin }, { scale: scaleValue }],
              opacity: opacityValue,
            }}
          >
            <RefreshCw size={24} color={colors.accent} />
          </Animated.View>
        </View>
      );
    }

    if (variant === 'gradient') {
      return (
        <LinearGradient
          colors={colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientIndicator}
        >
          <Animated.View
            style={{
              transform: [{ rotate: spin }, { scale: scaleValue }],
              opacity: opacityValue,
            }}
          >
            <RefreshCw size={20} color={colors.surface} />
          </Animated.View>
          {!refreshing && (
            <View style={styles.textContainer}>
              <Text style={styles.gradientTitle}>{title}</Text>
              <Text style={styles.gradientSubtitle}>{subtitle}</Text>
            </View>
          )}
        </LinearGradient>
      );
    }

    // Default variant
    return (
      <View style={styles.defaultIndicator}>
        <Animated.View
          style={{
            transform: [{ rotate: spin }, { scale: scaleValue }],
            opacity: opacityValue,
          }}
        >
          <View style={styles.iconContainer}>
            <RefreshCw size={24} color={colors.accent} />
          </View>
        </Animated.View>
        {!refreshing && (
          <View style={styles.textContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        )}
      </View>
    );
  };

  const customRefreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="transparent"
      colors={['transparent']}
      progressBackgroundColor="transparent"
      style={{ backgroundColor: 'transparent' }}
    />
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={customRefreshControl}
      showsVerticalScrollIndicator={false}
      bounces={true}
      scrollEventThrottle={16}
    >
      {refreshing && (
        <View style={styles.refreshContainer}>
          {renderRefreshIndicator()}
        </View>
      )}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  refreshContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  defaultIndicator: {
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: `${colors.surface}F0`,
    borderRadius: spacing.borderRadius * 2,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  gradientIndicator: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.borderRadius * 2,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  minimalIndicator: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  iconContainer: {
    padding: spacing.sm,
    backgroundColor: `${colors.accent}20`,
    borderRadius: spacing.borderRadius,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  title: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  gradientTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.surface,
    textAlign: 'center',
    textShadowColor: `${colors.textMuted}40`,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  gradientSubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: `${colors.surface}E0`,
    textAlign: 'center',
    marginTop: spacing.xs,
    textShadowColor: `${colors.textMuted}40`,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});