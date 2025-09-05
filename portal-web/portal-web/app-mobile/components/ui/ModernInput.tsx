import React, { useState, useRef } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/colors';

interface ModernInputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  variant?: 'default' | 'filled' | 'glass';
  style?: TextStyle;
  containerStyle?: ViewStyle;
}

export function ModernInput({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  variant = 'default',
  style,
  containerStyle,
  ...props
}: ModernInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const labelAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.parallel([
      Animated.timing(focusAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(labelAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!props.value) {
      Animated.parallel([
        Animated.timing(focusAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(labelAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  };

  const getContainerStyle = () => {
    const baseStyle = [styles.container];
    
    switch (variant) {
      case 'filled':
        return [...baseStyle, styles.filledContainer];
      case 'glass':
        return [...baseStyle, styles.glassContainer];
      default:
        return baseStyle;
    }
  };

  const getInputStyle = () => {
    const baseStyle = [styles.input, style];
    
    if (isFocused) {
      baseStyle.push(styles.inputFocused);
    }
    
    if (error) {
      baseStyle.push(styles.inputError);
    }
    
    switch (variant) {
      case 'filled':
        return [...baseStyle, styles.filledInput];
      case 'glass':
        return [...baseStyle, styles.glassInput];
      default:
        return baseStyle;
    }
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.borderFocus],
  });

  const labelTop = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -8],
  });

  const labelScale = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.8],
  });

  return (
    <View style={[containerStyle]}>
      <Animated.View style={[getContainerStyle(), { borderColor }]}>
        {label && (
          <Animated.Text
            style={[
              styles.label,
              {
                top: labelTop,
                transform: [{ scale: labelScale }],
                color: isFocused ? colors.primary : colors.textMuted,
              },
            ]}
          >
            {label}
          </Animated.Text>
        )}
        
        <View style={styles.inputContainer}>
          {leftIcon && (
            <View style={styles.leftIconContainer}>
              {leftIcon}
            </View>
          )}
          
          <TextInput
            {...props}
            style={getInputStyle()}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholderTextColor={colors.textMuted}
            testID={props.testID || label}
            accessibilityLabel={label}
          />
          
          {rightIcon && (
            <TouchableOpacity
              style={styles.rightIconContainer}
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
            >
              {rightIcon}
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    position: 'relative',
    minHeight: 56,
  },
  
  filledContainer: {
    backgroundColor: colors.surfaceVariant,
    borderColor: 'transparent',
  },
  
  glassContainer: {
    backgroundColor: colors.glass,
    borderColor: colors.borderLight,
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  
  input: {
    flex: 1,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  
  inputFocused: {
    color: colors.textPrimary,
  },
  
  inputError: {
    color: colors.danger,
  },
  
  filledInput: {
    color: colors.textPrimary,
  },
  
  glassInput: {
    color: colors.textPrimary,
  },
  
  label: {
    position: 'absolute',
    left: spacing.md,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.medium,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    zIndex: 1,
  },
  
  leftIconContainer: {
    marginRight: spacing.sm,
  },
  
  rightIconContainer: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  
  errorText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.md,
  },
});