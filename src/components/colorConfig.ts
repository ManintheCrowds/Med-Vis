// This file is managed by the /admin/controls dashboard (Color Configuration section)
// To add or edit colors, use the Color Configuration section in the admin panel.

// Shared color configuration for category labels (social orientation, time of day, etc.)
// Add more as needed for new categories
export const CATEGORY_COLORS: Record<string, string> = {
  // Peak Performance Categories (exact values from survey form)
  'Extrovert, Morning': '#27ae60',
  'Extrovert, Evening': '#16a085',
  'Introvert, Morning': '#f39c12',
  'Introvert, Night': '#c0392b',
  'Ambivert, Morning': '#2980b9',
  'Ambivert, Night': '#8e44ad',
  
  // Other categories
  'team': '#00b894',
  'success': '#fdcb6e',
  'mentor': '#e17055',
  'challenge': '#6c5ce7',
  'failure': '#d63031',
  'other': '#636e72',
  
  // Learning styles
  'visual': '#00cec9',
  'auditory': '#fd79a8',
  'kinesthetic': '#fdcb6e',
  'reading_writing': '#74b9ff',
  
  // Motivation types
  'impact': '#00b894',
  'growth': '#6c5ce7',
  'recognition': '#fdcb6e',
  'autonomy': '#fd79a8',
  'purpose': '#00cec9',
  
  // Years at Medtronic
  '0-5': '#74b9ff',
  '6-10': '#55a3ff',
  '11-15': '#3498db',
  '16-20': '#2980b9',
  '20+': '#fdcb6e',
};

export default CATEGORY_COLORS; 