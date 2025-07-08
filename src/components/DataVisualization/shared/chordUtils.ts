import { interpolateRgb } from 'd3-interpolate';
import { scaleOrdinal } from 'd3-scale';
import { chord, ribbon } from 'd3-chord';
import * as d3 from 'd3';
import type { Database } from '@/lib/supabase/types';

type YearsCategory = '0-5' | '6-10' | '11-15' | '16-20' | '20+';
type LearningStyle = Database['public']['Tables']['survey_responses']['Row']['learning_style'];
type ShapedBy = Database['public']['Tables']['survey_responses']['Row']['shaped_by'];
type PeakPerformance = Database['public']['Tables']['survey_responses']['Row']['peak_performance'];
type Motivation = Database['public']['Tables']['survey_responses']['Row']['motivation'];

// Chord-specific configuration
export const chordConfig = {
  // Arc properties
  arcOpacity: 0.8,
  arcStroke: 2,
  
  // Chord properties  
  chordOpacity: 0.6,
  chordHoverOpacity: 0.9,
  chordMinWidth: 3,
  
  // Animation
  transitionDuration: 800,
  rotationSpeed: 0.5,
  
  // Typography
  labelFontWeight: 700,
  labelFontSize: '1.25rem',
  
  // Layout
  innerRadius: 0.6,
  outerRadius: 0.9,
  padding: 0.05,
};

// Cycling modes for chord diagram
export const cyclingModes = [
  { 
    focus: 'years-learning', 
    duration: 4000, 
    description: 'Experience & Learning Styles',
    source: 'years_at_medtronic',
    target: 'learning_style'
  },
  { 
    focus: 'years-shaped', 
    duration: 4000, 
    description: 'Experience & Formative Influences',
    source: 'years_at_medtronic',
    target: 'shaped_by'
  },
  { 
    focus: 'years-performance', 
    duration: 4000, 
    description: 'Experience & Peak Performance',
    source: 'years_at_medtronic',
    target: 'peak_performance'
  },
  { 
    focus: 'years-motivation', 
    duration: 4000, 
    description: 'Experience & Current Motivation',
    source: 'years_at_medtronic',
    target: 'motivation'
  },
  { 
    focus: 'learning-performance', 
    duration: 4000, 
    description: 'Learning Style & Peak Performance',
    source: 'learning_style',
    target: 'peak_performance'
  },
  { 
    focus: 'motivation-shaped', 
    duration: 4000, 
    description: 'Motivation & Shaped By',
    source: 'motivation',
    target: 'shaped_by'
  }
];

// Color scales for chord arcs (reuse from alluvial)
export const chordColorScales = {
  years_at_medtronic: scaleOrdinal<YearsCategory, string>()
    .domain(['0-5' as YearsCategory, '6-10' as YearsCategory, '11-15' as YearsCategory, '16-20' as YearsCategory, '20+' as YearsCategory])
    .range([
      interpolateRgb('#0077CC', '#00A3E0')(0.2),
      interpolateRgb('#0077CC', '#00A3E0')(0.4),
      interpolateRgb('#0077CC', '#00A3E0')(0.6),
      interpolateRgb('#0077CC', '#00A3E0')(0.8),
      interpolateRgb('#0077CC', '#00A3E0')(1),
    ])
    .unknown('#1A1A1F'),

  learning_style: scaleOrdinal<NonNullable<LearningStyle>, string>()
    .domain(['visual' as NonNullable<LearningStyle>, 'auditory' as NonNullable<LearningStyle>, 'kinesthetic' as NonNullable<LearningStyle>, 'reading_writing' as NonNullable<LearningStyle>])
    .range(['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'])
    .unknown('#1A1A1F'),

  shaped_by: scaleOrdinal<NonNullable<ShapedBy>, string>()
    .domain([
      'mentor' as NonNullable<ShapedBy>,
      'challenge' as NonNullable<ShapedBy>,
      'failure' as NonNullable<ShapedBy>,
      'success' as NonNullable<ShapedBy>,
      'team' as NonNullable<ShapedBy>,
      'other' as NonNullable<ShapedBy>,
    ])
    .range(['#FF9F1C', '#2EC4B6', '#E71D36', '#011627', '#FF6B6B', '#4ECDC4'])
    .unknown('#1A1A1F'),

  peak_performance: scaleOrdinal<NonNullable<PeakPerformance>, string>()
    .domain([
      'Extrovert, Morning' as NonNullable<PeakPerformance>,
      'Extrovert, Evening' as NonNullable<PeakPerformance>,
      'Introvert, Morning' as NonNullable<PeakPerformance>,
      'Introvert, Night' as NonNullable<PeakPerformance>,
      'Ambivert, Morning' as NonNullable<PeakPerformance>,
      'Ambivert, Night' as NonNullable<PeakPerformance>,
    ])
    .range(['#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#FF6B6B', '#4ECDC4'])
    .unknown('#1A1A1F'),

  motivation: scaleOrdinal<NonNullable<Motivation>, string>()
    .domain([
      'impact' as NonNullable<Motivation>,
      'growth' as NonNullable<Motivation>,
      'recognition' as NonNullable<Motivation>,
      'autonomy' as NonNullable<Motivation>,
      'purpose' as NonNullable<Motivation>,
    ])
    .range(['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF9F1C'])
    .unknown('#1A1A1F'),
};

// Data structures for chord diagram
export interface ChordMatrix {
  matrix: number[][];
  names: string[];
  groups: ChordGroup[];
  chords: ChordLink[];
}

export interface ChordGroup {
  index: number;
  startAngle: number;
  endAngle: number;
  value: number;
  category: string;
  question: string;
  color: string;
  name: string;
}

export interface ChordLink {
  source: ChordGroup;
  target: ChordGroup;
  value: number;
  strength: 'weak' | 'medium' | 'strong';
}

// Helper to get years category
export function getYearsCategory(years: number): YearsCategory {
  if (years <= 5) return '0-5';
  if (years <= 10) return '6-10';
  if (years <= 15) return '11-15';
  if (years <= 20) return '16-20';
  return '20+';
}

// Helper to normalize category names for color lookup
export function normalizeCategory(category: string, question: string) {
  if (question === 'years_at_medtronic') return getYearsCategory(Number(category));
  return category;
}

// Process data for chord diagram
// NOTE: All color assignments must use the admin-driven color map (categoryColors) as the source of truth.
export function processChordData(
  data: any[],
  sourceField: string,
  targetField: string,
  categoryColors: any // Pass the admin-driven color map here
): ChordMatrix {
  // Get unique categories for source and target
  const sourceCategories = new Set<string>();
  const targetCategories = new Set<string>();
  
  data.forEach(d => {
    if (sourceField === 'years_at_medtronic') {
      sourceCategories.add(getYearsCategory(d.years_at_medtronic || 0));
    } else {
      sourceCategories.add(d[sourceField]);
    }
    
    if (targetField === 'years_at_medtronic') {
      targetCategories.add(getYearsCategory(d.years_at_medtronic || 0));
    } else {
      targetCategories.add(d[targetField]);
    }
  });

  const allCategories = Array.from(new Set([...Array.from(sourceCategories), ...Array.from(targetCategories)]));
  
  // Create matrix
  const matrix = Array(allCategories.length).fill(0).map(() => 
    Array(allCategories.length).fill(0)
  );
  
  // Fill matrix with relationships
  data.forEach(d => {
    const source = sourceField === 'years_at_medtronic' 
      ? getYearsCategory(d.years_at_medtronic || 0)
      : d[sourceField];
    const target = targetField === 'years_at_medtronic'
      ? getYearsCategory(d.years_at_medtronic || 0)
      : d[targetField];
    
    const sourceIndex = allCategories.indexOf(source);
    const targetIndex = allCategories.indexOf(target);
    
    if (sourceIndex !== -1 && targetIndex !== -1) {
      matrix[sourceIndex][targetIndex] += 1;
    }
  });

  // Create chord layout
  const chordLayout = chord()
    .padAngle(0.05)
    .sortSubgroups(d3.descending);

  const chordData = chordLayout(matrix);
  
  // Create groups
  const groups = chordData.groups.map((group, i) => {
    const category = allCategories[i];
    const question = i < sourceCategories.size ? sourceField : targetField;
    // Use only the admin-driven color map for color assignment
    const color =
      categoryColors[question]?.[category] ||
      categoryColors[question]?.[category.toLowerCase()] ||
      categoryColors[question]?.[category.toUpperCase()] ||
      '#888888'; // fallback color
    return {
      index: i,
      startAngle: group.startAngle,
      endAngle: group.endAngle,
      value: group.value,
      category,
      question,
      color,
      name: category,
    };
  });

  // Create chords
  const chords = chordData.map(d => {
    const sourceGroup = groups[d.source.index];
    const targetGroup = groups[d.target.index];
    const value = d.source.value;
    
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    if (value > 10) strength = 'strong';
    else if (value > 5) strength = 'medium';
    
    return {
      source: sourceGroup,
      target: targetGroup,
      value,
      strength,
    };
  });

  return {
    matrix,
    names: allCategories,
    groups,
    chords,
  };
}

// Get chord color by blending source and target colors
export function getChordColor(source: ChordGroup, target: ChordGroup): string {
  return interpolateRgb(source.color, target.color)(0.5);
}

// Animation utilities
export const chordAnimations = {
  drawIn: {
    duration: 1200,
    delay: (d: any, i: number) => i * 50,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  
  modeChange: {
    duration: 800,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  
  rotation: {
    duration: 30000,
    easing: 'linear'
  },
  
  highlight: {
    duration: 200,
    easing: 'ease-out'
  }
};

// Utility to filter out unconnected categories from matrix and groups
export function filterConnectedCategories(matrix: number[][], groups: ChordGroup[], names: string[]) {
  // Find indexes with at least one connection (row or column sum > 0)
  const connectedIndexes = new Set<number>();
  matrix.forEach((row, i) => {
    if (row.some(v => v > 0) || matrix.some(r => r[i] > 0)) {
      connectedIndexes.add(i);
    }
  });
  // Build new arrays
  const indexMap = new Map<number, number>();
  const filteredNames = names.filter((_, i) => connectedIndexes.has(i));
  const filteredGroups = groups.filter((_, i) => connectedIndexes.has(i));
  filteredGroups.forEach((g, i) => indexMap.set(groups.indexOf(g), i));
  const filteredMatrix = filteredNames.map((_, i) =>
    filteredNames.map((_, j) => {
      const origI = names.indexOf(filteredNames[i]);
      const origJ = names.indexOf(filteredNames[j]);
      return matrix[origI][origJ];
    })
  );
  return { filteredMatrix, filteredGroups, filteredNames, indexMap };
} 