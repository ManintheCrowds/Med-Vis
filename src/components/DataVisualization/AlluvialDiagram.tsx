'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
// @ts-expect-error: No types for d3-interpolate-path
import { interpolatePath } from 'd3-interpolate-path';
import { useVisualizationData } from './shared/useVisualizationData';
import { VisualizationContainer } from './shared/VisualizationContainer';
import { DataInsightPanel } from './shared/DataInsightPanel';
import { getYearsColorScale, getYearsCategory, getNodeColor } from './shared/colorUtils';
import { QuestionSelector } from './shared/QuestionSelector';
import { useAppContext } from '@/lib/context/AppContext';
import type { Database } from '@/lib/supabase/types';

interface AlluvialDiagramProps {
  width?: number;
  height?: number;
  autoPlay?: boolean;
  onQuestionChange?: (source: string, target: string) => void;
}

type SurveyResponse = Database['public']['Tables']['survey_responses']['Row'] & {
  attendee: Database['public']['Tables']['attendees']['Row'];
};

interface SankeyNode {
  id: string;
  name: string;
  category: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  value: number;
}

interface SankeyLink {
  source: SankeyNode;
  target: SankeyNode;
  value: number;
  width: number;
  y0: number;
  y1: number;
}

interface AnimationState {
  timer: NodeJS.Timeout | null;
  running: boolean;
  currentSourceIndex: number;
  currentTargetIndex: number;
  isPaused: boolean;
  pausedAt: number;
  resumeFrom: 'source' | 'target' | null;
}

interface TooltipState {
  x: number;
  y: number;
  content: React.ReactNode;
}

const availableFields = [
  { value: 'years_at_medtronic', label: 'Years at Medtronic' },
  { value: 'learning_style', label: 'Learning Style' },
  { value: 'shaped_by', label: 'Shaped By' },
  { value: 'peak_performance', label: 'Peak Performance' },
  { value: 'motivation', label: 'Motivation' },
  // Add more fields as needed
];

const YEARS_CATEGORIES = ['0-5', '6-10', '11-15', '16-20', '20+'];

// Custom wave path generator for Sankey links
function sankeyLinkWave(d: any, waveAmplitude = 8, waveFrequency = 1.1) {
  // d has source/target: {x0, x1, y0, y1}
  const x0 = d.source.x1;
  const x1 = d.target.x0;
  const y0 = d.y0;
  const y1 = d.y1;
  const midX = (x0 + x1) / 2;
  // Add a sine wave to the control points
  const waveY0 = y0 + waveAmplitude * Math.sin(waveFrequency * Math.PI * 0.25);
  const waveY1 = y1 + waveAmplitude * Math.sin(waveFrequency * Math.PI * 0.75);
  return `M${x0},${y0}
    C${midX},${waveY0} ${midX},${waveY1} ${x1},${y1}`;
}

// Note: Using theme-aware getNodeColor function from colorUtils

export default function AlluvialDiagram({
  width = 800,
  height = 600,
  autoPlay = true,
  onQuestionChange,
}: AlluvialDiagramProps) {
  // D3-safe margins - further reduced to prevent cropping
  const margin = { top: 20, right: 180, bottom: 20, left: 180 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const svgRef = useRef<SVGSVGElement>(null);
  const { data, isLoading, error } = useVisualizationData();
  const { settings, getCurrentThemeColors } = useAppContext();
  const [currentSource, setCurrentSource] = useState('years_at_medtronic');
  const [currentTarget, setCurrentTarget] = useState('learning_style');
  
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
    resumeFrom: null
  });

  // Validate years value
  const getValidYearsCategory = (years: number): string => {
    if (typeof years !== 'number' || isNaN(years) || years < 0) return '0-5';
    if (years <= 5) return '0-5';
    if (years <= 10) return '6-10';
    if (years <= 15) return '11-15';
    if (years <= 20) return '16-20';
    return '20+';
  };

  // Compute sources and targets with validation
  const sources: string[] = useMemo(() => {
    if (!Array.isArray(data) || !data.length) return [];
    if (currentSource === 'years_at_medtronic') {
      return YEARS_CATEGORIES.filter(cat => 
        data.some(d => getValidYearsCategory(d.years_at_medtronic || 0) === cat)
      );
    } else {
      return Array.from(new Set(
        data.map((d: SurveyResponse) => d[currentSource as keyof SurveyResponse])
      )).filter((value): value is string => 
        typeof value === 'string' && value.length > 0
      );
    }
  }, [data, currentSource]);

  const targets: string[] = useMemo(() => {
    if (!Array.isArray(data) || !data.length) return [];
    if (currentTarget === 'years_at_medtronic') {
      return YEARS_CATEGORIES.filter(cat => 
        data.some(d => getValidYearsCategory(d.years_at_medtronic || 0) === cat)
      );
    } else {
      // Sort target nodes consistently to maintain fixed positions
      return Array.from(new Set(
        data.map((d: SurveyResponse) => 
        currentTarget === 'years_at_medtronic' 
            ? getValidYearsCategory(d.years_at_medtronic || 0)
            : d[currentTarget as keyof SurveyResponse]
        )
      )).filter((value): value is string => 
        typeof value === 'string' && value.length > 0
      ).sort(); // Add consistent sorting
    }
  }, [data, currentTarget]);

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

  // Cleanup function inlined in useEffect to prevent dependency issues

  // Visibility change handler temporarily disabled to ensure smooth animation
  // TODO: Re-enable with proper focus detection later if needed
  // useEffect(() => {
  //   if (typeof window === 'undefined') return;
  //   function handleVisibilityChange() {
  //     if (document.hidden && animationRef.current.running) {
  //       console.log('🚫 Page hidden, pausing animation');
  //       if (animationRef.current.timer) {
  //         clearTimeout(animationRef.current.timer);
  //         animationRef.current.timer = null;
  //       }
  //       animationRef.current.running = false;
  //       setAnimationPhase('full');
  //       setIsInFullOpacityState(true);
  //     }
  //   }
  //   document.addEventListener('visibilitychange', handleVisibilityChange);
  //   return () => {
  //     document.removeEventListener('visibilitychange', handleVisibilityChange);
  //   };
  // }, []);

  // Get visual order of source nodes (top-to-bottom as they appear)
  const sortedSources = useMemo(() => {
    if (!data.length || !chartWidth || !chartHeight) return sources;

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
    data.forEach((d) => {
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
      .nodeWidth(24)
      .nodePadding(24)
      .extent([[0, 0], [chartWidth, chartHeight]]);

    const sankeyData = sankeyGenerator({
      nodes: nodes.map((d) => ({ ...d })),
      links: links.map((d) => ({ ...d })),
    });

    // Get source nodes in visual order (top to bottom)
    const sourceNodes = sankeyData.nodes
      .filter((d: any) => d.category === currentSource)
      .sort((a: any, b: any) => a.y0 - b.y0);

    return sourceNodes.map((d: any) => d.name);
  }, [data, sources, targets, currentSource, currentTarget, chartWidth, chartHeight]);

  // Enhanced animation function with comprehensive debug tracking
  const animate = useCallback(() => {
    // Check if animation is paused
    if (animationRef.current.isPaused) {
      console.log('⏸️  Animation is paused, skipping cycle');
      return;
    }

    if (!animationRef.current.running || !data.length) {
      console.log('❌ Animation stopped:', {
        running: animationRef.current.running,
        dataLength: data.length
      });
      return;
    }

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
          animationRef.current.timer = setTimeout(() => {
            if (animationRef.current.running && !animationRef.current.isPaused) {
              animate();
            }
          }, animationDurations.categoryPauseDuration);
        }, animationDurations.categoryPauseDuration);
              } else {
          // We've cycled through all targets, now change the source category
          console.log(`🔄 ✨ COMPLETED ALL TARGETS for '${currentSourceRef.current}' - Moving to next source category! ✨`);
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
          animationRef.current.timer = setTimeout(() => {
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



  // Animation effect - only restart on major changes, ignore target changes
  useEffect(() => {
    console.log('🎬 Animation useEffect triggered:', {
      autoPlay,
      isAutoPlayEnabled: settings.isAutoPlayEnabled,
      isAnimating,
      dataLength: data.length,
      svgRefExists: !!svgRef.current,
      currentSource,
      currentTarget,
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
    if (!isAnimating) {
      console.log('❌ Animation paused');
      if (animationRef.current.timer) {
        clearTimeout(animationRef.current.timer);
        animationRef.current.timer = null;
      }
      animationRef.current.running = false;
      setAnimationPhase('full');
      setIsInFullOpacityState(true);
      return;
    }
    if (!data.length) {
      console.log('❌ No data available for animation');
      return;
    }
    if (!svgRef.current) {
      console.log('❌ SVG ref not available');
      return;
    }

    // Only start animation if not already running
    if (!animationRef.current.running) {
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

      // Start animation
      animate();
    }

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
    isAnimating,
    data.length,
    currentSource // Only restart on source changes, not target changes
    // Removed startAnimation and cleanupAnimation to prevent loops
  ]);

  const nodeLabelFontSize = 18; // larger for readability
  const nodeLabelFontWeight = 700;
  const nodeLabelColor = settings.isDarkMode ? '#FFFFFF' : '#170F5F';
  const nodeLabelFontFamily = 'Avenir Next World, -apple-system, BlinkMacSystemFont, "SF Pro", "Roboto", sans-serif';
  const nodeLabelOffset = 24;

  // Render Sankey diagram
  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    // --- Persistent SVG structure ---
    const svg = d3.select<SVGSVGElement, unknown>(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous content
    svg
      .attr('width', width)
      .attr('height', height);

    // Create a group for the chart area with margin translation
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) defs = svg.append('defs') as d3.Selection<SVGDefsElement, unknown, null, undefined>;
    let linksG = g.append('g').attr('class', 'links');
    let nodesG = g.append('g').attr('class', 'nodes');

    // Sankey transformation
    const sourceAccessor = (d: any) =>
      currentSource === 'years_at_medtronic'
        ? getYearsCategory(d.years_at_medtronic || 0)
        : (d as any)[currentSource];
    const targetAccessor = (d: any) =>
      currentTarget === 'years_at_medtronic'
        ? getYearsCategory(d.years_at_medtronic || 0)
        : (d as any)[currentTarget];

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

    // Filter data to only include valid values (no additional filtering for peak_performance)
    const filteredData = data.filter(d =>
      (currentSource !== 'years_at_medtronic' || d.years_at_medtronic !== null) &&
      (currentTarget !== 'years_at_medtronic' || d.years_at_medtronic !== null)
    );

    // 2. Build nodes array with unique ids (using sorted arrays)
    const nodes = [
      ...sortedSources.map((name) => ({ id: `${currentSource}:${name}`, name, category: currentSource })),
      ...sortedTargets.map((name) => ({ id: `${currentTarget}:${name}`, name, category: currentTarget })),
    ];

    // 3. Build links array (aggregate counts for each source-target pair)
    const linksMap = new Map<string, { source: string; target: string; value: number, isDummy?: boolean }>();
    filteredData.forEach((d) => {
      const source = sourceAccessor(d);
      const target = targetAccessor(d);
      const sourceId = `${currentSource}:${source}`;
      const targetId = `${currentTarget}:${target}`;
      if (!sortedSources.includes(source) || !sortedTargets.includes(target)) return; // Exclude invalid
      const key = `${sourceId}→${targetId}`;
      if (!linksMap.has(key)) {
        linksMap.set(key, { source: sourceId, target: targetId, value: 0 });
      }
      linksMap.get(key)!.value += 1;
    });
    // Add dummy links for target categories with no incoming links
    const targetNodeIds = sortedTargets.map((name) => `${currentTarget}:${name}`);
    const sourceNodeIds = sortedSources.map((name) => `${currentSource}:${name}`);
    // Add a hidden dummy source node if needed
    const DUMMY_SOURCE_ID = '__dummy_source__';
    const DUMMY_TARGET_ID = '__dummy_target__';
    let dummySourceNodeAdded = false;
    let dummyTargetNodeAdded = false;
    targetNodeIds.forEach((targetId) => {
      const hasIncoming = Array.from(linksMap.values()).some((l) => l.target === targetId);
      if (!hasIncoming) {
        // Add dummy source node if not already present
        if (!dummySourceNodeAdded) {
          nodes.unshift({ id: DUMMY_SOURCE_ID, name: '', category: '__dummy__' });
          dummySourceNodeAdded = true;
        }
        linksMap.set(`${DUMMY_SOURCE_ID}→${targetId}`, { source: DUMMY_SOURCE_ID, target: targetId, value: 0.0001, isDummy: true });
      }
    });
    // Add dummy links for source categories with no outgoing links
    sourceNodeIds.forEach((sourceId) => {
      const hasOutgoing = Array.from(linksMap.values()).some((l) => l.source === sourceId);
      if (!hasOutgoing) {
        // Add dummy target node if not already present
        if (!dummyTargetNodeAdded) {
          nodes.push({ id: DUMMY_TARGET_ID, name: '', category: '__dummy__' });
          dummyTargetNodeAdded = true;
        }
        linksMap.set(`${sourceId}→${DUMMY_TARGET_ID}`, { source: sourceId, target: DUMMY_TARGET_ID, value: 0.0001, isDummy: true });
      }
    });
    const links = Array.from(linksMap.values());

    // 4. Sankey layout with nodeId accessor
    const sankeyGenerator = sankey<any, any>()
      .nodeId((d: any) => d.id)
      .nodeWidth(24)
      .nodePadding(24)
      .extent([[0, 0], [chartWidth, chartHeight]]);
    const sankeyData = sankeyGenerator({
      nodes: nodes.map((d) => ({ ...d })),
      links: links.map((d) => ({ ...d })),
    });

    // Remove old gradients (no longer needed)
    defs.selectAll('linearGradient.link-gradient').remove();

    // --- Add clipPath for links group ---
    svg.select('defs').selectAll('#link-clip').remove();
    defs.append('clipPath')
      .attr('id', 'link-clip')
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', height);
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
    const filteredLinks = sankeyData.links.filter((d: any) => d.source.id !== DUMMY_SOURCE_ID && d.target.id !== DUMMY_TARGET_ID);
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
      .attr('d', (d: any) => sankeyLinkWave(d, 8, 1.1))
              .attr('stroke', (d: any) => getNodeColor(d.source, getCurrentThemeColors(), settings.isDarkMode))
      .attr('stroke-width', (d: any) => Math.max(settings.isDarkMode ? 2 : 1, d.width))
      .attr('fill', 'none')
      .attr('filter', (d: any) => {
        if (hoveredLink === d) return 'url(#glow)';
        return settings.isDarkMode ? 'url(#dark-mode-glow)' : null;
      })
      .attr('pointer-events', 'all')
      .attr('stroke-linecap', 'round')
      .attr('opacity', (d: any) => {
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
      });

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


    const filteredNodes = sankeyData.nodes.filter((d: any) => d.id !== DUMMY_SOURCE_ID && d.id !== DUMMY_TARGET_ID);
    const nodeSel = nodesG.selectAll('rect')
      .data(filteredNodes, (d: any) => d.id);
    nodeSel.exit().remove();
    nodeSel.join(
      enter => enter.append('rect')
        .attr('x', (d: any) => d.x0)
        .attr('y', (d: any) => d.y0)
        .attr('height', (d: any) => (d.value === 0 ? 0.0001 : d.y1 - d.y0))
        .attr('width', (d: any) => d.x1 - d.x0)
        .attr('fill', (d: any) => getNodeColor(d, getCurrentThemeColors(), settings.isDarkMode))
        .attr('stroke', settings.isDarkMode ? '#444' : '#22223b')
        .attr('opacity', (d: any) => {
          // Source nodes: only the highlighted one is bright
          if (d.category === currentSource) {
            if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
              return d.name === sortedSources[hoveredSourceIndex] ? 1 : 0.2;
            }
            return 0.6;
          }
          // Target nodes: only those connected to the highlighted source or hovered target are bright
          if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
            const hoveredSource = sortedSources[hoveredSourceIndex];
            const isConnected = filteredLinks.some(l => l.source.name === hoveredSource && l.target.name === d.name);
            return isConnected ? 1 : 0.2;
          }
          if (hoveredTargetIndex !== null && animationPhase === 'highlighting') {
            const hoveredTarget = sortedTargets[hoveredTargetIndex];
            return d.name === hoveredTarget ? 1 : 0.2;
          }
          return 0.6;
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
        .attr('height', (d: any) => (d.value === 0 ? 0.0001 : d.y1 - d.y0))
        .attr('width', (d: any) => d.x1 - d.x0)
        .attr('fill', (d: any) => getNodeColor(d, getCurrentThemeColors(), settings.isDarkMode))
        .attr('opacity', (d: any) => {
          // Source nodes: only the highlighted one is bright
          if (d.category === currentSource) {
            if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
              return d.name === sortedSources[hoveredSourceIndex] ? 1 : 0.2;
            }
            return 0.6;
          }
          // Target nodes: only those connected to the highlighted source or hovered target are bright
          if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
            const hoveredSource = sortedSources[hoveredSourceIndex];
            const isConnected = filteredLinks.some(l => l.source.name === hoveredSource && l.target.name === d.name);
            return isConnected ? 1 : 0.2;
          }
          if (hoveredTargetIndex !== null && animationPhase === 'highlighting') {
            const hoveredTarget = sortedTargets[hoveredTargetIndex];
            return d.name === hoveredTarget ? 1 : 0.2;
          }
          return 0.6;
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
          .attr('x', node.x0 - nodeLabelOffset)
          .attr('y', (node.y0 + node.y1) / 2)
          .attr('text-anchor', 'end')
          .attr('alignment-baseline', 'middle')
          .attr('font-family', nodeLabelFontFamily)
          .attr('font-weight', nodeLabelFontWeight)
          .attr('font-size', nodeLabelFontSize)
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
          .attr('x', node.x1 + nodeLabelOffset)
          .attr('y', (node.y0 + node.y1) / 2)
          .attr('text-anchor', 'start')
          .attr('alignment-baseline', 'middle')
          .attr('font-family', nodeLabelFontFamily)
          .attr('font-weight', nodeLabelFontWeight)
          .attr('font-size', nodeLabelFontSize)
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
      .attr('fill', (d: any) => getNodeColor(d, getCurrentThemeColors(), settings.isDarkMode));

  }, [data, currentSource, currentTarget, width, height, settings.categoryColors, settings.isDarkMode, lastCategoryChange, getCurrentThemeColors]);

  // Create sorted targets for consistent highlighting
  const sortedTargetsForHighlight = useMemo(() => {
    const sorted = [...targets];
    if (currentTarget === 'years_at_medtronic') {
      sorted.sort((a, b) => YEARS_CATEGORIES.indexOf(a) - YEARS_CATEGORIES.indexOf(b));
    } else {
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
            return d.name === sortedSources[hoveredSourceIndex] ? 1 : 0.15; // More dramatic contrast
          }
          return 0.6;
        }
        // Target nodes: highlight those connected to the highlighted source
        if (hoveredSourceIndex !== null && animationPhase === 'highlighting') {
          const hoveredSource = sortedSources[hoveredSourceIndex];
          // Check if this target node is connected to the highlighted source
          const isConnected = svg.selectAll('path').data().some((link: any) => 
            link.source.name === hoveredSource && link.target.name === d.name
          );
          return isConnected ? 1 : 0.15; // More dramatic contrast
        }
        if (hoveredTargetIndex !== null && animationPhase === 'highlighting') {
          const hoveredTarget = sortedTargetsForHighlight[hoveredTargetIndex];
          return d.name === hoveredTarget ? 1 : 0.15;
        }
        return 0.6;
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

  // Tooltip rendering with dark mode support
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
    if (data.length && chartWidth > 0 && chartHeight > 0) {
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
      data.forEach((d) => {
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
        .nodeWidth(24)
        .nodePadding(24)
        .extent([[0, 0], [chartWidth, chartHeight]]);
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
  }, [data, currentSource, currentTarget, sources, targets, chartWidth, chartHeight]);

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
      
      // Resume animation from current position
      animate();
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
        setIsAnimating(false);
        
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
        setIsAnimating(true);
        
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
        setIsAnimating(false);
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
        setIsAnimating(true);
        
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
    
  }, [data, hoveredSourceIndex, hoveredTargetIndex, animationPhase, sortedSources, targets, currentSource, currentTarget]);

  return (
    <div className={`w-full h-full flex flex-col items-start justify-start transition-colors duration-200 ${
      settings.isDarkMode ? 'bg-gray-900' : 'bg-white'
    }`}>
      {/* Question Selector - Reduced top padding to move visualization higher */}
      <div className="w-full flex flex-col items-center justify-start pt-4 pb-6 mb-4" style={{ zIndex: 1000 }}>
        <QuestionSelector
          availableFields={availableFields}
          currentSource={currentSource}
          currentTarget={currentTarget}
          onChange={(source, target) => {
            setCurrentSource(source);
            setCurrentTarget(target);
            setLastCategoryChange({ source, target });
          }}
        />
      </div>
      
      {/* Debug Panel - Only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="w-full px-4 mb-4">
          <div className={`p-3 rounded text-xs font-mono transition-colors duration-200 ${
            settings.isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-900'
          }`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Animation State:</strong>
                <div>Running: {animationRef.current.running ? '✅' : '❌'}</div>
                <div>Paused: {animationRef.current.isPaused ? '⏸️' : '▶️'}</div>
                <div>Phase: {animationPhase}</div>
              </div>
              <div>
                <strong>Current Position:</strong>
                <div>Source: {sortedSources[animationRef.current.currentSourceIndex] || 'N/A'} ({animationRef.current.currentSourceIndex + 1}/{sortedSources.length})</div>
                <div>Target: {currentTarget} ({animationRef.current.currentTargetIndex + 1}/{availableFields.filter(f => f.value !== currentSource).length})</div>
              </div>
              <div>
                <strong>Categories:</strong>
                <div>{currentSource} → {currentTarget}</div>
                <div>Sources: {sortedSources.join(', ')}</div>
              </div>
              <div>
                <strong>Highlighting:</strong>
                <div>Source Index: {hoveredSourceIndex}</div>
                <div>Target Index: {hoveredTargetIndex}</div>
                <div>Animating: {isAnimating ? '✅' : '❌'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Visualization Container - Takes remaining space */}
      <div
        style={{
          position: 'relative',
          width: width,
          height: height * 0.75, // Use 75% of available height for the chart
          overflow: 'visible',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'transparent',
          borderRadius: 0,
          boxShadow: 'none',
          margin: '0 auto',
        }}
        className="my-2"
      >
        <svg ref={svgRef} width={width} height={height * 0.75} style={{ overflow: 'visible', display: 'block', margin: '0 auto' }} />
        {tooltipEl}
      </div>
    </div>
  );
} 