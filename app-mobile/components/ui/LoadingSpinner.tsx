import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/constants/colors';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  text?: string;
  color?: string;
}

export function LoadingSpinner({ 
  size = 'large', 
  text, 
  color = colors.primary 
}: LoadingSpinnerProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});