import React from 'react';
import { TextInput, View, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  multiline?: boolean;
}

export function Input({ label, error, style, multiline, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    minHeight: 48,
  },
  multiline: {
    minHeight: 100,
    maxHeight: 150,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});