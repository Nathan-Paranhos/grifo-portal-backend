import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, X, Filter } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

interface ModernSearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onClear?: () => void;
  onFilterPress?: () => void;
  variant?: 'default' | 'gradient' | 'glass' | 'outlined';
  size?: 'small' | 'medium' | 'large';
  showFilter?: boolean;
  showFilterButton?: boolean;
  showClearButton?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  style?: any;
  testID?: string;
}

export const ModernSearchBar: React.FC<ModernSearchBarProps> = ({
  placeholder = 'Buscar...',
  value = '',
  onChangeText,
  onFocus,
  onBlur,
  onClear,
  onFilterPress,
  variant = 'default',
  size = 'medium',
  showFilter = false,
  showFilterButton = false,
  showClearButton = true,
  disabled = false,
  autoFocus = false,
  style,
  testID,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, animatedValue]);

  const handleFocus = () => {
    setIsFocused(true);
    Animated.spring(scaleValue, {
      toValue: 1.02,
      useNativeDriver: false,
    }).start();
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
    onBlur?.();
  };

  const handleClear = () => {
    onChangeText?.('');
    onClear?.();
  };

  const borderColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.accent],
  });

  const shadowOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.3],
  });

  const renderBackground = () => {
    switch (variant) {
      case 'gradient':
        return (
          <LinearGradient
            colors={[colors.surface, colors.surfaceVariant]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        );
      case 'glass':
        return (
          <LinearGradient
            colors={[
              `${colors.surface}20`,
              `${colors.surface}40`,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        );
      default:
        return null;
    }
  };

  const getContainerStyle = () => {
    const baseStyle = [
      styles.container,
      styles[`size_${size}`],
      {
        transform: [{ scale: scaleValue }],
        borderColor,
        shadowOpacity,
        backgroundColor: variant === 'default' ? colors.surface : 'transparent',
      },
      style,
    ];
    
    if (variant === 'outlined') {
      baseStyle.push(styles.outlined);
    }
    
    return baseStyle;
  };

  return (
    <Animated.View style={getContainerStyle()}>
      {renderBackground()}
      
      <View style={styles.searchIcon}>
        <Search size={20} color={isFocused ? colors.accent : colors.textSecondary} />
      </View>

      <TextInput
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            fontSize: typography.body.fontSize,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        editable={!disabled}
        returnKeyType="search"
        clearButtonMode="never"
        testID={testID}
        accessibilityLabel={placeholder}
      />

      {value.length > 0 && showClearButton && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {(showFilter || showFilterButton) && (
        <TouchableOpacity
          style={styles.filterButton}
          onPress={onFilterPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Filter size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  
  // Size variants
  size_small: {
    height: 36,
    paddingHorizontal: 12,
  },
  size_medium: {
    height: 48,
    paddingHorizontal: 16,
  },
  size_large: {
    height: 56,
    paddingHorizontal: 20,
  },
  
  // Variant styles
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  
  searchIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  filterButton: {
    marginLeft: 8,
    padding: 4,
  },
});

export default ModernSearchBar;