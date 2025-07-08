"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the structure for category colors with theme support
export interface CategoryColors {
  [category: string]: {
    [answer: string]: string;
  };
}

// Define theme-aware color settings
export interface ThemeAwareColors {
  light: CategoryColors;
  dark: CategoryColors;
}

// Define the global visualization settings
export interface VisualizationSettings {
  // Color settings with theme support
  categoryColors: ThemeAwareColors;
  
  // Theme settings
  isDarkMode: boolean;
  
  // Data settings
  useTestData: boolean;
  
  // Animation settings
  autoPlaySpeed: number; // milliseconds between transitions
  isAutoPlayEnabled: boolean;
}

// Default light mode colors
const defaultLightColors: CategoryColors = {
  years_at_medtronic: {
    '0-5': '#74b9ff',
    '6-10': '#55a3ff',
    '11-15': '#3498db',
    '16-20': '#2980b9',
    '20+': '#fdcb6e'
  },
  peak_performance: {
    'Extrovert, Morning': '#27ae60',
    'Extrovert, Evening': '#16a085',
    'Introvert, Morning': '#f39c12',
    'Introvert, Night': '#c0392b',
    'Ambivert, Morning': '#2980b9',
    'Ambivert, Night': '#8e44ad'
  },
  learning_style: {
    'visual': '#00cec9',
    'auditory': '#fd79a8',
    'kinesthetic': '#fdcb6e',
    'reading_writing': '#74b9ff'
  },
  motivation: {
    'impact': '#00b894',
    'growth': '#6c5ce7',
    'recognition': '#fdcb6e',
    'autonomy': '#fd79a8',
    'purpose': '#00cec9'
  },
  shaped_by: {
    'mentor': '#e17055',
    'challenge': '#6c5ce7',
    'failure': '#d63031',
    'success': '#fdcb6e',
    'team': '#00b894',
    'other': '#636e72'
  }
};

// Default dark mode colors - enhanced versions with better contrast
const defaultDarkColors: CategoryColors = {
  years_at_medtronic: {
    '0-5': '#8ac4ff',
    '6-10': '#75b3ff',
    '11-15': '#5aa8eb',
    '16-20': '#4a90c9',
    '20+': '#fddb8e'
  },
  peak_performance: {
    'Extrovert, Morning': '#2ecc71',
    'Extrovert, Evening': '#1abc9c',
    'Introvert, Morning': '#f1c40f',
    'Introvert, Night': '#e74c3c',
    'Ambivert, Morning': '#3498db',
    'Ambivert, Night': '#9b59b6'
  },
  learning_style: {
    'visual': '#00d4cf',
    'auditory': '#fd8bb8',
    'kinesthetic': '#fddb8e',
    'reading_writing': '#8ac4ff'
  },
  motivation: {
    'impact': '#00d4a4',
    'growth': '#7c6cf7',
    'recognition': '#fddb8e',
    'autonomy': '#fd8bb8',
    'purpose': '#00d4cf'
  },
  shaped_by: {
    'mentor': '#e17a65',
    'challenge': '#7c6cf7',
    'failure': '#e74c3c',
    'success': '#fddb8e',
    'team': '#00d4a4',
    'other': '#7c8c8c'
  }
};

// Default settings
const defaultSettings: VisualizationSettings = {
  categoryColors: {
    light: defaultLightColors,
    dark: defaultDarkColors
  },
  isDarkMode: false,
  useTestData: true,
  autoPlaySpeed: 5000, // 5 seconds
  isAutoPlayEnabled: true
};

// Context interface
interface AppContextType {
  settings: VisualizationSettings;
  updateCategoryColor: (category: string, answer: string, color: string, theme?: 'light' | 'dark') => void;
  toggleDarkMode: () => void;
  toggleTestData: () => void;
  updateAutoPlaySpeed: (speed: number) => void;
  toggleAutoPlay: () => void;
  resetToDefaults: () => void;
  getCurrentThemeColors: () => CategoryColors;
}

// Create the context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<VisualizationSettings>(defaultSettings);

  const updateCategoryColor = (category: string, answer: string, color: string, theme?: 'light' | 'dark') => {
    const targetTheme = theme || (settings.isDarkMode ? 'dark' : 'light');
    
    setSettings(prev => ({
      ...prev,
      categoryColors: {
        ...prev.categoryColors,
        [targetTheme]: {
          ...prev.categoryColors[targetTheme],
          [category]: {
            ...prev.categoryColors[targetTheme][category],
            [answer]: color
          }
        }
      }
    }));
  };

  const toggleDarkMode = () => {
    setSettings(prev => ({
      ...prev,
      isDarkMode: !prev.isDarkMode
    }));
  };

  const toggleTestData = () => {
    setSettings(prev => ({
      ...prev,
      useTestData: !prev.useTestData
    }));
  };

  const updateAutoPlaySpeed = (speed: number) => {
    setSettings(prev => ({
      ...prev,
      autoPlaySpeed: speed
    }));
  };

  const toggleAutoPlay = () => {
    setSettings(prev => ({
      ...prev,
      isAutoPlayEnabled: !prev.isAutoPlayEnabled
    }));
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
  };

  const getCurrentThemeColors = () => {
    return settings.isDarkMode ? settings.categoryColors.dark : settings.categoryColors.light;
  };

  const value: AppContextType = {
    settings,
    updateCategoryColor,
    toggleDarkMode,
    toggleTestData,
    updateAutoPlaySpeed,
    toggleAutoPlay,
    resetToDefaults,
    getCurrentThemeColors
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}; 