import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '@/constants/colors';

interface ModernProgressBarProps {
  progress: number; // 0 to 1
  variant?: 'default' | 'gradient' | 'success' | 'warning' | 'error';
  size?: 'small' | 'medium' | 'large';
  showPercentage?: boolean;
  label?: string;
  animated?: boolean;
  style?: ViewStyle;
  indeterminate?: boolean;
}

export const ModernProgressBar: React.FC<ModernProgressBarProps> = ({
  progress,
  variant = 'default',
  size = 'medium',
  showPercentage = false,
  label,
  animated = true,
  style,
  indeterminate = false,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const indeterminateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (indeterminate) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(indeterminateAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(indeterminateAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [indeterminate, indeterminateAnim]);

  useEffect(() => {
    if (!indeterminate && animated) {
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else if (!indeterminate) {
      progressAnim.setValue(progress);
    }
  }, [progress, animated, indeterminate, progressAnim]);

  const getHeight = () => {
    switch (size) {
      case 'small':
        return 4;
      case 'large':
        return 12;
      default:
        return 8;
    }
  };

  const getColors = () => {
    switch (variant) {
      case 'gradient':
        return [colors.accent, colors.primary];
      case 'success':
        return [colors.success, colors.success];
      case 'warning':
        return [colors.warning, colors.warning];
      case 'error':
        return [colors.error, colors.error];
      default:
        return [colors.primary, colors.primary];
    }
  };

  const renderProgressBar = () => {
    if (indeterminate) {
      const translateX = indeterminateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-100, 300],
      });

      return (
        <View style={[styles.track, { height: getHeight() }]}>
          <Animated.View
            style={[
              styles.indeterminateBar,
              {
                height: getHeight(),
                transform: [{ translateX }],
              },
            ]}
          >
            <LinearGradient
              colors={getColors()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      );
    }

    const width = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
      extrapolate: 'clamp',
    });

    return (
      <View style={[styles.track, { height: getHeight() }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              width,
              height: getHeight(),
            },
          ]}
        >
          {variant === 'gradient' ? (
            <LinearGradient
              colors={getColors()}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: getColors()[0] },
              ]}
            />
          )}
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
          {showPercentage && !indeterminate && (
            <Text style={styles.percentage}>
              {Math.round(progress * 100)}%
            </Text>
          )}
        </View>
      )}
      {renderProgressBar()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    color: colors.textSecondary,
  },
  percentage: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  track: {
    backgroundColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  indeterminateBar: {
    width: 100,
    borderRadius: 10,
    overflow: 'hidden',
  },
});