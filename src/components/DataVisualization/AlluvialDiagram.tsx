/**
 * @fileoverview AlluvialDiagram Component - Interactive Sankey Flow Visualization
 * 
 * This component creates an interactive Sankey (Alluvial) diagram using D3.js to visualize
 * flow relationships between different categories in survey data. It features:
 * 
 * - Responsive design with ResizeObserver
 * - Dynamic node sizing based on data volume
 * - Animated transitions between different data views
 * - Interactive highlighting and filtering
 * - Theme-aware styling (dark/light mode)
 * - Accessibility features and error handling
 * 
 * @author Medtronic WE Summit Team
 * @version 2.0.0
 * @since 1.0.0
 */

'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback, useContext } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
// @ts-expect-error: No types for d3-interpolate-path
import { interpolatePath } from 'd3-interpolate-path';
import { useVisualizationData } from './shared/useVisualizationData';
import { VisualizationContainer } from './shared/VisualizationContainer';
import { DataInsightPanel } from './shared/DataInsightPanel';
import { getYearsColorScale, getYearsCategory, getNodeColor } from './shared/colorUtils';
// import { QuestionSelector } from './shared/QuestionSelector'; // Temporarily disabled
import { useAppContext } from '@/lib/context/AppContext';
import type { Database } from '@/lib/supabase/types';
import { CATEGORY_COLORS } from '../colorConfig';

/**
 * Props interface for the AlluvialDiagram component
 */
interface AlluvialDiagramProps {
  /** Width of the visualization in pixels (default: 800) */
  width?: number;
  /** Height of the visualization in pixels (default: 600) */
  height?: number;
  /** Whether to enable automatic animation cycling (default: true) */
  autoPlay?: boolean;
  /** Callback fired when the user changes source/target categories */
  onQuestionChange?: (source: string, target: string) => void;
}

/**
 * Survey response type with attendee information
 */
type SurveyResponse = Database['public']['Tables']['survey_responses']['Row'] & {
  attendee: Database['public']['Tables']['attendees']['Row'];
};

/**
 * Sankey node interface representing a category in the flow diagram
 */
interface SankeyNode {
  /** Unique identifier for the node */
  id: string;
  /** Display name of the node */
  name: string;
  /** Category this node belongs to (source or target) */
  category: string;
  /** Left edge x-coordinate */
  x0: number;
  /** Right edge x-coordinate */
  x1: number;
  /** Top edge y-coordinate */
  y0: number;
  /** Bottom edge y-coordinate */
  y1: number;
  /** Numeric value representing the node's size */
  value: number;
}

/**
 * Sankey link interface representing a flow between two nodes
 */
interface SankeyLink {
  /** Source node */
  source: SankeyNode;
  /** Target node */
  target: SankeyNode;
  /** Flow value between nodes */
  value: number;
  /** Visual width of the link */
  width: number;
  /** Y-coordinate at source node */
  y0: number;
  /** Y-coordinate at target node */
  y1: number;
}

/**
 * Animation state management interface
 */
interface AnimationState {
  /** Timer reference for animation intervals */
  timer: NodeJS.Timeout | null;
  /** Whether animation is currently running */
  running: boolean;
  /** Current highlighted source index */
  currentSourceIndex: number;
  /** Current highlighted target index */
  currentTargetIndex: number;
  /** Whether animation is paused */
  isPaused: boolean;
  /** Timestamp when animation was paused */
  pausedAt: number;
  /** Where to resume animation from */
  resumeFrom: 'source' | 'target' | null;
  /** Number of animation cycles completed */
  cycleCount: number;
}

/**
 * Tooltip state interface
 */
interface TooltipState {
  /** X position of tooltip */
  x: number;
  /** Y position of tooltip */
  y: number;
  /** Tooltip content to display */
  content: React.ReactNode;
}

/**
 * Available survey fields for visualization
 */
const availableFields = [
  { value: 'years_at_medtronic', label: 'Years at Medtronic' },
  { value: 'learning_style', label: 'Learning Style' },
  { value: 'shaped_by', label: 'Shaped By' },
  { value: 'peak_performance', label: 'Peak Performance' },
  { value: 'motivation', label: 'Motivation' },
  // Add more fields as needed
];

/**
 * Years at Medtronic category definitions
 */
const YEARS_CATEGORIES = ['0-5', '6-10', '11-15', '16-20', '20+'];

/**
 * Converts numeric years to category string with validation
 * @param years - Number of years at Medtronic
 * @returns Category string
 */
const getValidYearsCategory = (years: number): string => {
  if (typeof years !== 'number' || isNaN(years) || years < 0) return '0-5';
  if (years <= 5) return '0-5';
  if (years <= 10) return '6-10';
  if (years <= 15) return '11-15';
  if (years <= 20) return '16-20';
  return '20+';
};

/**
 * Custom wave path generator for Sankey links with bounds checking
 * Creates a wavy path between source and target nodes for visual appeal
 * 
 * @param d - Link data with source/target coordinates
 * @param waveAmplitude - Amplitude of the wave effect (default: 8)
 * @param waveFrequency - Frequency of the wave (default: 1.1)
 * @param chartWidth - Chart width for bounds checking (default: 800)
 * @param chartHeight - Chart height for bounds checking (default: 600)
 * @returns SVG path string
 */
function sankeyLinkWave(d: any, waveAmplitude = 8, waveFrequency = 1.1, chartWidth = 800, chartHeight = 600) {
  // Extract coordinates from link data
  let x0 = d.source.x1;
  let x1 = d.target.x0;
  let y0 = d.y0;
  let y1 = d.y1;
  
  // Clamp coordinates to chart bounds to prevent overflow
  x0 = Math.max(0, Math.min(chartWidth, x0));
  x1 = Math.max(0, Math.min(chartWidth, x1));
  y0 = Math.max(0, Math.min(chartHeight, y0));
  y1 = Math.max(0, Math.min(chartHeight, y1));
  
  const midX = (x0 + x1) / 2;
  
  // Add a sine wave to the control points, but ensure they stay within bounds
  const waveY0 = Math.max(0, Math.min(chartHeight, y0 + waveAmplitude * Math.sin(waveFrequency * Math.PI * 0.25)));
  const waveY1 = Math.max(0, Math.min(chartHeight, y1 + waveAmplitude * Math.sin(waveFrequency * Math.PI * 0.75)));
  
  return `M${x0},${y0}
    C${midX},${waveY0} ${midX},${waveY1} ${x1},${y1}`;
}

/**
 * Custom horizontal link generator that clamps y0/y1 to node bounds
 * Prevents links from extending beyond their source/target nodes
 * 
 * @returns Function that generates SVG path for a link
 */
function clampedSankeyLinkHorizontal() {
  return function(d: any) {
    // Clamp y0/y1 to node bounds
    const sy = Math.max(d.source.y0, Math.min(d.source.y1, d.y0));
    const ty = Math.max(d.target.y0, Math.min(d.target.y1, d.y1));
    const x0 = d.source.x1;
    const x1 = d.target.x0;
    // Use a cubic Bezier for smoothness
    const curvature = 0.5;
    const xi = d3.interpolateNumber(x0, x1);
    const x2 = xi(curvature);
    const x3 = xi(1 - curvature);
    return `M${x0},${sy}C${x2},${sy} ${x3},${ty} ${x1},${ty}`;
  };
}

/**
 * AlluvialDiagram Component
 * 
 * Main component that renders an interactive Sankey diagram showing flow relationships
 * between survey response categories. Features responsive design, animations, and
 * interactive controls.
 * 
 * @param props - Component props
 * @returns JSX element
 */
export default function AlluvialDiagram({
  width = 800,
  height = 600,
  autoPlay = true,
  onQuestionChange,
}: AlluvialDiagramProps) {
  // Responsive: use state for width/height, fallback to props
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(width);
  const [containerHeight, setContainerHeight] = useState(height);

  // Responsive: observe container size
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new window.ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.contentRect) {
          setContainerWidth(entry.contentRect.width);
          setContainerHeight(entry.contentRect.height);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const svgRef = useRef<SVGSVGElement>(null);
  const { data, isLoading, error } = useVisualizationData();
  const { settings, getCurrentThemeColors } = useAppContext();
  const [currentSource, setCurrentSource] = useState('years_at_medtronic');
  const [currentTarget, setCurrentTarget] = useState('learning_style');

  // Filter data based on test data setting
  const filteredData = useMemo(() => {
    if (!Array.isArray(data) || !data.length) return [];
    return settings.useTestData ? data : data.filter(item => !(item as any).test_data);
  }, [data, settings.useTestData]);

  // Compute sources and targets with validation
  const sources: string[] = useMemo(() => {
    if (!Array.isArray(filteredData) || !filteredData.length) return [];
    if (currentSource === 'years_at_medtronic') {
      return YEARS_CATEGORIES.filter(cat => 
        filteredData.some(d => getValidYearsCategory(d.years_at_medtronic || 0) === cat)
      );
    } else {
      return Array.from(new Set(
        filteredData.map((d: SurveyResponse) => d[currentSource as keyof SurveyResponse])
      )).filter((value): value is string => 
        typeof value === 'string' && value.length > 0
      );
    }
  }, [filteredData, currentSource]);

  const targets: string[] = useMemo(() => {
    if (!Array.isArray(filteredData) || !filteredData.length) return [];
    if (currentTarget === 'years_at_medtronic') {
      return YEARS_CATEGORIES.filter(cat => 
        filteredData.some(d => getValidYearsCategory(d.years_at_medtronic || 0) === cat)
      );
    } else {
      // Sort target nodes consistently to maintain fixed positions
      return Array.from(new Set(
        filteredData.map((d: SurveyResponse) => 
        currentTarget === 'years_at_medtronic' 
            ? getValidYearsCategory(d.years_at_medtronic || 0)
            : d[currentTarget as keyof SurveyResponse]
        )
      )).filter((value): value is string => 
        typeof value === 'string' && value.length > 0
      ).sort(); // Add consistent sorting
    }
  }, [filteredData, currentTarget]);

  // --- Responsive chart sizing based on data size ---
  // Set sensible min/max chart dimensions
  const MIN_CHART_HEIGHT = 180;
  const MAX_CHART_HEIGHT = 700;
  const MIN_CHART_WIDTH = 320;
  const MAX_CHART_WIDTH = 1400;

  // Calculate node count for sizing
  const nodeCount = Math.max(sources.length, targets.length, 1);

  // --- Dynamic margin calculation for full label visibility (moved up) ---
  // Helper to measure text width in px
  function measureTextWidth(text: string, font: string): number {
    if (typeof window === 'undefined') return 100; // fallback for SSR
    if (!(measureTextWidth as any)._canvas) {
      (measureTextWidth as any)._canvas = document.createElement('canvas');
    }
    const canvas = (measureTextWidth as any)._canvas as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) return 100;
    context.font = font;
    return context.measureText(text).width;
  }

  // Dynamically scale label font size with node height (clamp between 12px and 28px)
  const labelFontSize = Math.max(12, Math.min(28, Math.floor(nodeCount > 0 ? (containerHeight / nodeCount) * 0.5 : 16)));

  // Font for measuring
  const labelFont = `bold ${labelFontSize}px Avenir Next World, -apple-system, BlinkMacSystemFont, 'SF Pro', 'Roboto', sans-serif`;
  const allLabels = [...sources, ...targets];
  const labelWidths = allLabels.map(label => measureTextWidth(label, labelFont));
  const maxLabelWidth = Math.max(...labelWidths, 80); // fallback min
  const labelPadding = 24;
  // Reduce margins to prevent excessive gaps
  // Prioritize negative space for dropdowns and index data categories
  // Minimum left margin for dropdowns: 120px, but allow more for long labels
  const minDropdownMargin = 120;
  // Increase left margin to always accommodate the longest label plus extra padding for clarity
  const extraLabelSpace = 40; // Extra space for visual comfort
  const maxLeftMargin = 260; // Cap to prevent excessive margin
  const margin = {
    top: 60, // Increased for dropdowns
    right: Math.max(Math.min(maxLabelWidth + labelPadding, 150), minDropdownMargin),
    bottom: 20,
    left: Math.min(maxLabelWidth + labelPadding + extraLabelSpace, maxLeftMargin)
  };

  // --- Sparse Data Tuning ---
  // For sparse data, shrink chart and cap node/link size
  let availableHeight = Math.max(MIN_CHART_HEIGHT, Math.min(containerHeight - 40, MAX_CHART_HEIGHT));
  let maxNodeHeight = 48;
  let maxLinkWidth = 32;
  if (nodeCount <= 3) {
    availableHeight = Math.max(MIN_CHART_HEIGHT, Math.min(220, availableHeight)); // Shrink chart height
    maxNodeHeight = 28; // Cap node height
    maxLinkWidth = 16;  // Cap link thickness
  }
  if (nodeCount >= 10) {
    availableHeight = Math.min(MAX_CHART_HEIGHT, Math.max(availableHeight, 500));
  }

  // Node height and padding logic
  const minNodeHeight = 16;
  const minPadding = 8;
  let nodeHeight = Math.floor((availableHeight - (nodeCount + 1) * minPadding) / nodeCount);
  nodeHeight = Math.max(minNodeHeight, Math.min(nodeHeight, maxNodeHeight));
  let nodePadding = (availableHeight - nodeCount * nodeHeight) / (nodeCount + 1);
  // Clamp nodePadding to a maximum to prevent excessive vertical gaps
  nodePadding = Math.max(minPadding, Math.min(nodePadding, 40));

  // Responsive chart width
  let chartWidth = Math.max(MIN_CHART_WIDTH, Math.min(containerWidth - margin.left - margin.right, MAX_CHART_WIDTH));
  let chartHeight = availableHeight;

  // If very sparse, shrink width too
  if (nodeCount <= 3) {
    chartWidth = Math.max(MIN_CHART_WIDTH, Math.min(chartWidth, 420));
  }

  // If very dense, allow more width
  if (nodeCount >= 10) {
    chartWidth = Math.min(MAX_CHART_WIDTH, Math.max(chartWidth, 900));
  }

  // --- Sankey layout: ensure leftmost nodes are flush with the left edge ---
  // The sankey extent is [[0,0],[chartWidth,chartHeight]] and the group transform is translate(margin.left, margin.top)
  // This ensures x0=0 for leftmost nodes, so connectors start flush with the left edge of the chart area
  // (No code change needed here if extent and transform are correct)

  // Debug logging
  useEffect(() => {
    if (sources.length === 0 || targets.length === 0) return;
    
    console.log('=== ALLUVIAL DIAGRAM DEBUG ===');
    console.log('🖥️  Container Dimensions:', containerWidth, 'x', containerHeight);
    console.log('📏 Margin:', margin);
    console.log('📊 Chart Dimensions:', chartHeight, 'x', chartHeight);
    console.log('🎯 Available Chart Space:', chartHeight, 'x', chartHeight);
    console.log('📈 Node Count - Sources:', sources.length, 'Targets:', targets.length);
    console.log('🔢 Node Height:', nodeHeight, 'Node Padding:', nodePadding);
    console.log('🔤 Label Font Size:', labelFontSize);
    console.log('📐 Max Label Width:', Math.max(...[...sources, ...targets].map(label => measureTextWidth(label, `bold ${labelFontSize}px Avenir Next World, sans-serif`)), 80));
    console.log('================================');
  }, [containerWidth, containerHeight, chartHeight, margin, sources.length, targets.length, nodeHeight, nodePadding, labelFontSize]);

  // Use refs to track current values without triggering re-renders
  const currentSourceRef = useRef(currentSource);
  const currentTargetRef = useRef(currentTarget);
  
  // Update refs when state changes
  useEffect(() => {
    currentSourceRef.current = currentSource;
  }, [currentSource]);
  
  useEffect(() => {
    currentTargetRef.current = currentTarget;
  }, [currentTarget]);
  const [insights, setInsights] = useState<Array<{ title: string; value: string | number; description?: string }>>([]);
  const [hoveredNode, setHoveredNode] = useState<SankeyNode | null>(null);
  const [hoveredLink, setHoveredLink] = useState<SankeyLink | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [lastCategoryChange, setLastCategoryChange] = useState<{ source: string; target: string }>({ source: currentSource, target: currentTarget });
  const [currentTargetIndex, setCurrentTargetIndex] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const [hoveredSourceIndex, setHoveredSourceIndex] = useState<number | null>(null);
  const [hoveredTargetIndex, setHoveredTargetIndex] = useState<number | null>(null);
  const [isInFullOpacityState, setIsInFullOpacityState] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'full' | 'highlighting' | 'transitioning'>('full');

  const animationRef = useRef<AnimationState>({
    timer: null,
    running: false,
    currentSourceIndex: 0,
    currentTargetIndex: 0,
    isPaused: false,
    pausedAt: Date.now(),
    resumeFrom: null,
    cycleCount: 0
  });

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Adjust animation durations based on motion preference
  const animationDurations = useMemo(() => {
    const baseSpeed = settings.autoPlaySpeed || 3000;
    const reductionFactor = prefersReducedMotion ? 0.5 : 1;
    return {
      stepDuration: Math.max(800, (baseSpeed / 8) * reductionFactor),
      pauseDuration: Math.max(400, (baseSpeed / 12) * reductionFactor),
      categoryPauseDuration: Math.max(1500, (baseSpeed / 3) * reductionFactor),
      linkTransitionDuration: prefersReducedMotion ? 400 : 750
    };
  }, [settings.autoPlaySpeed, prefersReducedMotion]);

  // Get visual order of source nodes (top-to-bottom as they appear)
  const sortedSources = useMemo(() => {
    if (!filteredData.length || !chartHeight || !chartHeight) return sources;

    const sourcesForNodes = [...sources];
    if (currentSource === 'years_at_medtronic') {
      sourcesForNodes.sort((a, b) => YEARS_CATEGORIES.indexOf(a) - YEARS_CATEGORIES.indexOf(b));
    } else {
      sourcesForNodes.sort();
    }

    // Create Sankey layout to get visual order
    const nodes = [
      ...sourcesForNodes.map((name) => ({ id: `${currentSource}:${name}`, name, category: currentSource })),
      ...targets.map((name) => ({ id: `${currentTarget}:${name}`, name, category: currentTarget })),
    ];

    const linksMap = new Map<string, { source: string; target: string; value: number }>(); 
    filteredData.forEach((d) => {
      const source = currentSource === 'years_at_medtronic' 
        ? getValidYearsCategory(d.years_at_medtronic || 0) 
        : (d as any)[currentSource];
      const target = currentTarget === 'years_at_medtronic'
        ? getValidYearsCategory(d.years_at_medtronic || 0)
        : (d as any)[currentTarget];
      
      if (!sourcesForNodes.includes(source) || !targets.includes(target)) return;
      
      const sourceId = `${currentSource}:${source}`;
      const targetId = `${currentTarget}:${target}`;
      const key = `${sourceId}→${targetId}`;
      
      if (!linksMap.has(key)) {
        linksMap.set(key, { source: sourceId, target: targetId, value: 0 });
      }
      linksMap.get(key)!.value += 1;
    });

    const links = Array.from(linksMap.values());
    const sankeyGenerator = sankey<any, any>()
      .nodeId((d: any) => d.id)
      .nodeWidth(12)
      .nodePadding(nodePadding)
      .extent([[0, 0], [chartHeight, chartHeight]]);

    const sankeyData = sankeyGenerator({
      nodes: nodes.map((d) => ({ ...d })),
      links: links.map((d) => ({ ...d })),
    });

    // Get source nodes in visual order (top to bottom)
    const sourceNodes = sankeyData.nodes
      .filter((d: any) => d.category === currentSource)
      .sort((a: any, b: any) => a.y0 - b.y0);

    return sourceNodes.map((d: any) => d.name);
  }, [filteredData, sources, targets, currentSource, currentTarget, chartHeight, nodePadding]);

  // Enhanced animation function with comprehensive debug tracking
  const animate = useCallback(() => {
    // Check if animation is paused
    if (animationRef.current.isPaused) {
      console.log('⏸️  Animation is paused, skipping cycle');
      return;
    }

    if (!animationRef.current.running || !filteredData.length) {
      console.log('❌ Animation stopped:', {
        running: animationRef.current.running,
        dataLength: filteredData.length
      });
      return;
    }

    // Safety check: prevent infinite loops
    if (animationRef.current.cycleCount > 1000) {
      console.log('🛑 Animation cycle limit reached, resetting');
      animationRef.current.cycleCount = 0;
      animationRef.current.currentSourceIndex = 0;
      animationRef.current.currentTargetIndex = 0;
    }

    // Increment cycle counter
    animationRef.current.cycleCount++;

    // Set animation phase to highlighting
    setAnimationPhase('highlighting');
        setIsInFullOpacityState(false);
    
    // Set the hovered source index to match the animation
    setHoveredSourceIndex(animationRef.current.currentSourceIndex);

    const targetOptions = availableFields
      .filter(f => f.value !== currentSourceRef.current)
      .map(f => f.value);
    
    // Debug: Log the target options to verify they're correct
    if (animationRef.current.currentSourceIndex === 0) {
      console.log('🎯 Available target options for', currentSourceRef.current, ':', targetOptions);
    }

          // COMPREHENSIVE DEBUG: Log current state with full detail
      console.log('🔍 ANIMATION CYCLE DEBUG:', {
        '📍 Current Position': {
          sourceIndex: animationRef.current.currentSourceIndex,
          targetIndex: animationRef.current.currentTargetIndex,
          sourceName: sortedSources[animationRef.current.currentSourceIndex],
          targetName: currentTargetRef.current
        },
        '📊 Categories': {
          currentSource: currentSourceRef.current,
          currentTarget: currentTargetRef.current,
          sourceOptions: availableFields.map(f => f.value),
          targetOptions
        },
      '📈 Progress': {
        sourceProgress: `${animationRef.current.currentSourceIndex + 1}/${sortedSources.length}`,
        targetProgress: `${animationRef.current.currentTargetIndex + 1}/${targetOptions.length}`,
        isLastSource: animationRef.current.currentSourceIndex >= sortedSources.length - 1,
        hasMoreTargets: animationRef.current.currentTargetIndex < targetOptions.length - 1
      },
      '🎯 Sources': sortedSources,
      '🎯 Targets': targetOptions,
      '⏱️  Timings': animationDurations
    });

          if (animationRef.current.currentSourceIndex < sortedSources.length - 1) {
        // Move to next source
        const nextTimeout = animationDurations.stepDuration + animationDurations.pauseDuration;
        const progress = `${animationRef.current.currentSourceIndex + 1}/${sortedSources.length}`;
        console.log(`🎯 Source ${progress}: Highlighting '${sortedSources[animationRef.current.currentSourceIndex]}' → '${currentTargetRef.current}' for ${nextTimeout}ms`);
      
      animationRef.current.timer = setTimeout(() => {
        if (!animationRef.current.running || animationRef.current.isPaused) return;
        animationRef.current.currentSourceIndex++;
        animate();
      }, nextTimeout);
      } else {
      // After last source, check if we need to cycle targets or change source category
      console.log('🔍 END OF SOURCES - Checking target cycling:', {
        currentTargetIndex: animationRef.current.currentTargetIndex,
        targetOptionsLength: targetOptions.length,
        hasMoreTargets: animationRef.current.currentTargetIndex < targetOptions.length - 1,
        availableTargets: targetOptions
      });

              if (animationRef.current.currentTargetIndex < targetOptions.length - 1) {
          // Still have more target categories to cycle through
          const targetProgress = `${animationRef.current.currentTargetIndex + 2}/${targetOptions.length}`;
          console.log(`🔄 ✅ COMPLETED ALL SOURCES for '${currentTargetRef.current}', moving to next target (${targetProgress})`);
          
          // Clear any existing timer to prevent conflicts
          if (animationRef.current.timer) {
            clearTimeout(animationRef.current.timer);
            animationRef.current.timer = null;
          }
          
          animationRef.current.timer = setTimeout(() => {
            if (!animationRef.current.running || animationRef.current.isPaused) return;
            setAnimationPhase('transitioning');
            
            // Move to next target category
            animationRef.current.currentTargetIndex++;
            const nextTarget = targetOptions[animationRef.current.currentTargetIndex];
            console.log('🎯 ✨ NEW TARGET CATEGORY:', nextTarget, `(${animationRef.current.currentTargetIndex + 1}/${targetOptions.length})`);
            console.log('🔍 Target progression debug:', {
              previousTarget: currentTargetRef.current,
              nextTarget,
              currentTargetIndex: animationRef.current.currentTargetIndex,
              allTargetOptions: targetOptions
            });
            setCurrentTarget(nextTarget);
            setLastCategoryChange({ source: currentSourceRef.current, target: nextTarget });
            onQuestionChange?.(currentSourceRef.current, nextTarget);
          
            // Reset source index and restart with new target
            animationRef.current.currentSourceIndex = 0;
            
            // Start the next cycle after a brief pause
            setTimeout(() => {
              if (animationRef.current.running && !animationRef.current.isPaused) {
                animate();
              }
            }, animationDurations.categoryPauseDuration);
          }, animationDurations.categoryPauseDuration);
              } else {
          // We've cycled through all targets, now change the source category
          console.log(`🔄 ✨ COMPLETED ALL TARGETS for '${currentSourceRef.current}' - Moving to next source category! ✨`);
          
          // Clear any existing timer to prevent conflicts
          if (animationRef.current.timer) {
            clearTimeout(animationRef.current.timer);
            animationRef.current.timer = null;
          }
          
          animationRef.current.timer = setTimeout(() => {
            if (!animationRef.current.running || animationRef.current.isPaused) return;
            setAnimationPhase('transitioning');
            
            // Move to next source category
            const sourceOptions = availableFields.map(f => f.value);
            const currentSourceIndex = sourceOptions.indexOf(currentSourceRef.current);
            const nextSourceIndex = (currentSourceIndex + 1) % sourceOptions.length;
            const nextSource = sourceOptions[nextSourceIndex];
            
            console.log('🎯 🆕 NEW SOURCE CATEGORY:', nextSource, '- Starting fresh cycle with all targets');
            
            // Calculate target options for the NEW source (including years_at_medtronic)
            const newTargetOptions = availableFields
              .filter(f => f.value !== nextSource)
              .map(f => f.value);
            
            console.log('🔍 New target options for', nextSource, ':', newTargetOptions);
            
            setCurrentSource(nextSource);
            
            // Reset both indices and start with first target again
            animationRef.current.currentSourceIndex = 0;
            animationRef.current.currentTargetIndex = 0;
            const firstTarget = newTargetOptions[0];
            setCurrentTarget(firstTarget);
            setLastCategoryChange({ source: nextSource, target: firstTarget });
            onQuestionChange?.(nextSource, firstTarget);
          
            // Start the next cycle after a longer pause
            setTimeout(() => {
              if (animationRef.current.running && !animationRef.current.isPaused) {
                animate();
              }
            }, animationDurations.categoryPauseDuration * 1.5); // Longer pause for source category change
          }, animationDurations.categoryPauseDuration);
      }
    }
  }, [
    data.length,
    sortedSources.length,
    onQuestionChange,
    animationDurations,
    availableFields
    // Removed sortedSources to prevent dependency loops
  ]);



  // Animation effect - restart when settings change
  useEffect(() => {
    console.log('🎬 Animation useEffect triggered:', {
      autoPlay,
      isAutoPlayEnabled: settings.isAutoPlayEnabled,
      dataLength: data.length,
      svgRefExists: !!svgRef.current,
      currentSource,
      currentTarget,
      autoPlaySpeed: settings.autoPlaySpeed,
      isRunning: animationRef.current.running
    });

    if (!autoPlay || !settings.isAutoPlayEnabled) {
      console.log('❌ Animation disabled');
      if (animationRef.current.timer) {
        clearTimeout(animationRef.current.timer);
        animationRef.current.timer = null;
      }
      animationRef.current.running = false;
      setAnimationPhase('full');
      setIsInFullOpacityState(true);
      return;
    }
    
    if (!filteredData.length) {
      console.log('❌ No data available for animation');
      return;
    }
    if (!svgRef.current) {
      console.log('❌ SVG ref not available');
      return;
    }

    // Restart animation when speed changes or on major changes
    if (animationRef.current.running) {
      console.log('🔄 Restarting animation with new settings:', {
        sourceCategory: currentSource,
        totalSources: sortedSources.length,
        totalTargets: availableFields.filter(f => f.value !== currentSource).length,
        speed: settings.autoPlaySpeed + 'ms'
      });
      
      // Stop current animation
      if (animationRef.current.timer) {
        clearTimeout(animationRef.current.timer);
        animationRef.current.timer = null;
      }
      animationRef.current.running = false;
    }

    // Start new animation cycle
      console.log('✅ Starting animation cycle:', {
        sourceCategory: currentSource,
        totalSources: sortedSources.length,
        totalTargets: availableFields.filter(f => f.value !== currentSource).length,
        speed: settings.autoPlaySpeed + 'ms'
      });

      // Initialize animation state
      animationRef.current.running = true;
      animationRef.current.currentSourceIndex = 0;
      animationRef.current.currentTargetIndex = 0;
      animationRef.current.cycleCount = 0; // Reset cycle counter

      // Start animation
      animate();

    return () => {
      if (animationRef.current.timer) {
        clearTimeout(animationRef.current.timer);
        animationRef.current.timer = null;
      }
      animationRef.current.running = false;
      setAnimationPhase('full');
      setIsInFullOpacityState(true);
    };
  }, [
    autoPlay,
    settings.isAutoPlayEnabled,
    settings.autoPlaySpeed, // Add this to restart when speed changes
    filteredData.length,
    currentSource // Only restart on source changes, not target changes
  ]);

  const nodeLabelFontSize = 18; // larger for readability
  const nodeLabelFontWeight = 700;
  const nodeLabelColor = settings.isDarkMode ? '#FFFFFF' : '#170F5F';
  const nodeLabelFontFamily = 'Avenir Next World, -apple-system, BlinkMacSystemFont, "SF Pro", "Roboto", sans-serif';
  const nodeLabelOffset = 24;

  // Local debug toggle for this component if no global admin context
  const [localDebug, setLocalDebug] = useState(false);
  const [showThemeToggle, setShowThemeToggle] = useState(false);
  const debugOn = localDebug;

  // Debug Sankey data for outlines
  const [debugSankeyData, setDebugSankeyData] = useState<any>(null);
  useEffect(() => {
    if (!Array.isArray(sources) || !Array.isArray(targets)) return;
    const nodes = [
      ...sources.map((name) => ({ id: `source:${name}`, name, category: 'source' })),
      ...targets.map((name) => ({ id: `target:${name}`, name, category: 'target' })),
    ];
    // Only create links if both sides have at least one node
    const links = (sources.length && targets.length)
      ? [{ source: `source:${sources[0]}`, target: `target:${targets[0]}`, value: 1 }]
      : [];
    if (nodes.length < 2 || links.length < 1) return; // Prevent invalid array length
    const sankeyGenerator = sankey<any, any>()
      .nodeId((d: any) => d.id)
      .nodeWidth(12)
      .nodePadding(nodePadding)
      .extent([[0, 0], [chartHeight, chartHeight]]);
    const sankeyData = sankeyGenerator({ nodes: nodes.map((d) => ({ ...d })), links: links.map((d) => ({ ...d })) });
    setDebugSankeyData(sankeyData);
  }, [sources, targets, chartHeight, nodePadding]);

  // Render Sankey diagram
  useEffect(() => {
    if (!svgRef.current || !filteredData.length) return;

    // --- Persistent SVG structure ---
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous content
    svg
      .attr('width', containerWidth)
      .attr('height', containerHeight)
      .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`);

    // --- Sankey node/link creation and vertical centering (deduplicated) ---
    // Sort source nodes to maintain a fixed order (same as animation)
    const sortedSources = [...sources];
    if (currentSource === 'years_at_medtronic') {
      sortedSources.sort((a, b) => YEARS_CATEGORIES.indexOf(a) - YEARS_CATEGORIES.indexOf(b));
    } else {
      sortedSources.sort();
    }
    // Sort target nodes to maintain a fixed order
    const sortedTargets = [...targets];
    if (currentTarget === 'years_at_medtronic') {
      sortedTargets.sort((a, b) => YEARS_CATEGORIES.indexOf(a) - YEARS_CATEGORIES.indexOf(b));
    } else {
      sortedTargets.sort();
    }

    // Sankey transformation accessors
    const sourceAccessor = (d: any) =>
      currentSource === 'years_at_medtronic'
        ? getYearsCategory(d.years_at_medtronic || 0)
        : (d as any)[currentSource];
    const targetAccessor = (d: any) =>
      currentTarget === 'years_at_medtronic'
        ? getYearsCategory(d.years_at_medtronic || 0)
        : (d as any)[currentTarget];

    // Filter data to only include valid values
    const validData = filteredData.filter(d =>
      (currentSource !== 'years_at_medtronic' || d.years_at_medtronic !== null) &&
      (currentTarget !== 'years_at_medtronic' || d.years_at_medtronic !== null)
    );

    // Debug data
    console.log('📊 DATA DEBUG:');
    console.log('  Current source:', currentSource, 'Current target:', currentTarget);
    console.log('  Filtered data count:', filteredData.length);
    console.log('  Valid data count:', validData.length);
    console.log('  Sources:', sources);
    console.log('  Targets:', targets);

    // Build nodes array with unique ids
    const nodes = [
      ...sortedSources.map((name) => ({ id: `${currentSource}:${name}`, name, category: currentSource })),
      ...sortedTargets.map((name) => ({ id: `${currentTarget}:${name}`, name, category: currentTarget })),
    ];

    // Build links array (aggregate counts for each source-target pair)
    const linksMap = new Map<string, { source: string; target: string; value: number, isDummy?: boolean }>();
    // 1. For every possible source-target pair, create a link (dummy if no data)
    sortedSources.forEach((source) => {
      sortedTargets.forEach((target) => {
        const sourceId = `${currentSource}:${source}`;
        const targetId = `${currentTarget}:${target}`;
        const key = `${sourceId}→${targetId}`;
        linksMap.set(key, { source: sourceId, target: targetId, value: 0, isDummy: true });
      });
    });
    // 2. Fill in real data, marking links as not dummy
    validData.forEach((d) => {
      const source = sourceAccessor(d);
      const target = targetAccessor(d);
      if (!sortedSources.includes(source) || !sortedTargets.includes(target)) return;
      const sourceId = `${currentSource}:${source}`;
      const targetId = `${currentTarget}:${target}`;
      const key = `${sourceId}→${targetId}`;
      if (!linksMap.has(key)) {
        linksMap.set(key, { source: sourceId, target: targetId, value: 1, isDummy: false });
      } else {
        const link = linksMap.get(key)!;
        link.value += 1;
        link.isDummy = false;
      }
    });
    // 3. Set dummy links to a very small value if still dummy
    Array.from(linksMap.values()).forEach(link => {
      if (link.isDummy) link.value = 0.0001;
    });

    // --- COLUMN HEIGHT NORMALIZATION ---
    // Calculate total value for each side
    const leftTotals = sortedSources.map(source => {
      const sourceId = `${currentSource}:${source}`;
      return Array.from(linksMap.values()).filter(l => l.source === sourceId).reduce((sum, l) => sum + l.value, 0);
    });
    const rightTotals = sortedTargets.map(target => {
      const targetId = `${currentTarget}:${target}`;
      return Array.from(linksMap.values()).filter(l => l.target === targetId).reduce((sum, l) => sum + l.value, 0);
    });
    const leftSum = leftTotals.reduce((a, b) => a + b, 0);
    const rightSum = rightTotals.reduce((a, b) => a + b, 0);
    // If sums are different, scale the smaller side's node values and link values
    let leftScale = 1, rightScale = 1;
    if (leftSum > 0 && rightSum > 0 && leftSum !== rightSum) {
      if (leftSum > rightSum) {
        rightScale = leftSum / rightSum;
      } else {
        leftScale = rightSum / leftSum;
      }
    }
    // Scale links
    Array.from(linksMap.values()).forEach(link => {
      const sourceId = link.source;
      const targetId = link.target;
      if (leftScale !== 1 && sortedSources.some(s => `${currentSource}:${s}` === sourceId)) {
        link.value *= leftScale;
      }
      if (rightScale !== 1 && sortedTargets.some(t => `${currentTarget}:${t}` === targetId)) {
        link.value *= rightScale;
      }
    });

    const links = Array.from(linksMap.values());

    // Debug links
    console.log('🔗 LINKS DEBUG:');
    console.log('  Total links created:', links.length);
    console.log('  Non-dummy links:', links.filter(l => !l.isDummy).length);
    console.log('  Dummy links:', links.filter(l => l.isDummy).length);
    console.log('  Sample links:', links.slice(0, 5).map(l => ({ 
      source: l.source, 
      target: l.target, 
      value: l.value, 
      isDummy: l.isDummy 
    })));

    // --- DYNAMIC NODE PADDING ---
    // Reduce nodePadding for sparse data
    let dynamicNodePadding = nodePadding;
    if (sortedSources.length <= 4 && sortedTargets.length <= 4) {
      dynamicNodePadding = Math.max(8, nodePadding / 2);
    }

    // Sankey layout - ensure it uses the full available chart space and leftmost nodes are flush
    const sankeyGenerator = sankey<any, any>()
      .nodeId((d: any) => d.id)
      .nodeWidth(12)
      .nodePadding(dynamicNodePadding)
      .extent([[0, 0], [chartWidth, chartHeight]]); // left edge is 0

    const sankeyData = sankeyGenerator({
      nodes: nodes.map((d) => ({ ...d })),
      links: links.map((d) => ({ ...d })),
    });

    // Debug Sankey layout
    console.log('🔍 SANKEY LAYOUT DEBUG:');
    console.log('  Sankey extent:', [[0, 0], [chartWidth, chartHeight]]);
    console.log('  Input nodes:', nodes.length, 'Input links:', links.length);
    console.log('  Output nodes:', sankeyData.nodes.length, 'Output links:', sankeyData.links.length);
    console.log('  Sample nodes:', sankeyData.nodes.slice(0, 3).map(n => ({ 
      id: n.id, 
      x0: n.x0, 
      x1: n.x1, 
      y0: n.y0, 
      y1: n.y1 
    })));
    console.log('  Sample links:', sankeyData.links.slice(0, 3).map(l => ({ 
      source: l.source.id, 
      target: l.target.id, 
      value: l.value
    })));

    // --- FORCE ROW ALIGNMENT IF NODE SETS MATCH ---
    // If left and right node sets have the same length and order, align their y0/y1
    const leftNodes = sankeyData.nodes.filter((n: any) => n.category === currentSource);
    const rightNodes = sankeyData.nodes.filter((n: any) => n.category === currentTarget);
    if (
      leftNodes.length === rightNodes.length &&
      leftNodes.every((n, i) => rightNodes[i] && n.name === rightNodes[i].name)
    ) {
      // Force y0/y1 of right nodes to match left nodes
      rightNodes.forEach((n, i) => {
        n.y0 = leftNodes[i].y0;
        n.y1 = leftNodes[i].y1;
      });
    }

    // --- VISUAL GUIDES: Render horizontal bands for each row ---
    svg.selectAll('rect.row-guide')
      .data(leftNodes)
      .enter()
      .append('rect')
      .attr('class', 'row-guide')
      .attr('x', -margin.left)
      .attr('y', (d: any) => d.y0)
      .attr('width', chartWidth + margin.left + margin.right)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('fill', (d, i) =>
        settings.isDarkMode
          ? (i % 2 === 0 ? '#18191d' : '#141416') // colors closer to background
          : (i % 2 === 0 ? '#f5f7fa' : '#e9eef5')
      )
      .attr('opacity', settings.isDarkMode ? 0.15 : 0.25) // reduced opacity for dark mode
      .lower();

    // Compute vertical offset to center the diagram
    const nodeYs = sankeyData.nodes.map((d: any) => [d.y0, d.y1]).flat();
    const minY = Math.min(...nodeYs);
    const maxY = Math.max(...nodeYs);
    const usedHeight = maxY - minY;
    const offsetY = Math.max(0, (chartHeight - usedHeight) / 2 - minY);

    // Debug positioning
    console.log('📍 POSITIONING DEBUG:');
    console.log('  Node Y range:', minY, 'to', maxY, '(used height:', usedHeight, ')');
    console.log('  Chart height:', chartHeight);
    console.log('  Vertical offset:', offsetY);
    console.log('  Group transform:', `translate(${margin.left},${margin.top + offsetY})`);

    // Create a group for the chart area with margin translation and vertical centering
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top + offsetY})`); // left margin only for labels/dropdowns
    
    // Debug the actual transform
    console.log('🎭 SVG Transform:', `translate(${margin.left},${margin.top + offsetY})`);
    console.log('📐 Actual SVG dimensions:', svg.attr('width'), 'x', svg.attr('height'));
    console.log('📊 Chart area after margins:', chartHeight, 'x', chartHeight);

    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) defs = svg.append('defs') as d3.Selection<SVGDefsElement, unknown, null, undefined>;
    let linksG = g.append('g').attr('class', 'links');
    let nodesG = g.append('g').attr('class', 'nodes');

    // Remove old gradients (no longer needed)
    defs.selectAll('linearGradient.link-gradient').remove();

    // --- Add clipPath for links group with tighter bounds ---
    svg.select('defs').selectAll('#link-clip').remove();
    defs.append('clipPath')
      .attr('id', 'link-clip')
      .append('rect')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', chartWidth)
      .attr('height', chartHeight);
    linksG.attr('clip-path', 'url(#link-clip)');

    // Add glow filter for dark mode
    defs.selectAll('#dark-mode-glow').remove();
    if (settings.isDarkMode) {
      const glowFilter = defs.append('filter')
        .attr('id', 'dark-mode-glow')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');
      
      glowFilter.append('feGaussianBlur')
        .attr('stdDeviation', '1.5')
        .attr('result', 'coloredBlur');
      
      const feMerge = glowFilter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'coloredBlur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    }

    // --- Links update pattern ---
    // All links are now between real nodes, with isDummy property for visual distinction
    const filteredLinks = sankeyData.links;
    // Remove mix-blend-mode in dark mode to prevent color washing out
    linksG.style('mix-blend-mode', settings.isDarkMode ? 'normal' : 'multiply');
    const linkKey = (d: any) => `${d.source.id}→${d.target.id}`;
    const linkSel = linksG.selectAll('path')
      .data(filteredLinks, linkKey);

    // EXIT: fade out and remove all old links
    linkSel.exit()
      .transition().duration(400)
      .attr('opacity', 0)
      .remove();

    // Check if this is a category change that should trigger animation
    const isCategoryChange = lastCategoryChange.source !== currentSource || lastCategoryChange.target !== currentTarget;

    // ENTER: draw in all new links with improved animation
    const newLinks = linksG.selectAll('path')
      .data(filteredLinks, linkKey)
      .enter()
      .append('path')
      .attr('d', clampedSankeyLinkHorizontal())
      .attr('stroke', (d: any) => {
        // Use shared color config if available
        if (CATEGORY_COLORS[d.source.name]) return CATEGORY_COLORS[d.source.name];
        const color = getNodeColor(d.source, getCurrentThemeColors(), settings.isDarkMode);
        // Enhanced fallback color logic for dark mode links and unmapped categories
        if (!color || color === '#000000' || color === 'black' || color === '#000') {
          // D3 categorical palette (same as above)
          const d3Palette = [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
            '#bcbd22', '#17becf', '#393b79', '#637939', '#8c6d31', '#843c39', '#7b4173', '#5254a3',
            '#9c9ede', '#cedb9c', '#e7ba52', '#ad494a', '#a55194', '#6b6ecf', '#b5cf6b', '#bd9e39',
            '#ce6dbd', '#de9ed6', '#3182bd', '#f33e52', '#bdbdbd', '#6baed6', '#fd8d3c', '#e6550d',
            '#31a354', '#756bb1', '#636363', '#969696', '#e41a1c', '#377eb8', '#4daf4a', '#984ea3',
            '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'
          ];
          const index = Math.abs(d.source.name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)) % d3Palette.length;
          return d3Palette[index];
        }
        return color;
      })
      .attr('stroke-width', (d: any) => Math.min(Math.max(settings.isDarkMode ? 2 : 1, d.width), maxLinkWidth))
      .attr('fill', 'none')
      .attr('filter', (d: any) => {
        if (hoveredLink === d) return 'url(#glow)';
        return settings.isDarkMode ? 'url(#dark-mode-glow)' : null;
      })
      .attr('pointer-events', 'all')
      .attr('stroke-linecap', 'round')
      .attr('opacity', (d: any) => {
        // Dummy links: very low opacity
        if (d.isDummy) return 0.08;
        // Adjust opacity based on dark mode for better visibility
        const baseOpacity = settings.isDarkMode ? 0.85 : 0.4;
        const highlightOpacity = settings.isDarkMode ? 1.0 : 0.9;
        const dimOpacity = settings.isDarkMode ? 0.4 : 0.1;
        // Default opacity when no highlighting
        if (animationPhase !== 'highlighting') return baseOpacity;
        // Highlight links from the active source
        if (hoveredSourceIndex !== null) {
          const hoveredSource = sortedSources[hoveredSourceIndex];
          return d.source.name === hoveredSource ? highlightOpacity : dimOpacity;
        }
        // Highlight links to the active target
        if (hoveredTargetIndex !== null) {
          const hoveredTarget = sortedTargets[hoveredTargetIndex];
          return d.target.name === hoveredTarget ? highlightOpacity : dimOpacity;
        }
        return baseOpacity;
      })
      .attr('stroke-dasharray', (d: any) => d.isDummy ? '4,4' : null); // Dashed for dummy links

    // Apply drawing animation only on category changes to prevent flickering
    if (isCategoryChange) {
      newLinks.each(function (d: any) {
        const path = d3.select(this);
        const totalLength = (this as SVGPathElement).getTotalLength();
        
        // Start with invisible path
        path
          .attr('stroke-dasharray', totalLength)
          .attr('stroke-dashoffset', totalLength)
          .attr('opacity', 0)
          .transition()
          .delay((d: any, i: number) => i * 25) // Reduced stagger delay
          .duration(600) // Reduced from 1200ms to 600ms
          .ease(d3.easeCubicInOut)
          .attr('opacity', (d: any) => {
            // Adjust opacity based on dark mode for better visibility
            const baseOpacity = settings.isDarkMode ? 0.85 : 0.4;
            const highlightOpacity = settings.isDarkMode ? 1.0 : 0.9;
            const dimOpacity = settings.isDarkMode ? 0.4 : 0.1;

            // Highlight links from the active source or to the active target
            if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
              const hoveredSource = sortedSources[hoveredSourceIndex];
              return d.source.name === hoveredSource ? highlightOpacity : dimOpacity;
            }
            if (hoveredTargetIndex !== null && animationPhase === 'highlighting') {
              const hoveredTarget = sortedTargets[hoveredTargetIndex];
              return d.target.name === hoveredTarget ? highlightOpacity : dimOpacity;
            }
            return baseOpacity;
          })
          .attr('stroke-dashoffset', 0)
          .on('end', function () {
            d3.select(this)
              .attr('stroke-linecap', 'butt') // crisp edge after animation
              .attr('stroke-dasharray', null)
              .attr('stroke-dashoffset', null);
          });
      });
    } else {
      // For non-category changes, just set the opacity directly
      newLinks.attr('opacity', (d: any) => {
        // Adjust opacity based on dark mode for better visibility
        const baseOpacity = settings.isDarkMode ? 0.85 : 0.4;
        const highlightOpacity = settings.isDarkMode ? 1.0 : 0.9;
        const dimOpacity = settings.isDarkMode ? 0.4 : 0.1;

        // Highlight links from the active source or to the active target
        if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
          const hoveredSource = sortedSources[hoveredSourceIndex];
          return d.source.name === hoveredSource ? highlightOpacity : dimOpacity;
        }
        if (hoveredTargetIndex !== null && animationPhase === 'highlighting') {
          const hoveredTarget = sortedTargets[hoveredTargetIndex];
          return d.target.name === hoveredTarget ? highlightOpacity : dimOpacity;
        }
        return baseOpacity;
      });
    }

    // Add hover interactions
    newLinks
      .on('mousemove', function (event: any, d: any) {
        setHoveredLink(d);
        setTooltip({
          x: event.offsetX,
          y: event.offsetY,
          content: (
            <div>
              <div className="font-bold">{d.source.name} → {d.target.name}</div>
              <div>{d.value} attendees</div>
            </div>
          ),
        });
      })
      .on('mouseleave', function () {
        setHoveredLink(null);
        setTooltip(null);
      });

    // --- Nodes update pattern (rects) ---


    const filteredNodes = sankeyData.nodes;
    const nodeSel = nodesG.selectAll('rect')
      .data(filteredNodes, (d: any) => d.id);
    nodeSel.exit().remove();
    nodeSel.join(
      enter => enter.append('rect')
        .attr('x', (d: any) => d.x0)
        .attr('y', (d: any) => d.y0)
        .attr('height', (d: any) => d.y1 - d.y0)
        .attr('width', (d: any) => d.x1 - d.x0)
        .attr('fill', (d: any) => {
          // Use shared color config if available
          if (CATEGORY_COLORS[d.name]) return CATEGORY_COLORS[d.name];
          const color = getNodeColor(d, getCurrentThemeColors(), settings.isDarkMode);
          // Enhanced fallback color logic for dark mode and unmapped categories
          if (!color || color === '#000000' || color === 'black' || color === '#000') {
            // D3 categorical palette (20+ colors, high contrast)
            const d3Palette = [
              '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
              '#bcbd22', '#17becf', '#393b79', '#637939', '#8c6d31', '#843c39', '#7b4173', '#5254a3',
              '#9c9ede', '#cedb9c', '#e7ba52', '#ad494a', '#a55194', '#6b6ecf', '#b5cf6b', '#bd9e39',
              '#ce6dbd', '#de9ed6', '#3182bd', '#f33e52', '#bdbdbd', '#6baed6', '#fd8d3c', '#e6550d',
              '#31a354', '#756bb1', '#636363', '#969696', '#e41a1c', '#377eb8', '#4daf4a', '#984ea3',
              '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'
            ];
            const index = Math.abs(d.name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)) % d3Palette.length;
            return d3Palette[index];
          }
          return color;
        })
        .attr('stroke', settings.isDarkMode ? '#444' : '#22223b')
        .attr('opacity', (d: any) => {
          // Source nodes: only the highlighted one is bright
          if (d.category === currentSource) {
            if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
              return d.name === sortedSources[hoveredSourceIndex] ? 1 : 0.3;
            }
            return 0.9; // Increased from 0.6 to 0.9 for more prominence
          }
          // Target nodes: only those connected to the highlighted source or hovered target are bright
          if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
            const hoveredSource = sortedSources[hoveredSourceIndex];
            const isConnected = filteredLinks.some(l => l.source.name === hoveredSource && l.target.name === d.name);
            return isConnected ? 1 : 0.3;
          }
          if (hoveredTargetIndex !== null && animationPhase === 'highlighting') {
            const hoveredTarget = sortedTargets[hoveredTargetIndex];
            return d.name === hoveredTarget ? 1 : 0.3;
          }
          return 0.9; // Increased from 0.6 to 0.9 for more prominence
        })
        .on('mousemove', function (event: any, d: any) {
          setHoveredNode(d);
          setTooltip({
            x: event.offsetX,
            y: event.offsetY,
            content: (
              <div>
                <div className="font-bold">{d.name}</div>
                <div>Category: {d.category}</div>
                <div>Responses: {d.value}</div>
              </div>
            ),
          });
        })
        .on('mouseleave', function () {
          setHoveredNode(null);
          setTooltip(null);
        })
        .on('mouseenter', function (event: any, d: any) {
          if (d.category === currentSource) {
            const idx = sortedSources.indexOf(d.name);
            setHoveredSourceIndex(idx);
            setAnimationPhase('highlighting');
          }
          if (d.category === currentTarget) {
            const idx = sortedTargets.indexOf(d.name);
            setHoveredTargetIndex(idx);
            setAnimationPhase('highlighting');
          }
        })
        .on('mouseleave', function (event: any, d: any) {
          if (d.category === currentSource) {
            setHoveredSourceIndex(null);
            setAnimationPhase('full');
          }
          if (d.category === currentTarget) {
            setHoveredTargetIndex(null);
            setAnimationPhase('full');
          }
        }),
      update => update
        .transition(d3.transition().duration(750).ease(d3.easeCubicInOut))
        .attr('x', (d: any) => d.x0)
        .attr('y', (d: any) => d.y0)
        .attr('height', (d: any) => d.y1 - d.y0)
        .attr('width', (d: any) => d.x1 - d.x0)
        .attr('fill', (d: any) => {
          // Use shared color config if available
          if (CATEGORY_COLORS[d.name]) return CATEGORY_COLORS[d.name];
          const color = getNodeColor(d, getCurrentThemeColors(), settings.isDarkMode);
          // Enhanced fallback color logic for dark mode and unmapped categories
          if (!color || color === '#000000' || color === 'black' || color === '#000') {
            // D3 categorical palette (20+ colors, high contrast)
            const d3Palette = [
              '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
              '#bcbd22', '#17becf', '#393b79', '#637939', '#8c6d31', '#843c39', '#7b4173', '#5254a3',
              '#9c9ede', '#cedb9c', '#e7ba52', '#ad494a', '#a55194', '#6b6ecf', '#b5cf6b', '#bd9e39',
              '#ce6dbd', '#de9ed6', '#3182bd', '#f33e52', '#bdbdbd', '#6baed6', '#fd8d3c', '#e6550d',
              '#31a354', '#756bb1', '#636363', '#969696', '#e41a1c', '#377eb8', '#4daf4a', '#984ea3',
              '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'
            ];
            const index = Math.abs(d.name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)) % d3Palette.length;
            return d3Palette[index];
          }
          return color;
        })
        .attr('opacity', (d: any) => {
          // Source nodes: only the highlighted one is bright
          if (d.category === currentSource) {
            if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
              return d.name === sortedSources[hoveredSourceIndex] ? 1 : 0.3;
            }
            return 0.9; // Increased from 0.6 to 0.9 for more prominence
          }
          // Target nodes: only those connected to the highlighted source or hovered target are bright
          if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
            const hoveredSource = sortedSources[hoveredSourceIndex];
            const isConnected = filteredLinks.some(l => l.source.name === hoveredSource && l.target.name === d.name);
            return isConnected ? 1 : 0.3;
          }
          if (hoveredTargetIndex !== null && animationPhase === 'highlighting') {
            const hoveredTarget = sortedTargets[hoveredTargetIndex];
            return d.name === hoveredTarget ? 1 : 0.3;
          }
          return 0.9; // Increased from 0.6 to 0.9 for more prominence
        })
    );

    // --- Node labels (re-render as before) ---
    g.selectAll('g.label-layer').remove();
    const labelLayer = g.append('g').attr('class', 'label-layer');
    const sourceNodeSet = new Set(sortedSources);
    const targetNodeSet = new Set(sortedTargets);
    const sourceNodes = sankeyData.nodes.filter(d => d.category === currentSource);
    const targetNodes = sankeyData.nodes.filter(d => d.category === currentTarget);
    sourceNodes.forEach((node: any) => {
      if (sourceNodeSet.has(node.name)) {
        labelLayer
          .append('text')
          .attr('x', -labelPadding)
          .attr('y', (node.y0 + node.y1) / 2)
          .attr('text-anchor', 'end')
          .attr('alignment-baseline', 'middle')
          .attr('font-family', nodeLabelFontFamily)
          .attr('font-weight', nodeLabelFontWeight)
          .attr('font-size', labelFontSize)
          .attr('fill', nodeLabelColor)
          .attr('aria-label', node.name)
          .attr('opacity', node.value === 0 ? 0.5 : 1)
          .text(node.name);
      }
    });
    targetNodes.forEach((node: any) => {
      if (targetNodeSet.has(node.name)) {
        labelLayer
          .append('text')
          .attr('x', chartWidth + labelPadding)
          .attr('y', (node.y0 + node.y1) / 2)
          .attr('text-anchor', 'start')
          .attr('alignment-baseline', 'middle')
          .attr('font-family', nodeLabelFontFamily)
          .attr('font-weight', nodeLabelFontWeight)
          .attr('font-size', labelFontSize)
          .attr('fill', nodeLabelColor)
          .attr('aria-label', node.name)
          .attr('opacity', node.value === 0 ? 0.5 : 1)
          .text(node.name);
      }
    });

    // 6. Update insights
    let mostCommon: typeof links[0] | undefined = links.length > 0 ? links.reduce((a, b) => (b.value > a.value ? b : a), links[0]) : undefined;
    setInsights([
      { title: 'Total Responses', value: data.length },
      { title: 'Current View', value: `${currentSource} → ${currentTarget}` },
      mostCommon
        ? { title: 'Most Common Flow', value: `${mostCommon.source.split(':')[1]} → ${mostCommon.target.split(':')[1]}`, description: `${mostCommon.value} attendees` }
        : { title: 'Most Common Flow', value: 'N/A', description: '' },
    ]);

    // 7. Automatic animation on question change only
    const transition = d3.transition().duration(750).ease(d3.easeCubicInOut);

    // Animate nodes
    nodeSel
      .transition(transition)
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('width', (d: any) => d.x1 - d.x0)
              .attr('fill', (d: any) => {
          // Use shared color config if available
          if (CATEGORY_COLORS[d.name]) return CATEGORY_COLORS[d.name];
          const color = getNodeColor(d, getCurrentThemeColors(), settings.isDarkMode);
          // Enhanced fallback color logic for dark mode and unmapped categories
          if (!color || color === '#000000' || color === 'black' || color === '#000') {
            // D3 categorical palette (20+ colors, high contrast)
            const d3Palette = [
              '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
              '#bcbd22', '#17becf', '#393b79', '#637939', '#8c6d31', '#843c39', '#7b4173', '#5254a3',
              '#9c9ede', '#cedb9c', '#e7ba52', '#ad494a', '#a55194', '#6b6ecf', '#b5cf6b', '#bd9e39',
              '#ce6dbd', '#de9ed6', '#3182bd', '#f33e52', '#bdbdbd', '#6baed6', '#fd8d3c', '#e6550d',
              '#31a354', '#756bb1', '#636363', '#969696', '#e41a1c', '#377eb8', '#4daf4a', '#984ea3',
              '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'
            ];
            const index = Math.abs(d.name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)) % d3Palette.length;
            return d3Palette[index];
          }
          return color;
        });

  }, [filteredData, currentSource, currentTarget, containerWidth, containerHeight, settings.categoryColors, settings.isDarkMode, lastCategoryChange, getCurrentThemeColors]);

  // Create sorted targets for consistent highlighting
  const sortedTargetsForHighlight = useMemo(() => {
    const sorted = [...targets];
    if (currentTarget === 'years_at_medtronic') {
      // Sort years in chronological order
      sorted.sort((a, b) => YEARS_CATEGORIES.indexOf(a) - YEARS_CATEGORIES.indexOf(b));
    } else if (currentTarget === 'learning_style') {
      // Sort learning styles in a consistent order
      const learningStyleOrder = ['Visual', 'Auditory', 'Kinesthetic', 'Reading/Writing', 'Mixed'];
      sorted.sort((a, b) => {
        const aIndex = learningStyleOrder.indexOf(a);
        const bIndex = learningStyleOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    } else {
      // Alphabetical sort for other categories
      sorted.sort();
    }
    return sorted;
  }, [targets, currentTarget]);

  // Separate effect to update visual highlighting during animation
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);
    const g = svg.select('g');
    
    // Update node opacity based on animation state
    g.selectAll('rect')
      .transition()
      .duration(200)
      .attr('opacity', function(d: any) {
        // Source nodes: only the highlighted one is bright
        if (d.category === currentSource) {
          if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
            return d.name === sortedSources[hoveredSourceIndex] ? 1 : 0.2; // Slightly higher for better visibility
          }
          return 0.9; // Increased from 0.6 to 0.9 for more prominence
        }
        // Target nodes: highlight those connected to the highlighted source
        if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
          const hoveredSource = sortedSources[hoveredSourceIndex];
          // Check if this target node is connected to the highlighted source
          const isConnected = svg.selectAll('path').data().some((link: any) => 
            link.source.name === hoveredSource && link.target.name === d.name
          );
          return isConnected ? 1 : 0.2; // Slightly higher for better visibility
        }
        if (hoveredTargetIndex !== null && animationPhase === 'highlighting') {
          const hoveredTarget = sortedTargetsForHighlight[hoveredTargetIndex];
          return d.name === hoveredTarget ? 1 : 0.2;
        }
        return 0.9; // Increased from 0.6 to 0.9 for more prominence
      })
      .attr('stroke-width', function(d: any) {
        // Add thicker stroke to highlighted source node
        if (d.category === currentSource && hoveredSourceIndex !== null && animationPhase === 'highlighting') {
          return d.name === sortedSources[hoveredSourceIndex] ? 3 : 1;
        }
        return 1;
      });

    // Update link opacity based on animation state
    g.selectAll('path')
      .transition()
      .duration(200)
      .attr('opacity', function(d: any) {
        // Adjust opacity based on dark mode for better visibility
        const baseOpacity = settings.isDarkMode ? 0.85 : 0.4;
        const highlightOpacity = settings.isDarkMode ? 1.0 : 0.95;
        const dimOpacity = settings.isDarkMode ? 0.35 : 0.05;

        // Default opacity when no highlighting
        if (animationPhase !== 'highlighting') return baseOpacity;

        // Highlight links from the active source
        if (hoveredSourceIndex !== null) {
          const hoveredSource = sortedSources[hoveredSourceIndex];
          return d.source.name === hoveredSource ? highlightOpacity : dimOpacity;
        }

        // Highlight links to the active target
        if (hoveredTargetIndex !== null) {
          const hoveredTarget = sortedTargetsForHighlight[hoveredTargetIndex];
          return d.target.name === hoveredTarget ? highlightOpacity : dimOpacity;
        }

        return baseOpacity;
      })
      .attr('stroke-width', function(d: any) {
        // Make highlighted links thicker
        if (animationPhase === 'highlighting' && hoveredSourceIndex !== null) {
          const hoveredSource = sortedSources[hoveredSourceIndex];
          return d.source.name === hoveredSource ? Math.max(2, d.width * 1.2) : Math.max(1, d.width);
        }
        return Math.max(1, d.width);
      });

    console.log('🎨 Visual highlighting updated:', {
      hoveredSourceIndex,
      sourceName: hoveredSourceIndex !== null ? sortedSources[hoveredSourceIndex] : null,
      hoveredTargetIndex,
      targetName: hoveredTargetIndex !== null ? sortedTargetsForHighlight[hoveredTargetIndex] : null,
      animationPhase
    });

  }, [hoveredSourceIndex, hoveredTargetIndex, animationPhase, sortedSources, sortedTargetsForHighlight, currentSource, currentTarget]);

  // Separate effect for hover interactions (doesn't re-render the whole visualization)
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);
    const g = svg.select('g');
    
    // Update link hover effects
    g.selectAll('path')
      .each(function(d: any) {
        const path = d3.select(this);
        const isHovered = hoveredLink === d;
        path.attr('filter', isHovered ? 'url(#glow)' : null);
      });

  }, [hoveredNode, hoveredLink]);

  // Tooltip fadeout logic
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (tooltip) {
      setTooltipVisible(true);
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = setTimeout(() => {
        setTooltipVisible(false);
        setTimeout(() => setTooltip(null), 400); // Wait for fadeout
      }, 5000);
    } else {
      setTooltipVisible(false);
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    }
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, [tooltip]);

  const tooltipEl = tooltip ? (
    <div
      style={{
        position: 'absolute',
        left: tooltip.x + 16,
        top: tooltip.y + 16,
        background: settings.isDarkMode ? 'rgba(20,20,30,0.98)' : 'rgba(255,255,255,0.98)',
        color: settings.isDarkMode ? '#fff' : '#170F5F',
        padding: '8px 12px',
        borderRadius: 6,
        pointerEvents: 'none',
        zIndex: 100,
        fontFamily: 'Avenir Next World, sans-serif',
        fontWeight: 600,
        fontSize: 14,
        boxShadow: settings.isDarkMode 
          ? '0 4px 24px 0 rgba(16, 16, 235, 0.12)' 
          : '0 4px 24px 0 rgba(0, 0, 0, 0.15)',
        border: settings.isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
        maxWidth: 280,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        opacity: tooltipVisible ? 1 : 0,
        transition: 'opacity 0.4s',
      }}
      role="tooltip"
      aria-live="polite"
    >
      {tooltip.content}
    </div>
  ) : null;

  // Create sorted sources array for highlighting (same as rendering and animation)
  const sortedSourcesForHighlight = useMemo(() => {
    let visualOrder: string[] = [];
    if (filteredData.length && chartHeight > 0 && chartHeight > 0) {
      const sourcesForNodes = [...sources];
  if (currentSource === 'years_at_medtronic') {
        sourcesForNodes.sort((a, b) => YEARS_CATEGORIES.indexOf(a) - YEARS_CATEGORIES.indexOf(b));
  } else {
        sourcesForNodes.sort();
      }
      const nodes = [
        ...sourcesForNodes.map((name) => ({ id: `${currentSource}:${name}`, name, category: currentSource })),
        ...targets.map((name) => ({ id: `${currentTarget}:${name}`, name, category: currentTarget })),
      ];
      const linksMap = new Map<string, { source: string; target: string; value: number, isDummy?: boolean }>();
      filteredData.forEach((d) => {
        const source = currentSource === 'years_at_medtronic' ? getYearsCategory(d.years_at_medtronic || 0) : (d as any)[currentSource];
        const target = currentTarget === 'years_at_medtronic' ? getYearsCategory(d.years_at_medtronic || 0) : (d as any)[currentTarget];
        const sourceId = `${currentSource}:${source}`;
        const targetId = `${currentTarget}:${target}`;
        if (!sourcesForNodes.includes(source) || !targets.includes(target)) return;
        const key = `${sourceId}→${targetId}`;
        if (!linksMap.has(key)) {
          linksMap.set(key, { source: sourceId, target: targetId, value: 0 });
        }
        linksMap.get(key)!.value += 1;
      });
      const links = Array.from(linksMap.values());
      const sankeyGenerator = sankey<any, any>()
        .nodeId((d: any) => d.id)
        .nodeWidth(12)
        .nodePadding(nodePadding)
        .extent([[0, 0], [chartHeight, chartHeight]]);
      const sankeyData = sankeyGenerator({
        nodes: nodes.map((d) => ({ ...d })),
        links: links.map((d) => ({ ...d })),
      });
      const sourceNodes = sankeyData.nodes.filter((d: any) => d.category === currentSource);
      visualOrder = sourceNodes
        .slice()
        .sort((a: any, b: any) => a.y0 - b.y0)
        .map((d: any) => d.name);
    }
    return visualOrder.length ? visualOrder : [...sources];
  }, [filteredData, currentSource, currentTarget, sources, targets, chartHeight, nodePadding]);

  // Determine which source or target to highlight based on animation state
  let highlightSourceName: string | null = null;
  let highlightTargetName: string | null = null;
  if (isInFullOpacityState) {
    highlightSourceName = null;
    highlightTargetName = null;
  } else if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
    highlightSourceName = sortedSourcesForHighlight[hoveredSourceIndex];
  } else if (hoveredTargetIndex !== null && animationPhase === 'highlighting') {
    highlightTargetName = targets[hoveredTargetIndex];
  }

  // Enhanced animation pause/resume with debug tracking
  const pauseAnimation = useCallback((reason: string) => {
    if (animationRef.current.running && !animationRef.current.isPaused) {
      console.log('⏸️  PAUSING ANIMATION:', reason, {
        currentSourceIndex: animationRef.current.currentSourceIndex,
        currentTargetIndex: animationRef.current.currentTargetIndex,
        currentSource,
        currentTarget
      });
      
      animationRef.current.isPaused = true;
      animationRef.current.pausedAt = Date.now();
      
      if (animationRef.current.timer) {
        clearTimeout(animationRef.current.timer);
        animationRef.current.timer = null;
      }
    }
  }, [currentSource, currentTarget]);

  const resumeAnimation = useCallback((reason: string) => {
    if (animationRef.current.running && animationRef.current.isPaused) {
      console.log('▶️  RESUMING ANIMATION:', reason, {
        currentSourceIndex: animationRef.current.currentSourceIndex,
        currentTargetIndex: animationRef.current.currentTargetIndex,
        pausedDuration: Date.now() - animationRef.current.pausedAt
      });
      
      animationRef.current.isPaused = false;
      animationRef.current.resumeFrom = 'source';
      
      // Resume animation from current position with a small delay to ensure state is updated
      setTimeout(() => {
        if (animationRef.current.running && !animationRef.current.isPaused) {
          animate();
        }
      }, 100);
    }
  }, [animate]);

  // Update hover handlers with proper state management
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    
    // Update link hover behavior
    svg.selectAll('path')
      .on('mouseenter', function(event: any, d: any) {
        // Pause animation during hover
        pauseAnimation('link hover');
        
        // Set hover states
        setHoveredLink(d);
        setAnimationPhase('highlighting');
        
        // Handle source node hover
        if (d.source && d.source.category === currentSource) {
          const idx = sortedSources.indexOf(d.source.name);
          setHoveredSourceIndex(idx);
          console.log('🎯 Manual source highlight:', d.source.name, 'index:', idx);
        }
        
        // Handle target node hover
        if (d.target && d.target.category === currentTarget) {
          const idx = sortedTargetsForHighlight.indexOf(d.target.name);
          setHoveredTargetIndex(idx);
          console.log('🎯 Manual target highlight:', d.target.name, 'index:', idx);
        }
      })
      .on('mouseleave', function() {
        // Resume animation
        resumeAnimation('link hover end');
        
        // Clear hover states
        setHoveredLink(null);
        setHoveredSourceIndex(null);
        setHoveredTargetIndex(null);
        setAnimationPhase('full');
      });

    // Update node hover behavior
    svg.selectAll('rect')
      .on('mouseenter', function(event: any, d: any) {
        // Pause animation during hover
        pauseAnimation('node hover');
        setAnimationPhase('highlighting');
        
        // Handle source node hover
        if (d.category === currentSource) {
          const idx = sortedSources.indexOf(d.name);
          setHoveredSourceIndex(idx);
          console.log('🎯 Manual source node highlight:', d.name, 'index:', idx);
        }
        
        // Handle target node hover
        if (d.category === currentTarget) {
          const idx = sortedTargetsForHighlight.indexOf(d.name);
          setHoveredTargetIndex(idx);
          console.log('🎯 Manual target node highlight:', d.name, 'index:', idx);
        }
      })
      .on('mouseleave', function() {
        // Resume animation
        resumeAnimation('node hover end');
        
        // Clear hover states
        setHoveredSourceIndex(null);
        setHoveredTargetIndex(null);
        setAnimationPhase('full');
      });

    return () => {
      // Clean up all event listeners
      svg.selectAll('path, rect')
        .on('mouseenter', null)
        .on('mouseleave', null);
    };
  }, [sortedSources, sortedTargetsForHighlight, currentSource, currentTarget, pauseAnimation, resumeAnimation]);

  // Main rendering effect
  useEffect(() => {
    if (!svgRef.current || !data.length) return;
    
    // The main rendering logic handles all opacity updates
    // This ensures data binding is correct and prevents the undefined error
    
  }, [filteredData, hoveredSourceIndex, hoveredTargetIndex, animationPhase, sortedSources, targets, currentSource, currentTarget]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 220, minWidth: 320, position: 'relative' }}>
      {/* Category Selection Controls */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 20,
        pointerEvents: 'none'
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <select
            value={currentSource}
            onChange={(e) => setCurrentSource(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: settings.isDarkMode ? '1px solid #444' : '1px solid #ccc',
              background: settings.isDarkMode ? '#2a2a2a' : '#fff',
              color: settings.isDarkMode ? '#fff' : '#000',
              fontSize: '14px',
              fontFamily: 'Avenir Next World, sans-serif'
            }}
          >
            {availableFields.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ pointerEvents: 'auto' }}>
          <select
            value={currentTarget}
            onChange={(e) => setCurrentTarget(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: settings.isDarkMode ? '1px solid #444' : '1px solid #ccc',
              background: settings.isDarkMode ? '#2a2a2a' : '#fff',
              color: settings.isDarkMode ? '#fff' : '#000',
              fontSize: '14px',
              fontFamily: 'Avenir Next World, sans-serif'
            }}
          >
            {availableFields.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Show a message if data is very sparse */}
      {(nodeCount <= 2 || (sources.length <= 1 || targets.length <= 1)) && (
        <div style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,255,200,0.95)',
          color: '#170F5F',
          padding: '12px 24px',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 18,
          zIndex: 10,
          boxShadow: '0 2px 12px 0 rgba(0,0,0,0.08)'
        }}>
          Not enough data to show a meaningful flow diagram.
        </div>
      )}
      <svg
        ref={svgRef}
        width={containerWidth}
        height={containerHeight}
        viewBox={`0 0 ${containerWidth} ${containerHeight}`}
        style={{ display: 'block', width: '100%', height: '100%', background: 'transparent' }}
      >
        {/* Main chart group, translated by margin */}
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* ... nodes and links ... */}
        </g>
        {/* Debug outlines for alignment (only if debugOn) */}
        {debugOn && (
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* Node debug outlines */}
            {Array.isArray(debugSankeyData?.nodes) && debugSankeyData.nodes.map((d: any, i: number) => (
              <rect
                key={`debug-node-${i}`}
                x={d.x0}
                y={d.y0}
                width={d.x1 - d.x0}
                height={d.y1 - d.y0}
                fill="none"
                stroke="magenta"
                strokeDasharray="4 2"
                pointerEvents="none"
              />
            ))}
            {/* Link debug outlines (if any) */}
            {Array.isArray(debugSankeyData?.links) && debugSankeyData.links.map((d: any, i: number) => {
              const path = clampedSankeyLinkHorizontal()(d) || '';
              return (
                <path
                  key={`debug-link-${i}`}
                  d={path}
                  fill="none"
                  stroke="cyan"
                  strokeWidth={2}
                  pointerEvents="none"
                />
              );
            })}
          </g>
        )}
      </svg>
      {tooltipEl}
    </div>
  );
} 