import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';

interface ModernFloatingActionButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  variant?: 'default' | 'gradient' | 'accent';
  size?: 'small' | 'medium' | 'large';
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  style?: ViewStyle;
  disabled?: boolean;
}

export const ModernFloatingActionButton: React.FC<ModernFloatingActionButtonProps> = ({
  onPress,
  icon,
  variant = 'gradient',
  size = 'medium',
  position = 'bottom-right',
  style,
  disabled = false,
}) => {
  const scaleValue = useRef(new Animated.Value(1)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animação de entrada
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Animação de rotação contínua sutil
    const rotateAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(rotateValue, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    rotateAnimation.start();

    return () => rotateAnimation.stop();
  }, [scaleValue, rotateValue]);

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return { width: 48, height: 48 };
      case 'large':
        return { width: 72, height: 72 };
      default:
        return { width: 56, height: 56 };
    }
  };

  const getPositionStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      bottom: 24,
    };

    switch (position) {
      case 'bottom-left':
        return { ...baseStyle, left: 24 };
      case 'bottom-center':
        return { ...baseStyle, alignSelf: 'center' as const };
      default:
        return { ...baseStyle, right: 24 };
    }
  };

  const rotate = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderBackground = () => {
    switch (variant) {
      case 'gradient':
        return (
          <LinearGradient
            colors={[colors.accent, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        );
      case 'accent':
        return null; // Usa backgroundColor do container
      default:
        return null;
    }
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'accent':
        return colors.accent;
      case 'gradient':
        return 'transparent';
      default:
        return colors.primary;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        getSizeStyle(),
        getPositionStyle(),
        {
          transform: [
            { scale: scaleValue },
            { rotate },
          ],
          backgroundColor: getBackgroundColor(),
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {renderBackground()}
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.8}
      >
        {icon}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  button: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ModernFloatingActionButton;