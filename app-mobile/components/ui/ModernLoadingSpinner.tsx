import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '@/constants/colors';

interface ModernLoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  variant?: 'default' | 'gradient' | 'pulse' | 'dots';
  color?: string;
}

export function ModernLoadingSpinner({ 
  size = 'medium', 
  text, 
  variant = 'gradient',
  color = colors.secondary 
}: ModernLoadingSpinnerProps) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  const sizeMap = {
    small: 24,
    medium: 40,
    large: 56,
  };

  const spinnerSize = sizeMap[size];

  useEffect(() => {
    if (variant === 'gradient' || variant === 'default') {
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinAnimation.start();
      return () => spinAnimation.stop();
    }

    if (variant === 'pulse') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.3,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }

    if (variant === 'dots') {
      const createDotAnimation = (dot: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, {
              toValue: 1,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
      };

      const animations = [
        createDotAnimation(dot1, 0),
        createDotAnimation(dot2, 200),
        createDotAnimation(dot3, 400),
      ];

      animations.forEach(anim => anim.start());
      return () => animations.forEach(anim => anim.stop());
    }
  }, [variant, spinValue, pulseValue, dot1, dot2, dot3]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderSpinner = () => {
    if (variant === 'dots') {
      return (
        <View style={[styles.dotsContainer, { width: spinnerSize * 1.5 }]}>
          {[dot1, dot2, dot3].map((dot, index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  width: spinnerSize / 4,
                  height: spinnerSize / 4,
                  backgroundColor: color,
                  opacity: dot,
                  transform: [{ scale: dot }],
                },
              ]}
            />
          ))}
        </View>
      );
    }

    if (variant === 'pulse') {
      return (
        <Animated.View
          style={[
            styles.pulseSpinner,
            {
              width: spinnerSize,
              height: spinnerSize,
              borderColor: color,
              transform: [{ scale: pulseValue }],
            },
          ]}
        />
      );
    }

    if (variant === 'gradient') {
      return (
        <Animated.View
          style={[
            styles.gradientContainer,
            {
              width: spinnerSize,
              height: spinnerSize,
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <LinearGradient
            colors={colors.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientSpinner}
          >
            <View style={styles.gradientInner} />
          </LinearGradient>
        </Animated.View>
      );
    }

    // Default variant
    return (
      <Animated.View
        style={[
          styles.defaultSpinner,
          {
            width: spinnerSize,
            height: spinnerSize,
            borderColor: color,
            transform: [{ rotate: spin }],
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderSpinner()}
      {text && (
        <Text style={[styles.text, { fontSize: size === 'small' ? 12 : 14 }]}>
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  defaultSpinner: {
    borderWidth: 3,
    borderRadius: 1000,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  gradientContainer: {
    borderRadius: 1000,
    padding: 3,
  },
  gradientSpinner: {
    flex: 1,
    borderRadius: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientInner: {
    width: '70%',
    height: '70%',
    backgroundColor: colors.background,
    borderRadius: 1000,
  },
  pulseSpinner: {
    borderWidth: 3,
    borderRadius: 1000,
    backgroundColor: 'transparent',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dot: {
    borderRadius: 1000,
  },
  text: {
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    textShadowColor: `${colors.shadow}30`,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});