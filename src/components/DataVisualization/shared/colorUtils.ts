import { interpolateRgb } from 'd3-interpolate';
import { scaleOrdinal, scaleSequential } from 'd3-scale';
import type { Database } from '@/lib/supabase/types';
import type { CategoryColors } from '@/lib/context/AppContext';

type YearsCategory = '0-5' | '6-10' | '11-15' | '16-20' | '20+';
type LearningStyle = Database['public']['Tables']['survey_responses']['Row']['learning_style'];
type ShapedBy = Database['public']['Tables']['survey_responses']['Row']['shaped_by'];
type PeakPerformance = Database['public']['Tables']['survey_responses']['Row']['peak_performance'];
type Motivation = Database['public']['Tables']['survey_responses']['Row']['motivation'];

// Light theme colors
export const lightTheme = {
  primary: '#0077CC', // Medtronic blue
  secondary: '#00A3E0',
  accent: '#FF6B6B',
  background: '#FFFFFF',
  surface: '#F8F9FA',
  text: {
    primary: '#1A1A1A',
    secondary: '#6B7280',
    muted: '#9CA3AF',
  },
  border: '#E5E7EB',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
};

// Dark theme colors
export const darkTheme = {
  primary: '#0088FF', // Brighter blue for dark mode
  secondary: '#00B4FF',
  accent: '#FF7B7B',
  background: '#0A0A0F',
  surface: '#1A1A1F',
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0A0',
    muted: '#707070',
  },
  border: '#2A2A2F',
  error: '#FF4D4D',
  success: '#4CAF50',
  warning: '#FFC107',
};

// Theme-aware color getter function
export function getThemeColors(isDarkMode: boolean = false) {
  return isDarkMode ? darkTheme : lightTheme;
}

// Years to color mapping - now theme-aware
export const getYearsColorScale = (isDarkMode: boolean = false) => {
  const theme = getThemeColors(isDarkMode);
  return scaleOrdinal<YearsCategory, string>()
    .domain(['0-5' as YearsCategory, '6-10' as YearsCategory, '11-15' as YearsCategory, '16-20' as YearsCategory, '20+' as YearsCategory])
    .range([
      interpolateRgb(theme.primary, theme.secondary)(0.2),
      interpolateRgb(theme.primary, theme.secondary)(0.4),
      interpolateRgb(theme.primary, theme.secondary)(0.6),
      interpolateRgb(theme.primary, theme.secondary)(0.8),
      interpolateRgb(theme.primary, theme.secondary)(1),
    ])
    .unknown(theme.surface);
};

// Theme-aware attribute color scales
export const getLearningStyleColors = (isDarkMode: boolean = false) => {
  const baseColors = isDarkMode 
    ? ['#FF8A8A', '#6EDCD4', '#65C7F1', '#B6DEC4']
    : ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
  
  return scaleOrdinal<string, string>()
    .domain(['visual', 'auditory', 'kinesthetic', 'reading_writing'])
    .range(baseColors)
    .unknown(getThemeColors(isDarkMode).surface);
};

export const getShapedByColors = (isDarkMode: boolean = false) => {
  const baseColors = isDarkMode 
    ? ['#FF8A8A', '#6EDCD4', '#65C7F1', '#B6DEC4', '#FFB83C']
    : ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF9F1C'];
  
  return scaleOrdinal<string, string>()
    .domain([
      'mentor',
      'other',
      'failure',
      'education',
      'challenge'
    ])
    .range(baseColors)
    .unknown(getThemeColors(isDarkMode).surface);
};

export const getPeakPerformanceColors = (isDarkMode: boolean = false) => {
  const baseColors = isDarkMode 
    ? ['#FFD486', '#26E6C0', '#2AA2D2', '#1A5B7C', '#FF8A8A']
    : ['#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#FF6B6B'];
  
  return scaleOrdinal<string, string>()
    .domain([
      'individual',
      'innovation',
      'leadership',
      'crisis',
      'team'
    ])
    .range(baseColors)
    .unknown(getThemeColors(isDarkMode).surface);
};

export const getMotivationColors = (isDarkMode: boolean = false) => {
  const baseColors = isDarkMode 
    ? ['#FF8A8A', '#6EDCD4', '#65C7F1', '#B6DEC4', '#FFB83C']
    : ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF9F1C'];
  
  return scaleOrdinal<string, string>()
    .domain([
      'autonomy',
      'recognition',
      'impact',
      'purpose',
      'growth'
    ])
    .range(baseColors)
    .unknown(getThemeColors(isDarkMode).surface);
};

// Theme-aware sequential color scale
export const getSequentialColorScale = (isDarkMode: boolean = false) => {
  const theme = getThemeColors(isDarkMode);
  return scaleSequential(interpolateRgb(theme.primary, theme.secondary))
    .domain([0, 1]);
};

// Helper function to get color for a node using ONLY the admin-driven color map
// This function must NOT use any static color scales for user-customizable categories.
export function getNodeColor(node: { category: string, name: string }, globalColors: CategoryColors, isDarkMode: boolean = false): string {
  // Always use the admin-driven color map as the source of truth
  // Fallback to a neutral gray if not found
  return (
    globalColors[node.category]?.[node.name] ||
    globalColors[node.category]?.[node.name.toLowerCase()] ||
    globalColors[node.category]?.[node.name.toUpperCase()] ||
    '#888888' // fallback color
  );
}

// Accessibility utilities
export function getContrastRatio(foreground: string, background: string): number {
  const getLuminance = (color: string) => {
    const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0];
    const [r, g, b] = rgb.map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isAccessible(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 4.5;
}

// Color interpolation
export function interpolateColors(color1: string, color2: string, t: number): string {
  return interpolateRgb(color1, color2)(t);
}

// Theme-aware color constants
export const getColorConstants = (isDarkMode: boolean = false) => {
  const theme = getThemeColors(isDarkMode);
  return {
    node: {
      default: theme.surface,
      hover: theme.secondary,
      selected: theme.primary,
    },
    edge: {
      default: theme.border,
      hover: theme.secondary,
      selected: theme.primary,
    },
    text: {
      default: theme.text.primary,
      secondary: theme.text.secondary,
      muted: theme.text.muted,
    },
    background: {
      default: theme.background,
      surface: theme.surface,
    },
  };
};

// Backward compatibility - deprecated functions
export const theme = lightTheme;
export const yearsColorScale = getYearsColorScale(false);
export const learningStyleColors = getLearningStyleColors(false);
export const shapedByColors = getShapedByColors(false);
export const peakPerformanceColors = getPeakPerformanceColors(false);
export const motivationColors = getMotivationColors(false);
export const sequentialColorScale = getSequentialColorScale(false);
export const colorConstants = getColorConstants(false);

export function getYearsCategory(years: number): YearsCategory {
  if (years <= 5) return '0-5';
  if (years <= 10) return '6-10';
  if (years <= 15) return '11-15';
  if (years <= 20) return '16-20';
  return '20+';
} 