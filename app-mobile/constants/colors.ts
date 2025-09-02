export const colors = {
  // Professional Dark Background Palette - Inspired by Grifo Portal
  background: '#0A0A0B',
  surface: '#1A1A1C',
  surfaceVariant: '#242428',
  surfaceElevated: '#2D2D32',
  
  // Professional Text Colors
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#9CA3AF',
  textDisabled: '#6B7280',
  
  // Grifo-Inspired Primary Palette (Professional Gold)
  primary: '#F59E0B',
  primaryLight: '#FCD34D',
  primaryDark: '#D97706',
  primaryGradient: ['#F59E0B', '#FCD34D', '#F59E0B'] as const,
  
  // Professional Status Colors
  success: '#059669',
  successLight: '#10B981',
  warning: '#DC2626',
  warningLight: '#EF4444',
  danger: '#B91C1C',
  dangerLight: '#DC2626',
  info: '#1D4ED8',
  infoLight: '#3B82F6',
  error: '#DC2626',
  
  // Professional Accent Colors
  accent: '#F59E0B',
  accentLight: '#FCD34D',
  secondary: '#6366F1',
  secondaryLight: '#818CF8',
  
  // Subtle Borders
  border: '#374151',
  borderLight: '#4B5563',
  borderFocus: '#F59E0B',
  
  // Minimal Shadow
  shadow: 'rgba(0, 0, 0, 0.25)',
  
  // Professional Overlays (No Glass Effects)
  overlay: 'rgba(0, 0, 0, 0.75)',
  backdropBlur: 'rgba(10, 10, 11, 0.85)',
  card: 'rgba(26, 26, 28, 0.95)',
  glass: 'rgba(26, 26, 28, 0.8)',
  text: '#FFFFFF',
  
  // Professional Gradient Combinations
  gradients: {
    primary: ['#F59E0B', '#FCD34D', '#F59E0B'] as const,
    success: ['#059669', '#10B981', '#059669'] as const,
    warning: ['#DC2626', '#EF4444', '#DC2626'] as const,
    danger: ['#B91C1C', '#DC2626', '#B91C1C'] as const,
    surface: ['#1A1A1C', '#242428', '#1A1A1C'] as const,
    accent: ['#6366F1', '#818CF8', '#6366F1'] as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export const typography = {
  fontFamily: {
    regular: 'Poppins-Regular',
    medium: 'Poppins-Medium',
    semibold: 'Poppins-SemiBold',
    bold: 'Poppins-Bold',
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
    huge: 32,
    caption: 12,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
  },
};