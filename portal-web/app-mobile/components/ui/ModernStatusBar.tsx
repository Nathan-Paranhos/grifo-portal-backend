import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/colors';

interface ModernStatusBarProps {
  variant?: 'default' | 'gradient' | 'transparent';
  style?: 'auto' | 'inverted' | 'light' | 'dark';
}

export function ModernStatusBar({ 
  variant = 'default', 
  style = 'auto' 
}: ModernStatusBarProps) {
  if (variant === 'gradient') {
    return (
      <>
        <StatusBar style={style} />
        <LinearGradient
          colors={colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBar}
        />
      </>
    );
  }

  if (variant === 'transparent') {
    return (
      <>
        <StatusBar style={style} translucent backgroundColor="transparent" />
        <View style={styles.transparentBar} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={style} backgroundColor={colors.background} />
      <View style={[styles.defaultBar, { backgroundColor: colors.background }]} />
    </>
  );
}

const styles = StyleSheet.create({
  defaultBar: {
    height: 0, // StatusBar height is handled automatically
  },
  gradientBar: {
    height: 0, // StatusBar height is handled automatically
  },
  transparentBar: {
    height: 0, // StatusBar height is handled automatically
  },
});