'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { arc } from 'd3-shape';
import { useVisualizationData } from './shared/useVisualizationData';
import { VisualizationContainer } from './shared/VisualizationContainer';
import { DataInsightPanel } from './shared/DataInsightPanel';
import { QuestionSelector } from './shared/QuestionSelector';
import { 
  processChordData, 
  chordConfig, 
  cyclingModes, 
  getChordColor,
  chordAnimations,
  filterConnectedCategories,
  type ChordMatrix,
  type ChordGroup,
  type ChordLink
} from './shared/chordUtils';
import { useAppContext } from '@/lib/context/AppContext';
import GlobalControlsNav from '@/components/shared/GlobalControlsNav';
import { getYearsCategory } from './shared/colorUtils';

interface ChordDiagramProps {
  width?: number;
  height?: number;
  autoPlay?: boolean;
  onRelationshipChange?: (source: string, target: string) => void;
  enableRotation?: boolean;
  showAllConnections?: boolean;
}

// Helper to get color for a node using global context (theme-aware)
function getNodeColor(nodeName: string, category: string, globalColors: any, isDarkMode: boolean = false): string {
  const themeColors = isDarkMode ? globalColors.dark : globalColors.light;
  
  if (category === 'years_at_medtronic') {
    return themeColors.years_at_medtronic?.[nodeName] || '#FF6B6B';
  }
  
  // Use global colors if available, otherwise fallback to defaults
  if (category === 'learning_style') {
    return themeColors.learning_style?.[nodeName] || '#60a5fa';
  }
  if (category === 'peak_performance') {
    return themeColors.peak_performance?.[nodeName] || '#4F8EF7';
  }
  if (category === 'motivation') {
    return themeColors.motivation?.[nodeName] || '#9467bd';
  }
  if (category === 'shaped_by') {
    return themeColors.shaped_by?.[nodeName] || '#1f77b4';
  }
  return '#8884d8';
}

export default function ChordDiagram({
  width = 1400,
  height = 1000,
  autoPlay = true,
  onRelationshipChange,
  enableRotation = true,
  showAllConnections = false,
}: ChordDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const secondarySvgRef = useRef<SVGSVGElement>(null);
  const { data, isLoading, error } = useVisualizationData();
  const [currentSource, setCurrentSource] = useState('years_at_medtronic');
  const [currentTarget, setCurrentTarget] = useState('learning_style');
  const [insights, setInsights] = useState<Array<{ title: string; value: string; description?: string }>>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  const { settings } = useAppContext();
  const [lastCategoryChange, setLastCategoryChange] = useState<{ source: string; target: string }>({ source: currentSource, target: currentTarget });
  const [showSecondaryChord, setShowSecondaryChord] = useState(false);
  
  // Animation state management (similar to AlluvialDiagram)
  const [animationPhase, setAnimationPhase] = useState<'full' | 'highlighting' | 'transitioning'>('full');
  const [highlightedArcIndex, setHighlightedArcIndex] = useState<number | null>(null);
  const [highlightedSide, setHighlightedSide] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  
  // Secondary chord animation state
  const [secondaryAnimationPhase, setSecondaryAnimationPhase] = useState<'full' | 'highlighting' | 'transitioning'>('full');
  const [secondaryHighlightedArcIndex, setSecondaryHighlightedArcIndex] = useState<number | null>(null);
  const [secondaryHighlightedSide, setSecondaryHighlightedSide] = useState<'left' | 'right' | null>(null);
  
  // Animation timing ref
  const animationRef = useRef<{
    timer: NodeJS.Timeout | null;
    running: boolean;
    currentIndex: number;
    currentSide: 'left' | 'right';
    isPaused: boolean;
    cycleCount: number;
  }>({
    timer: null,
    running: false,
    currentIndex: 0,
    currentSide: 'left',
    isPaused: false,
    cycleCount: 0
  });

  // Secondary chord animation timing ref
  const secondaryAnimationRef = useRef<{
    timer: NodeJS.Timeout | null;
    running: boolean;
    currentIndex: number;
    currentSide: 'left' | 'right';
    isPaused: boolean;
  }>({
    timer: null,
    running: false,
    currentIndex: 0,
    currentSide: 'left',
    isPaused: false
  });

  // Define available fields for the selector
  const availableFields = [
    { value: 'years_at_medtronic', label: 'Years at Medtronic' },
    { value: 'peak_performance', label: 'Peak Performance' },
    { value: 'learning_style', label: 'Learning Style' },
    { value: 'motivation', label: 'Motivation' },
    { value: 'shaped_by', label: 'Shaped By' }
  ];

  // Typography constants (theme-aware)
  const labelFontSize = 20;
  const labelFontWeight = 700;
  const labelColor = settings.isDarkMode ? '#ffffff' : '#170F5F';
  const labelFontFamily = 'Avenir Next World, -apple-system, BlinkMacSystemFont, "SF Pro", "Roboto", sans-serif';

  // Check if peak performance is involved and show secondary chord
  useEffect(() => {
    const isPeakPerformanceInvolved = currentSource === 'peak_performance' || currentTarget === 'peak_performance';
    setShowSecondaryChord(isPeakPerformanceInvolved);
  }, [currentSource, currentTarget]);

  // Secondary chord diagram for peak performance breakdown
  const renderSecondaryChord = () => {
    if (!secondarySvgRef.current || !data.length || isLoading) return;

    const svg = d3.select(secondarySvgRef.current);
    svg.selectAll('*').remove();

    const filteredData = settings.useTestData 
      ? data 
      : data.filter(item => !(item as any).test_data);

    // Get all data for secondary chord (Years at Medtronic vs Peak Performance categories)
    const secondaryData = filteredData.filter(d => (d as any).peak_performance);
    
    if (secondaryData.length < 5) return;

    // Use same dimensions as main chord for consistency
    const secondaryWidth = showSecondaryChord ? width * 0.45 : width;
    const secondaryHeight = showSecondaryChord ? height * 0.8 : height * 0.85;
    const secondaryMargin = { top: 80, right: 80, bottom: 100, left: 80 };
    const secondaryChartWidth = secondaryWidth - secondaryMargin.left - secondaryMargin.right;
    const secondaryChartHeight = secondaryHeight - secondaryMargin.top - secondaryMargin.bottom;
    const secondaryRadius = Math.max(120, Math.min(secondaryChartWidth, secondaryChartHeight) / 2 - 60);

    // Years categories and Peak Performance categories
    const yearsCategories = ['0-5', '6-10', '11-15', '16-20', '20+'];
    const peakPerfCategories = Array.from(new Set(secondaryData.map(d => (d as any).peak_performance))).filter(Boolean).sort();
    
    // Create bipartite matrix: Years vs Peak Performance
    const allCategories = [...yearsCategories, ...peakPerfCategories];
    const matrix = allCategories.map((sourceCategory, sourceIndex) => 
      allCategories.map((targetCategory, targetIndex) => {
        // Only create connections between years and peak performance (not within same type)
        const sourceIsYears = sourceIndex < yearsCategories.length;
        const targetIsYears = targetIndex < yearsCategories.length;
        
        // Only connect years to peak performance
        if (sourceIsYears === targetIsYears) return 0;
        
        // Count people who match this year + performance combination
        const yearsCat = sourceIsYears ? sourceCategory : targetCategory;
        const perfCat = sourceIsYears ? targetCategory : sourceCategory;
        
        return secondaryData.filter(d => {
          const years = getYearsCategory(d.years_at_medtronic || 0);
          const perf = (d as any).peak_performance;
          return years === yearsCat && perf === perfCat;
        }).length;
      })
    );

    // Create chord layout
    const chordLayout = d3.chord().padAngle(0.05);
    const chordData = chordLayout(matrix);

    const g = svg.append('g').attr('transform', `translate(${secondaryMargin.left + secondaryChartWidth / 2}, ${secondaryMargin.top + secondaryChartHeight / 2})`);

    // Draw arcs
    const arc = d3.arc()
      .innerRadius(secondaryRadius * 0.75)
      .outerRadius(secondaryRadius * 0.95);

    const ribbon = d3.ribbon().radius(secondaryRadius * 0.75);

    // Colors: different hues for years vs peak performance types
    const yearsColors = ['#0077CC', '#00A3E0', '#4FC3F7', '#81C784', '#AED581']; // Blues/Greens for years
    const perfColors = ['#FF6B6B', '#FFD166', '#06D6A0', '#118AB2', '#FF9F1C', '#4ECDC4']; // Various colors for performance types
    const colors = [...yearsColors, ...perfColors.slice(0, peakPerfCategories.length)];

    // Draw groups (arcs) with animation and hover effects
    const groupSelection = g.selectAll('.chord-group')
      .data(chordData.groups)
      .enter()
      .append('path')
      .attr('class', 'chord-group')
      .attr('d', arc as any)
      .style('fill', (d, i) => colors[i % colors.length])
      .style('opacity', 0)
      .on('mouseenter', function(event, d: any) {
        pauseAnimation('secondary arc hover');
        
        // Trigger highlighting for secondary chord
        console.log('🎯 Secondary chord arc hover:', {
          groupIndex: d.index,
          category: allCategories[d.index]
        });
        
        setSecondaryAnimationPhase('highlighting');
        setSecondaryHighlightedArcIndex(d.index);
        setSecondaryHighlightedSide(d.index < yearsCategories.length ? 'left' : 'right');
        
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          content: (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{allCategories[d.index]?.toString().replace(/_/g, ' ') || ''}</div>
              <div>{d.index < yearsCategories.length ? 'Years at Medtronic' : 'Peak Performance Type'}</div>
              <div>Value: {d.value}</div>
            </div>
          )
        });
      })
      .on('mouseleave', () => {
        resumeAnimation('secondary arc hover end');
        setTooltip(null);
        
        // Reset highlighting when animation resumes
        setSecondaryAnimationPhase('full');
        setSecondaryHighlightedArcIndex(null);
        setSecondaryHighlightedSide(null);
      });

    // Apply transition animations to groups
    groupSelection
      .transition()
      .duration(750)
      .style('opacity', (d, i) => {
        // Apply full relationship chain highlighting
        if (secondaryAnimationPhase === 'highlighting') {
          if (secondaryHighlightedArcIndex === i) {
            return 1.0; // Source arc is fully highlighted
          }
          // Check if this arc is connected to the highlighted arc
          if (secondaryHighlightedArcIndex !== null) {
            const isConnected = chordData.some(chord => 
              (chord.source.index === i && chord.target.index === secondaryHighlightedArcIndex) ||
              (chord.source.index === secondaryHighlightedArcIndex && chord.target.index === i)
            );
            return isConnected ? 0.95 : 0.3;
          }
        }
        return 0.8;
      })
      .style('stroke-width', (d, i) => {
        if (secondaryAnimationPhase === 'highlighting' && secondaryHighlightedArcIndex === i) {
          return 3;
        }
        return 1;
      })
      .style('stroke', (d, i) => {
        if (secondaryAnimationPhase === 'highlighting' && secondaryHighlightedArcIndex === i) {
          return settings.isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
        }
        return 'none';
      });

    // Draw chords (ribbons) with animation and hover effects
    const chordSelection = g.selectAll('.chord')
      .data(chordData)
      .enter()
      .append('path')
      .attr('class', 'chord')
      .attr('d', ribbon as any)
      .style('fill', d => colors[d.source.index % colors.length])
      .style('opacity', 0)
      .on('mouseenter', function(event: any, d: any) {
        pauseAnimation('secondary ribbon hover');
        
        // Trigger highlighting for the source side of this ribbon
        console.log('🎯 Secondary ribbon hover:', {
          sourceIndex: d.source.index,
          targetIndex: d.target.index,
          sourceCategory: allCategories[d.source.index],
          targetCategory: allCategories[d.target.index]
        });
        
        setSecondaryAnimationPhase('highlighting');
        setSecondaryHighlightedArcIndex(d.source.index);
        setSecondaryHighlightedSide(d.source.index < yearsCategories.length ? 'left' : 'right');
        
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          content: (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {allCategories[d.source.index]} ↔ {allCategories[d.target.index]}
              </div>
              <div>Connections: {d.source.value}</div>
            </div>
          )
        });
      })
      .on('mouseleave', function() {
        resumeAnimation('secondary ribbon hover end');
        setTooltip(null);
        
        // Reset highlighting when animation resumes
        setSecondaryAnimationPhase('full');
        setSecondaryHighlightedArcIndex(null);
        setSecondaryHighlightedSide(null);
      });

    // Apply transition animations to chords
    chordSelection
      .transition()
      .duration(750)
      .style('opacity', d => {
        if (secondaryAnimationPhase === 'highlighting') {
          if (secondaryHighlightedArcIndex === d.source.index || secondaryHighlightedArcIndex === d.target.index) {
            return 0.95; // Make connected ribbons very prominent
          }
          return 0.2; // Dim non-connected ribbons
        }
        return settings.isDarkMode ? 0.7 : 0.6;
      })
      .style('stroke-width', d => {
        if (secondaryAnimationPhase === 'highlighting') {
          if (secondaryHighlightedArcIndex === d.source.index || secondaryHighlightedArcIndex === d.target.index) {
            return 2.5;
          }
        }
        return 0.5;
      })
      .style('stroke', d => {
        if (secondaryAnimationPhase === 'highlighting') {
          if (secondaryHighlightedArcIndex === d.source.index || secondaryHighlightedArcIndex === d.target.index) {
            return settings.isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
          }
        }
        return 'none';
      });

    // Add labels with proper spacing and rotation
    const secondaryLabelRadius = Math.max(120, secondaryRadius * 1.45);
    g.selectAll('.chord-label')
      .data(chordData.groups)
      .enter()
      .append('text')
      .attr('class', 'chord-label')
      .attr('transform', d => {
        const angle = (d.startAngle + d.endAngle) / 2 - Math.PI / 2;
        const x = secondaryLabelRadius * Math.cos(angle);
        const y = secondaryLabelRadius * Math.sin(angle);
        const rotation = angle * 180 / Math.PI;
        
        // Rotate text for better readability
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
          return `translate(${x}, ${y}) rotate(${rotation + 180})`;
        } else {
          return `translate(${x}, ${y}) rotate(${rotation})`;
        }
      })
      .attr('text-anchor', d => {
        const angle = (d.startAngle + d.endAngle) / 2 - Math.PI / 2;
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
          return 'end';
        } else {
          return 'start';
        }
      })
      .attr('alignment-baseline', 'middle')
      .style('font-family', labelFontFamily)
      .style('font-weight', labelFontWeight)
      .style('font-size', d => {
        // Dynamic font size based on number of labels
        const totalLabels = allCategories.length;
        if (totalLabels > 12) return '13px';
        if (totalLabels > 10) return '14px';
        if (totalLabels > 8) return '15px';
        return '16px';
      })
      .style('fill', labelColor)
      .style('text-transform', 'uppercase')
      .text((d, i) => {
        const text = allCategories[i]?.toString().replace(/_/g, ' ') || '';
        // Show full text for secondary chord labels
        return text;
      })
      .on('mouseenter', function(event, d) {
        const fullText = allCategories[d.index]?.toString().replace(/_/g, ' ') || '';
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          content: (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{fullText}</div>
              <div>{d.index < yearsCategories.length ? 'Years at Medtronic' : 'Peak Performance Type'}</div>
            </div>
          )
        });
      })
      .on('mouseleave', () => setTooltip(null));


  };

  // Helper function to ensure source and target are different
  const ensureDifferentCategories = (source: string, target: string): { source: string; target: string } => {
    if (source === target) {
      // Find a different target
      const differentOption = availableFields.find(field => field.value !== source);
      return { source, target: differentOption ? differentOption.value : 'learning_style' };
    }
    return { source, target };
  };

  // Ensure initial state doesn't have same categories
  useEffect(() => {
    const corrected = ensureDifferentCategories(currentSource, currentTarget);
    if (corrected.source !== currentSource || corrected.target !== currentTarget) {
      setCurrentSource(corrected.source);
      setCurrentTarget(corrected.target);
    }
  }, []);

  // Track current mode index with ref to avoid dependency issues
  const currentModeIndexRef = useRef(0);
  
  // Update mode index when source/target changes
  useEffect(() => {
    const modeIndex = cyclingModes.findIndex(
      mode => mode.source === currentSource && mode.target === currentTarget
    );
    if (modeIndex !== -1) {
      currentModeIndexRef.current = modeIndex;
    }
  }, [currentSource, currentTarget]);

  // Auto-cycling logic with stable dependencies
  useEffect(() => {
    console.log('🎵 ChordDiagram auto-cycling useEffect:', {
      autoPlay,
      isAutoPlayEnabled: settings.isAutoPlayEnabled,
      autoPlaySpeed: settings.autoPlaySpeed
    });

    if (!autoPlay || !settings.isAutoPlayEnabled) {
      console.log('❌ ChordDiagram auto-cycling disabled');
      return;
    }

    console.log('✅ ChordDiagram starting auto-cycling');

    const interval = setInterval(() => {
      const nextModeIndex = (currentModeIndexRef.current + 1) % cyclingModes.length;
      const nextMode = cyclingModes[nextModeIndex];
      
      // Safety check: ensure source and target are different
      if (nextMode.source === nextMode.target) {
        console.warn('Skipping invalid cycling mode with same source and target:', nextMode);
        return;
      }
      
      console.log('🔄 ChordDiagram cycling to:', {
        from: `mode ${currentModeIndexRef.current}`,
        to: `${nextMode.source} → ${nextMode.target}`,
        modeIndex: nextModeIndex
      });
      
      currentModeIndexRef.current = nextModeIndex;
      setCurrentSource(nextMode.source);
      setCurrentTarget(nextMode.target);
      setLastCategoryChange({ source: nextMode.source, target: nextMode.target });
      onRelationshipChange?.(nextMode.source, nextMode.target);
    }, settings.autoPlaySpeed || 6000);

    return () => {
      console.log('🧹 ChordDiagram cleaning up auto-cycling interval');
      clearInterval(interval);
    };
  }, [autoPlay, settings.isAutoPlayEnabled, settings.autoPlaySpeed]); // Stable dependencies only

  // Remove pulsing animation to eliminate flickering - will use CSS animations instead if needed

  // Arc highlighting animation with connected ribbons
  useEffect(() => {
    console.log('🔄 ChordDiagram arc highlighting effect:', {
      autoPlay,
      isAutoPlayEnabled: settings.isAutoPlayEnabled,
      dataLength: data.length
    });

    if (!autoPlay || !settings.isAutoPlayEnabled || !data.length) {
      console.log('❌ Arc highlighting disabled');
      // Reset to full opacity when animation is disabled
      setAnimationPhase('full');
      setHighlightedArcIndex(null);
      setHighlightedSide(null);
      if (animationRef.current.timer) {
        clearTimeout(animationRef.current.timer);
        animationRef.current.timer = null;
      }
      animationRef.current.running = false;
      return;
    }

    const animate = () => {
      if (!animationRef.current.running || animationRef.current.isPaused) return;

      // Get current data context (this will adapt to mode changes)
      const filteredData = settings.useTestData ? data : data.filter(item => !(item as any).test_data);
      
      // Define all possible categories for each field (not just those with data)
      const allCategories = {
        years_at_medtronic: ['0-5', '6-10', '11-15', '16-20', '20+'],
        learning_style: ['visual', 'auditory', 'kinesthetic', 'reading_writing'],
        shaped_by: ['mentor', 'challenge', 'failure', 'success', 'team', 'other'],
        peak_performance: ['Extrovert, Morning', 'Extrovert, Evening', 'Introvert, Morning', 'Introvert, Night', 'Ambivert, Morning', 'Ambivert, Night'],
        motivation: ['impact', 'growth', 'recognition', 'autonomy', 'purpose']
      };
      
      const leftValues = allCategories[currentSource as keyof typeof allCategories] || [];
      const rightValues = allCategories[currentTarget as keyof typeof allCategories] || [];

      const currentSideLength = animationRef.current.currentSide === 'left' ? leftValues.length : rightValues.length;

      // Safety check: if current index is out of bounds for new mode, reset to 0
      if (animationRef.current.currentIndex >= currentSideLength) {
        animationRef.current.currentIndex = 0;
      }

      // Debug: Log the current animation state for dev tools
      console.log('[ChordAnimation] Side:', animationRef.current.currentSide, 'Index:', animationRef.current.currentIndex, 'Total on side:', currentSideLength, 'Mode:', currentSource + ' → ' + currentTarget);

      setAnimationPhase('highlighting');
      setHighlightedArcIndex(animationRef.current.currentIndex);
      setHighlightedSide(animationRef.current.currentSide);
      
      const highlightedCategory = animationRef.current.currentSide === 'left' 
        ? leftValues[animationRef.current.currentIndex]
        : rightValues[animationRef.current.currentIndex];
      
      // Check if this category has data
      const hasData = filteredData.some(d => {
        if (animationRef.current.currentSide === 'left') {
          if (currentSource === 'years_at_medtronic') {
            return getYearsCategory(d.years_at_medtronic || 0) === highlightedCategory;
          }
          return (d as any)[currentSource] === highlightedCategory;
        } else {
          if (currentTarget === 'years_at_medtronic') {
            return getYearsCategory(d.years_at_medtronic || 0) === highlightedCategory;
          }
          return (d as any)[currentTarget] === highlightedCategory;
        }
      });
      
      console.log('✨ Highlighting full relationship chain for:', {
        sourceCategory: highlightedCategory,
        sourceSide: animationRef.current.currentSide,
        sourceIndex: animationRef.current.currentIndex,
        hasData: hasData,
        totalCategories: currentSideLength
      });

      // Calculate timing based on global settings - slower for better visibility
      const stepDuration = Math.max(1500, (settings.autoPlaySpeed || 3000) / 3);
      const pauseDuration = Math.max(300, stepDuration / 5);

      // Move to next position - include the last index before switching
      if (animationRef.current.currentIndex < currentSideLength - 1) {
        animationRef.current.timer = setTimeout(() => {
          if (animationRef.current.running && !animationRef.current.isPaused) {
            animationRef.current.currentIndex++;
            animate();
          }
        }, stepDuration + pauseDuration);
      } else {
        // Show the last index for the full duration before switching
        animationRef.current.timer = setTimeout(() => {
          if (animationRef.current.running && !animationRef.current.isPaused) {
            // Now switch sides or complete cycle
            if (animationRef.current.currentSide === 'left') {
              animationRef.current.currentSide = 'right';
              animationRef.current.currentIndex = 0;
              animate();
            } else {
              // Complete cycle - show full diagram briefly, then restart
              animationRef.current.cycleCount++;
              console.log('🎉 ChordAnimation completed full cycle #' + animationRef.current.cycleCount + '! Restarting...');
              setAnimationPhase('full');
              setHighlightedArcIndex(null);
              setHighlightedSide(null);
              
              animationRef.current.timer = setTimeout(() => {
                if (animationRef.current.running && !animationRef.current.isPaused) {
                  animationRef.current.currentSide = 'left';
                  animationRef.current.currentIndex = 0;
                  animate();
                }
              }, stepDuration * 2);
            }
          }
        }, stepDuration + pauseDuration);
      }
    };

    // Start animation if not already running
    if (!animationRef.current.running) {
      console.log('✅ Starting ChordDiagram arc highlighting animation');
      animationRef.current.running = true;
      animationRef.current.currentIndex = 0;
      animationRef.current.currentSide = 'left';
      animationRef.current.isPaused = false;
      animate();
    } else {
      console.log('⚠️ Arc highlighting animation already running');
    }

    return () => {
      console.log('🧹 Cleaning up ChordDiagram arc highlighting animation');
      if (animationRef.current.timer) {
        clearTimeout(animationRef.current.timer);
        animationRef.current.timer = null;
      }
      animationRef.current.running = false;
      setAnimationPhase('full');
      setHighlightedArcIndex(null);
      setHighlightedSide(null);
    };
  }, [autoPlay, settings.isAutoPlayEnabled, data.length, settings.autoPlaySpeed, settings.useTestData]); // Removed currentSource, currentTarget to prevent restarting

  // Secondary chord animation system
  useEffect(() => {
    if (!autoPlay || !settings.isAutoPlayEnabled || !data.length || !showSecondaryChord) {
      // Stop animation if conditions not met
      console.log('🛑 Stopping secondary chord animation:', {
        autoPlay,
        isAutoPlayEnabled: settings.isAutoPlayEnabled,
        hasData: data.length > 0,
        showSecondaryChord
      });
      
      if (secondaryAnimationRef.current.timer) {
        clearTimeout(secondaryAnimationRef.current.timer);
        secondaryAnimationRef.current.timer = null;
      }
      secondaryAnimationRef.current.running = false;
      return;
    }

    const animateSecondary = () => {
      if (!secondaryAnimationRef.current.running || secondaryAnimationRef.current.isPaused) return;

      // Get secondary chord data context first
      const filteredData = settings.useTestData ? data : data.filter(item => !(item as any).test_data);
      const secondaryData = filteredData.filter(d => (d as any).peak_performance);
      const yearsCategories = ['0-5', '6-10', '11-15', '16-20', '20+'];
      const peakPerfCategories = Array.from(new Set(secondaryData.map(d => (d as any).peak_performance))).filter(Boolean).sort();
      const allCategories = [...yearsCategories, ...peakPerfCategories];

      const currentSideLength = secondaryAnimationRef.current.currentSide === 'left' ? yearsCategories.length : peakPerfCategories.length;

      // Safety check: if current index is out of bounds, reset to 0
      if (secondaryAnimationRef.current.currentIndex >= currentSideLength) {
        secondaryAnimationRef.current.currentIndex = 0;
      }

      console.log('🎯 SecondaryChord arc animation:', {
        side: secondaryAnimationRef.current.currentSide,
        index: secondaryAnimationRef.current.currentIndex
      });

      setSecondaryAnimationPhase('highlighting');
      
      // Calculate the actual arc index based on side and position
      const actualArcIndex = secondaryAnimationRef.current.currentSide === 'left' 
        ? secondaryAnimationRef.current.currentIndex // Left side: direct index (0-4)
        : yearsCategories.length + secondaryAnimationRef.current.currentIndex; // Right side: offset by years count
      
      setSecondaryHighlightedArcIndex(actualArcIndex);
      setSecondaryHighlightedSide(secondaryAnimationRef.current.currentSide);

      // Calculate timing based on global settings - slower for better visibility
      const stepDuration = Math.max(1500, (settings.autoPlaySpeed || 3000) / 3);
      const pauseDuration = Math.max(300, stepDuration / 5);

      // Move to next position - include the last index before switching
      if (secondaryAnimationRef.current.currentIndex < currentSideLength - 1) {
        secondaryAnimationRef.current.timer = setTimeout(() => {
          if (secondaryAnimationRef.current.running && !secondaryAnimationRef.current.isPaused) {
            secondaryAnimationRef.current.currentIndex++;
            animateSecondary();
          }
        }, stepDuration + pauseDuration);
      } else {
        // Show the last index for the full duration before switching
        secondaryAnimationRef.current.timer = setTimeout(() => {
          if (secondaryAnimationRef.current.running && !secondaryAnimationRef.current.isPaused) {
            // Now switch sides or complete cycle
            if (secondaryAnimationRef.current.currentSide === 'left') {
              secondaryAnimationRef.current.currentSide = 'right';
              secondaryAnimationRef.current.currentIndex = 0;
              animateSecondary();
            } else {
              // Complete cycle - show full diagram briefly, then restart
              console.log('🎉 SecondaryChordAnimation completed full cycle! Restarting...');
              setSecondaryAnimationPhase('full');
              setSecondaryHighlightedArcIndex(null);
              setSecondaryHighlightedSide(null);
              
              secondaryAnimationRef.current.timer = setTimeout(() => {
                if (secondaryAnimationRef.current.running && !secondaryAnimationRef.current.isPaused) {
                  secondaryAnimationRef.current.currentSide = 'left';
                  secondaryAnimationRef.current.currentIndex = 0;
                  animateSecondary();
                }
              }, stepDuration * 2);
            }
          }
        }, stepDuration + pauseDuration);
      }
    };

    // Start animation if not already running
    if (!secondaryAnimationRef.current.running) {
      console.log('✅ Starting SecondaryChord arc highlighting animation');
      secondaryAnimationRef.current.running = true;
      secondaryAnimationRef.current.currentIndex = 0;
      secondaryAnimationRef.current.currentSide = 'left';
      secondaryAnimationRef.current.isPaused = false;
      animateSecondary();
    } else {
      console.log('⚠️ Secondary arc highlighting animation already running');
    }

    return () => {
      console.log('🧹 Cleaning up SecondaryChord arc highlighting animation');
      if (secondaryAnimationRef.current.timer) {
        clearTimeout(secondaryAnimationRef.current.timer);
        secondaryAnimationRef.current.timer = null;
      }
      secondaryAnimationRef.current.running = false;
      setSecondaryAnimationPhase('full');
      setSecondaryHighlightedArcIndex(null);
      setSecondaryHighlightedSide(null);
    };
  }, [autoPlay, settings.isAutoPlayEnabled, data.length, showSecondaryChord, settings.autoPlaySpeed, settings.useTestData]); // Removed currentSource, currentTarget to prevent restarting

  // Re-render secondary chord when its animation state changes
  useEffect(() => {
    if (showSecondaryChord) {
      renderSecondaryChord();
    }
  }, [showSecondaryChord, data, settings.useTestData, settings.isDarkMode]);

  // Update visual styling of existing main chord elements when animation state changes
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    
    // Update left arcs opacity and stroke based on animation state
    svg.selectAll('path.left-arc')
      .transition()
      .duration(300)
      .style('opacity', (d: any, i: number) => {
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'left') {
            if (i === highlightedArcIndex) {
              return 1.0; // Source arc is fully highlighted
            }
            return 0.4; // Dim other left arcs
          }
        }
        return 0.8; // Default opacity
      })
      .style('stroke-width', (d: any, i: number) => {
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'left' && i === highlightedArcIndex) {
            return 3;
          }
        }
        return 1;
      })
      .style('stroke', (d: any, i: number) => {
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'left' && i === highlightedArcIndex) {
            return settings.isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
          }
        }
        return 'none';
      });

    // Update right arcs opacity and stroke based on animation state
    svg.selectAll('path.right-arc')
      .transition()
      .duration(300)
      .style('opacity', (d: any, i: number) => {
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'right') {
            if (i === highlightedArcIndex) {
              return 1.0; // Source arc is fully highlighted
            }
            return 0.4; // Dim other right arcs
          }
        }
        return 0.8; // Default opacity
      })
      .style('stroke-width', (d: any, i: number) => {
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'right' && i === highlightedArcIndex) {
            return 3;
          }
        }
        return 1;
      })
      .style('stroke', (d: any, i: number) => {
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'right' && i === highlightedArcIndex) {
            return settings.isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
          }
        }
        return 'none';
      });

    // Update ribbons opacity and stroke based on animation state
    svg.selectAll('path.ribbon')
      .transition()
      .duration(300)
      .style('opacity', (d: any) => {
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'left' && highlightedArcIndex === d.source.index) {
            return 0.95; // Make connected ribbons very prominent
          }
          if (highlightedSide === 'right' && highlightedArcIndex === d.target.index) {
            return 0.95; // Make connected ribbons very prominent
          }
          return 0.2; // Dim non-connected ribbons
        }
        return settings.isDarkMode ? 0.7 : 0.6;
      })
      .style('stroke-width', (d: any) => {
        if (animationPhase === 'highlighting') {
          if ((highlightedSide === 'left' && highlightedArcIndex === d.source.index) ||
              (highlightedSide === 'right' && highlightedArcIndex === d.target.index)) {
            return 2.5;
          }
        }
        return 0.5;
      })
      .style('stroke', (d: any) => {
        if (animationPhase === 'highlighting') {
          if ((highlightedSide === 'left' && highlightedArcIndex === d.source.index) ||
              (highlightedSide === 'right' && highlightedArcIndex === d.target.index)) {
            return settings.isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
          }
        }
        return 'none';
      });


  }, [animationPhase, highlightedArcIndex, highlightedSide, settings.isDarkMode]);

  // Update visual styling of existing secondary chord elements when animation state changes
  useEffect(() => {
    if (!secondarySvgRef.current || !showSecondaryChord) return;

    const svg = d3.select(secondarySvgRef.current);
    
    // Update secondary chord elements based on their animation state
    svg.selectAll('path.chord-group')
      .transition()
      .duration(300)
      .style('opacity', (d: any, i: number) => {
        if (secondaryAnimationPhase === 'highlighting') {
          if (secondaryHighlightedArcIndex === i) {
            return 1.0; // Source arc is fully highlighted
          }
          return 0.4; // Dim other arcs
        }
        return 0.8;
      })
      .style('stroke-width', (d: any, i: number) => {
        if (secondaryAnimationPhase === 'highlighting' && secondaryHighlightedArcIndex === i) {
          return 3;
        }
        return 1;
      })
      .style('stroke', (d: any, i: number) => {
        if (secondaryAnimationPhase === 'highlighting' && secondaryHighlightedArcIndex === i) {
          return settings.isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
        }
        return 'none';
      });

    svg.selectAll('path.chord')
      .transition()
      .duration(300)
      .style('opacity', (d: any) => {
        if (secondaryAnimationPhase === 'highlighting') {
          if (secondaryHighlightedArcIndex === d.source.index || secondaryHighlightedArcIndex === d.target.index) {
            return 0.95; // Make connected ribbons very prominent
          }
          return 0.2; // Dim non-connected ribbons
        }
        return settings.isDarkMode ? 0.7 : 0.6;
      })
      .style('stroke-width', (d: any) => {
        if (secondaryAnimationPhase === 'highlighting') {
          if (secondaryHighlightedArcIndex === d.source.index || secondaryHighlightedArcIndex === d.target.index) {
            return 2.5;
          }
        }
        return 0.5;
      })
      .style('stroke', (d: any) => {
        if (secondaryAnimationPhase === 'highlighting') {
          if (secondaryHighlightedArcIndex === d.source.index || secondaryHighlightedArcIndex === d.target.index) {
            return settings.isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
          }
        }
        return 'none';
      });


  }, [secondaryAnimationPhase, secondaryHighlightedArcIndex, secondaryHighlightedSide, settings.isDarkMode, showSecondaryChord]);

  // Remove conflicting opacity update system - opacity will be handled in main rendering

  // Pause/Resume animation functions (similar to AlluvialDiagram)
  const pauseAnimation = useCallback((reason: string) => {
    // Pause main chord animation
    if (animationRef.current.running && !animationRef.current.isPaused) {
      console.log('⏸️ Pausing Main Chord animation:', reason);
      animationRef.current.isPaused = true;
      if (animationRef.current.timer) {
        clearTimeout(animationRef.current.timer);
        animationRef.current.timer = null;
      }
    }
    
    // Pause secondary chord animation
    if (secondaryAnimationRef.current.running && !secondaryAnimationRef.current.isPaused) {
      console.log('⏸️ Pausing Secondary Chord animation:', reason);
      secondaryAnimationRef.current.isPaused = true;
      if (secondaryAnimationRef.current.timer) {
        clearTimeout(secondaryAnimationRef.current.timer);
        secondaryAnimationRef.current.timer = null;
      }
    }
  }, []);

  const resumeAnimation = useCallback((reason: string) => {
    // Resume main chord animation
    if (animationRef.current.running && animationRef.current.isPaused) {
      console.log('▶️ Resuming Main Chord animation:', reason);
      animationRef.current.isPaused = false;
      
      // Restart the animation timer immediately
      const restartMainAnimation = () => {
        if (!animationRef.current.running || animationRef.current.isPaused) return;

        console.log('🔄 Restarting Main Chord animation after pause');
        setAnimationPhase('highlighting');
        setHighlightedArcIndex(animationRef.current.currentIndex);
        setHighlightedSide(animationRef.current.currentSide);
        
        // Calculate timing based on global settings - slower for better visibility
        const stepDuration = Math.max(1500, (settings.autoPlaySpeed || 3000) / 3);
        const pauseDuration = Math.max(300, stepDuration / 5);

        // Get current data context
        const filteredData = settings.useTestData ? data : data.filter(item => !(item as any).test_data);
        const leftValues = currentSource === 'years_at_medtronic'
          ? ['0-5', '6-10', '11-15', '16-20', '20+']
          : Array.from(new Set(filteredData.map(d => (d as any)[currentSource]))).filter(Boolean);
        const rightValues = currentTarget === 'years_at_medtronic'
          ? ['0-5', '6-10', '11-15', '16-20', '20+']
          : Array.from(new Set(filteredData.map(d => (d as any)[currentTarget]))).filter(Boolean);

        const currentSideLength = animationRef.current.currentSide === 'left' ? leftValues.length : rightValues.length;

        // Continue animation from current position
        animationRef.current.timer = setTimeout(() => {
          if (animationRef.current.running && !animationRef.current.isPaused) {
            if (animationRef.current.currentIndex < currentSideLength - 1) {
              animationRef.current.currentIndex++;
            } else {
              // Switch sides or restart
              if (animationRef.current.currentSide === 'left') {
                animationRef.current.currentSide = 'right';
                animationRef.current.currentIndex = 0;
              } else {
                animationRef.current.currentSide = 'left';
                animationRef.current.currentIndex = 0;
              }
            }
            restartMainAnimation();
          }
        }, stepDuration);
      };
      
      restartMainAnimation();
    }
    
    // Resume secondary chord animation
    if (secondaryAnimationRef.current.running && secondaryAnimationRef.current.isPaused) {
      console.log('▶️ Resuming Secondary Chord animation:', reason);
      secondaryAnimationRef.current.isPaused = false;
      
      // Restart the secondary animation timer immediately
      const restartSecondaryAnimation = () => {
        if (!secondaryAnimationRef.current.running || secondaryAnimationRef.current.isPaused) return;

        console.log('🔄 Restarting Secondary Chord animation after pause');
        
        // Get secondary chord data context
        const filteredData = settings.useTestData ? data : data.filter(item => !(item as any).test_data);
        const secondaryData = filteredData.filter(d => (d as any).peak_performance);
        const yearsCategories = ['0-5', '6-10', '11-15', '16-20', '20+'];
        const peakPerfCategories = Array.from(new Set(secondaryData.map(d => (d as any).peak_performance))).filter(Boolean).sort();
        
        // Calculate the actual arc index based on side and position
        const actualArcIndex = secondaryAnimationRef.current.currentSide === 'left' 
          ? secondaryAnimationRef.current.currentIndex 
          : yearsCategories.length + secondaryAnimationRef.current.currentIndex;
        
        setSecondaryAnimationPhase('highlighting');
        setSecondaryHighlightedArcIndex(actualArcIndex);
        setSecondaryHighlightedSide(secondaryAnimationRef.current.currentSide);
        
        // Calculate timing based on global settings - slower for better visibility
        const stepDuration = Math.max(1500, (settings.autoPlaySpeed || 3000) / 3);
        const pauseDuration = Math.max(300, stepDuration / 5);
        const currentSideLength = secondaryAnimationRef.current.currentSide === 'left' ? yearsCategories.length : peakPerfCategories.length;

        // Continue animation from current position
        secondaryAnimationRef.current.timer = setTimeout(() => {
          if (secondaryAnimationRef.current.running && !secondaryAnimationRef.current.isPaused) {
            if (secondaryAnimationRef.current.currentIndex < currentSideLength - 1) {
              secondaryAnimationRef.current.currentIndex++;
            } else {
              // Switch sides or restart
              if (secondaryAnimationRef.current.currentSide === 'left') {
                secondaryAnimationRef.current.currentSide = 'right';
                secondaryAnimationRef.current.currentIndex = 0;
              } else {
                secondaryAnimationRef.current.currentSide = 'left';
                secondaryAnimationRef.current.currentIndex = 0;
              }
            }
            restartSecondaryAnimation();
          }
        }, stepDuration);
      };
      
      restartSecondaryAnimation();
    }
  }, [settings.autoPlaySpeed, settings.useTestData, data, currentSource, currentTarget]);

  // Check if container is too small
  const margin = { top: 80, right: 80, bottom: 100, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const isContainerTooSmall = chartWidth < 200 || chartHeight < 200;

  // Render circular chord diagram
  useEffect(() => {
    if (!svgRef.current || !data.length || isLoading || isContainerTooSmall) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    // Filter data based on global settings
    const filteredData = settings.useTestData 
      ? data 
      : data.filter(item => !(item as any).test_data);

    const svg = d3.select(svgRef.current);
    
    // Adjust size based on whether we're showing two chords
    const effectiveWidth = showSecondaryChord ? width * 0.45 : width;
    const effectiveHeight = showSecondaryChord ? height * 0.8 : height * 0.85;
    const effectiveChartWidth = effectiveWidth - margin.left - margin.right;
    const effectiveChartHeight = effectiveHeight - margin.top - margin.bottom;
    
    const radius = Math.max(120, Math.min(effectiveChartWidth, effectiveChartHeight) / 2 - 60);

    // Create definitions for gradients
    const defs = svg.append('defs');

    // Define fixed order for years at Medtronic
    const YEARS_GROUPS = ['0-5', '6-10', '11-15', '16-20', '20+'];

    // Get unique values for left and right sides, using fixed order for years
    const leftValues = currentSource === 'years_at_medtronic'
      ? YEARS_GROUPS
      : Array.from(new Set(filteredData.map(d => (d as any)[currentSource]))).filter(Boolean);
    const rightValues = currentTarget === 'years_at_medtronic'
      ? YEARS_GROUPS
      : Array.from(new Set(filteredData.map(d => (d as any)[currentTarget]))).filter(Boolean);

    // Process data for chord layout
    const chordData = processChordData(filteredData, currentSource, currentTarget);
    
    // Separate source and target categories
    const sourceCategories = new Set<string>();
    const targetCategories = new Set<string>();
    
    filteredData.forEach((d: any) => {
      if (currentSource === 'years_at_medtronic') {
        sourceCategories.add(getYearsCategory(d.years_at_medtronic || 0));
      } else {
        sourceCategories.add(d[currentSource] || 'Unknown');
      }
      
      if (currentTarget === 'years_at_medtronic') {
        targetCategories.add(getYearsCategory(d.years_at_medtronic || 0));
      } else {
        targetCategories.add(d[currentTarget] || 'Unknown');
      }
    });

    // Convert to arrays and sort
    const sourceArray = Array.from(sourceCategories).sort() as string[];
    const targetArray = Array.from(targetCategories).sort() as string[];

    // Calculate totals for each category
    const leftTotals = sourceArray.map(cat => 
      filteredData.filter((d: any) => {
        const value = currentSource === 'years_at_medtronic' 
          ? getYearsCategory(d.years_at_medtronic || 0) 
          : d[currentSource];
        return value === cat;
      }).length
    );
    
    const rightTotals = targetArray.map(cat => 
      filteredData.filter((d: any) => {
        const value = currentTarget === 'years_at_medtronic' 
          ? getYearsCategory(d.years_at_medtronic || 0) 
          : d[currentTarget];
        return value === cat;
      }).length
    );

    const leftTotalSum = leftTotals.reduce((sum, val) => sum + val, 0);
    const rightTotalSum = rightTotals.reduce((sum, val) => sum + val, 0);

    // Create connection matrix
    const connectionMatrix = sourceArray.map(sourceCat => 
      targetArray.map(targetCat => {
        return filteredData.filter((d: any) => {
          const source = currentSource === 'years_at_medtronic' 
            ? getYearsCategory(d.years_at_medtronic || 0) 
            : d[currentSource];
          const target = currentTarget === 'years_at_medtronic' 
            ? getYearsCategory(d.years_at_medtronic || 0) 
            : d[currentTarget];
          return source === sourceCat && target === targetCat;
        }).length;
      })
    );

    // Check if this is a category change that should trigger animation
    const isCategoryChange = lastCategoryChange.source !== currentSource || lastCategoryChange.target !== currentTarget;
    
    // Add smooth transitions - faster for hover interactions
    const transition = d3.transition()
      .duration(isCategoryChange ? 750 : 100)
      .ease(d3.easeCubicInOut);

    // --- True left/right bipartite layout with better spacing ---
    // Left arcs: 180°+gap to 360°-gap (Math.PI+gap to 2*Math.PI-gap)
    // Right arcs: 0+gap to 180°-gap (0+gap to Math.PI-gap)
    const arcGap = Math.PI * 0.12; // Larger gap for better label spacing
    const leftStart = Math.PI + arcGap;      // 180° + gap
    const leftEnd = 2 * Math.PI - arcGap;    // 360° - gap
    const rightStart = 0 + arcGap;           // 0° + gap
    const rightEnd = Math.PI - arcGap;       // 180° - gap
    const leftArcSpan = leftEnd - leftStart;     // 180° - 2*gap
    const rightArcSpan = rightEnd - rightStart;  // 180° - 2*gap

    // Add minimum spacing between arcs to prevent label overlap
    const minArcSpacing = Math.PI * 0.02; // Minimum 2° between arcs

    // Assign arc angles for left arcs with proper spacing
    let leftAngle = leftStart;
    const leftArcs = leftValues.map((value, i) => {
      const count = filteredData.filter(d =>
        currentSource === 'years_at_medtronic'
          ? getYearsCategory(d.years_at_medtronic || 0) === value
          : (d as any)[currentSource] === value
      ).length;
      
      // Calculate arc span with spacing consideration
      const availableSpan = leftArcSpan - (minArcSpacing * (leftValues.length - 1));
      const arcSpan = currentSource === 'years_at_medtronic'
        ? availableSpan / leftValues.length
        : Math.max(minArcSpacing, availableSpan * (count / (leftTotalSum || 1)));
      
      const startAngle = leftAngle;
      const endAngle = leftAngle + arcSpan;
      leftAngle = endAngle + minArcSpacing; // Add spacing between arcs
      
      const color = getNodeColor(value, currentSource, settings.categoryColors, settings.isDarkMode);
      const opacity = count === 0 ? 0.15 : 0.8;
      return { name: value, value: count, startAngle, endAngle, color, opacity };
    });

    // Assign arc angles for right arcs with proper spacing
    let rightAngle = rightStart;
    const rightArcs = rightValues.map((value, i) => {
      const count = filteredData.filter(d =>
        currentTarget === 'years_at_medtronic'
          ? getYearsCategory(d.years_at_medtronic || 0) === value
          : (d as any)[currentTarget] === value
      ).length;
      
      // Calculate arc span with spacing consideration
      const availableSpan = rightArcSpan - (minArcSpacing * (rightValues.length - 1));
      const arcSpan = currentTarget === 'years_at_medtronic'
        ? availableSpan / rightValues.length
        : Math.max(minArcSpacing, availableSpan * (count / (rightTotalSum || 1)));
      
      const startAngle = rightAngle;
      const endAngle = rightAngle + arcSpan;
      rightAngle = endAngle + minArcSpacing; // Add spacing between arcs
      
      const color = getNodeColor(value, currentTarget, settings.categoryColors, settings.isDarkMode);
      const opacity = count === 0 ? 0.15 : 0.8;
      return { name: value, value: count, startAngle, endAngle, color, opacity };
    });

    // Draw arcs (use per-arc opacity)
    const innerRadius = Math.max(60, radius * 0.75);
    const outerRadius = Math.max(80, radius * 0.95);
    const arcGen = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius((d: any) => {
        // Only round the outer corners (outerRadius), not the inner
        // D3 v7+ supports cornerRadius as a function
        // We'll return 0 for inner, 8 for outer
        // But d3.arc() only supports one value, so we need to use custom path if we want true squared inner corners
        // As a workaround, set cornerRadius to 0 if the arc is small, else 8
        return 0;
      });
    
    // Position the chart group with margins to prevent cropping
    const g = svg.append('g').attr('transform', `translate(${margin.left + effectiveChartWidth / 2}, ${margin.top + effectiveChartHeight / 2})`);

    // Add gradients for arcs
    leftArcs.forEach((arc, i) => {
      const baseColor = arc.color;
      const lighterColor = d3.color(baseColor)?.brighter(0.3).toString() || baseColor;
      defs.append('linearGradient')
        .attr('id', `left-arc-gradient-${i}`)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', 1)
        .selectAll('stop')
        .data([
          { offset: '0%', color: baseColor },
          { offset: '100%', color: lighterColor }
        ])
        .enter()
        .append('stop')
        .attr('offset', d => d.offset)
        .attr('stop-color', d => d.color);
    });
    rightArcs.forEach((arc, i) => {
      const baseColor = arc.color;
      const lighterColor = d3.color(baseColor)?.brighter(0.3).toString() || baseColor;
      defs.append('linearGradient')
        .attr('id', `right-arc-gradient-${i}`)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', 1)
        .selectAll('stop')
        .data([
          { offset: '0%', color: baseColor },
          { offset: '100%', color: lighterColor }
        ])
        .enter()
        .append('stop')
        .attr('offset', d => d.offset)
        .attr('stop-color', d => d.color);
    });
    // Create left arcs with event handlers first
    const leftArcSelection = g.selectAll('path.left-arc')
      .data(leftArcs)
      .enter()
      .append('path')
      .attr('class', 'left-arc')
      .attr('d', d => arcGen({ startAngle: d.startAngle, endAngle: d.endAngle } as any))
      .attr('fill', (d, i) => `url(#left-arc-gradient-${i})`)
      .attr('opacity', 0)
      .on('mouseenter', function(event, d: any) {
        if (d.value === 0) return;
        
        pauseAnimation('left arc hover');
        
        // Trigger the same highlighting as auto-cycle animation
        const arcIndex = leftArcs.findIndex(arc => arc.name === d.name);
        
        setAnimationPhase('highlighting');
        setHighlightedArcIndex(arcIndex);
        setHighlightedSide('left');
        
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          content: (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{(d.name || 'Unknown').toString().replace(/_/g, ' ')}</div>
              <div>Count: {d.value}</div>
            </div>
          )
        });
      })
      .on('mouseleave', () => {
        resumeAnimation('left arc hover end');
        setTooltip(null);
        
        // Reset highlighting when animation resumes
        setAnimationPhase('full');
        setHighlightedArcIndex(null);
        setHighlightedSide(null);
      });
    
    // Apply transition animations separately
    leftArcSelection
      .transition(transition)
      .attr('opacity', (d, i) => {
        // Apply full relationship chain highlighting
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'left') {
            // Highlight the source arc
            if (i === highlightedArcIndex) {
              return 1.0; // Source arc is fully highlighted
            }
            // Check if this arc is connected to the highlighted right arc
            if (highlightedSide === 'left' && highlightedArcIndex !== null) {
              return 0.4; // Dim other left arcs
            }
          } else if (highlightedSide === 'right' && highlightedArcIndex !== null) {
            // When right arc is highlighted, highlight left arcs connected to it
            const matrixValue = connectionMatrix[i] && connectionMatrix[i][highlightedArcIndex];
            const isConnectedToHighlightedRight = matrixValue > 0;
            console.log(`🔗 Left arc ${i} (${leftArcs[i]?.name}) connected to right arc ${highlightedArcIndex} (${rightArcs[highlightedArcIndex]?.name})?`, 
              isConnectedToHighlightedRight, 'Matrix value:', matrixValue);
            return isConnectedToHighlightedRight ? 0.95 : 0.3; // Higher contrast
          }
        }
        // Use stable base opacity without pulsing to prevent flickering
        return Math.max(0.8, d.opacity);
      })
      .attr('stroke-width', (d, i) => {
        // Enhanced stroke for relationship chain
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'left' && i === highlightedArcIndex) {
            return 3; // Thickest stroke for source arc
          }
          // Stroke for connected arcs when right side is highlighted
          if (highlightedSide === 'right' && highlightedArcIndex !== null) {
            const matrixValue = connectionMatrix[i] && connectionMatrix[i][highlightedArcIndex];
            if (matrixValue > 0) {
              return 2; // Medium stroke for connected arcs
            }
          }
        }
        return 1;
      })
      .attr('stroke', (d, i) => {
        // Enhanced stroke color for relationship chain
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'left' && i === highlightedArcIndex) {
            return settings.isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
          }
          // Stroke for connected arcs when right side is highlighted
          if (highlightedSide === 'right' && highlightedArcIndex !== null) {
            const matrixValue = connectionMatrix[i] && connectionMatrix[i][highlightedArcIndex];
            if (matrixValue > 0) {
              return settings.isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
            }
          }
        }
        return 'none';
      });
    // Create right arcs with event handlers first
    const rightArcSelection = g.selectAll('path.right-arc')
      .data(rightArcs)
      .enter()
      .append('path')
      .attr('class', 'right-arc')
      .attr('d', d => arcGen({ startAngle: d.startAngle, endAngle: d.endAngle } as any))
      .attr('fill', (d, i) => `url(#right-arc-gradient-${i})`)
      .attr('opacity', 0)
      .on('mouseenter', function(event, d: any) {
        if (d.value === 0) return;
        pauseAnimation('arc hover');
        
        // Trigger the same highlighting as auto-cycle animation
        const arcIndex = rightArcs.findIndex(arc => arc.name === d.name);
        console.log('🎯 Hover triggering right arc highlighting:', {
          arcName: d.name,
          arcIndex: arcIndex
        });
        
        setAnimationPhase('highlighting');
        setHighlightedArcIndex(arcIndex);
        setHighlightedSide('right');
        
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          content: (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{(d.name || 'Unknown').toString().replace(/_/g, ' ')}</div>
              <div>Count: {d.value}</div>
            </div>
          )
        });
      })
      .on('mouseleave', () => {
        resumeAnimation('arc hover end');
        setTooltip(null);
        
        // Reset highlighting when animation resumes
        setAnimationPhase('full');
        setHighlightedArcIndex(null);
        setHighlightedSide(null);
      });
    
    // Apply transition animations separately
    rightArcSelection
      .transition(transition)
      .attr('opacity', (d, i) => {
        // Apply full relationship chain highlighting
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'right') {
            // Highlight the source arc
            if (i === highlightedArcIndex) {
              return 1.0; // Source arc is fully highlighted
            }
            return 0.4; // Dim other right arcs
          } else if (highlightedSide === 'left' && highlightedArcIndex !== null) {
            // When left arc is highlighted, highlight right arcs connected to it
            const matrixValue = connectionMatrix[highlightedArcIndex] && connectionMatrix[highlightedArcIndex][i];
            const isConnectedToHighlightedLeft = matrixValue > 0;
            console.log(`🔗 Right arc ${i} (${rightArcs[i]?.name}) connected to left arc ${highlightedArcIndex} (${leftArcs[highlightedArcIndex]?.name})?`, 
              isConnectedToHighlightedLeft, 'Matrix value:', matrixValue);
            return isConnectedToHighlightedLeft ? 0.95 : 0.3; // Higher contrast
          }
        }
        // Use stable base opacity without pulsing to prevent flickering
        return Math.max(0.8, d.opacity);
      })
      .attr('stroke-width', (d, i) => {
        // Enhanced stroke for relationship chain
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'right' && i === highlightedArcIndex) {
            return 3; // Thickest stroke for source arc
          }
          // Stroke for connected arcs when left side is highlighted
          if (highlightedSide === 'left' && highlightedArcIndex !== null) {
            const matrixValue = connectionMatrix[highlightedArcIndex] && connectionMatrix[highlightedArcIndex][i];
            if (matrixValue > 0) {
              return 2; // Medium stroke for connected arcs
            }
          }
        }
        return 1;
      })
      .attr('stroke', (d, i) => {
        // Enhanced stroke color for relationship chain
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'right' && i === highlightedArcIndex) {
            return settings.isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
          }
          // Stroke for connected arcs when left side is highlighted
          if (highlightedSide === 'left' && highlightedArcIndex !== null) {
            const matrixValue = connectionMatrix[highlightedArcIndex] && connectionMatrix[highlightedArcIndex][i];
            if (matrixValue > 0) {
              return settings.isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
            }
          }
        }
        return 'none';
      });

    // Draw ribbons for connections (distributed along arc, proportional thickness)
    // Use d3.ribbon() for each connection, but set the width by using the full segment for each connection
    const ribbonRadius = Math.max(60, radius * 0.75); // Ensure minimum radius for ribbons
    const ribbonGen = d3.ribbon().radius(ribbonRadius);
    const connections = [];
    for (let i = 0; i < sourceArray.length; i++) {
      for (let j = 0; j < targetArray.length; j++) {
        const value = connectionMatrix[i][j];
        if (value > 0) {
          // Find the segment for this connection on both arcs
          const leftSeg = leftArcs[i];
          const rightSeg = rightArcs[j];
          // Compute arc midpoints for gradient direction
          const leftMidAngle = (leftSeg.startAngle + leftSeg.endAngle) / 2 - Math.PI / 2;
          const rightMidAngle = (rightSeg.startAngle + rightSeg.endAngle) / 2 - Math.PI / 2;
          const leftX = Math.cos(leftMidAngle) * ribbonRadius;
          const leftY = Math.sin(leftMidAngle) * ribbonRadius;
          const rightX = Math.cos(rightMidAngle) * ribbonRadius;
          const rightY = Math.sin(rightMidAngle) * ribbonRadius;
          // Add gradient for this ribbon
          const leftColor = leftArcs[i].color || d3.schemeCategory10[i % 10];
          const rightColor = rightArcs[j].color || d3.schemeCategory10[(j + 5) % 10];
          defs.append('linearGradient')
            .attr('id', `ribbon-gradient-${i}-${j}`)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', leftX)
            .attr('y1', leftY)
            .attr('x2', rightX)
            .attr('y2', rightY)
            .selectAll('stop')
            .data([
              { offset: '0%', color: leftColor },
              { offset: '100%', color: rightColor }
            ])
            .enter()
            .append('stop')
            .attr('offset', d => d.offset)
            .attr('stop-color', d => d.color);
          connections.push({
            source: {
              startAngle: leftSeg.startAngle,
              endAngle: leftSeg.endAngle,
              index: i
            },
            target: {
              startAngle: rightSeg.startAngle,
              endAngle: rightSeg.endAngle,
              index: j
            },
            value,
            left: leftArcs[i],
            right: rightArcs[j],
            gradientId: `ribbon-gradient-${i}-${j}`
          });
        }
      }
    }
    // Create ribbons with event handlers first
    const ribbonSelection = g.selectAll('path.ribbon')
      .data(connections)
      .enter()
      .append('path')
      .attr('class', 'ribbon')
      .attr('d', function(d) { const path = ribbonGen({ source: d.source, target: d.target } as any); return typeof path === 'string' ? path : ''; })
      .attr('fill', d => `url(#${d.gradientId})`)
      .attr('opacity', 0)
      .on('mouseenter', function(event: any, d: any) {
        pauseAnimation('ribbon hover');
        
        // Trigger highlighting for the source side of this ribbon (same as auto-cycle)
        console.log('🎯 Hover triggering ribbon highlighting:', {
          leftArcName: d.left.name,
          rightArcName: d.right.name,
          sourceIndex: d.source.index,
          targetIndex: d.target.index
        });
        
        setAnimationPhase('highlighting');
        setHighlightedArcIndex(d.source.index);
        setHighlightedSide('left');
        
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          content: (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                {(d.left.name || 'Unknown').toString().replace(/_/g, ' ')} ↔ {(d.right.name || 'Unknown').toString().replace(/_/g, ' ')}
              </div>
              <div>Connections: {d.value}</div>
            </div>
          )
        });
      })
      .on('mouseleave', function(event, d) {
        resumeAnimation('ribbon hover end');
        setTooltip(null);
        
        // Reset highlighting when animation resumes
        setAnimationPhase('full');
        setHighlightedArcIndex(null);
        setHighlightedSide(null);
      });
    
    // Apply transition animations separately
    ribbonSelection
      .transition(transition)
      .attr('opacity', d => {
        // Highlight ribbons connected to highlighted arcs with enhanced visibility
        if (animationPhase === 'highlighting') {
          if (highlightedSide === 'left' && highlightedArcIndex === d.source.index) {
            return 0.95; // Make connected ribbons very prominent
          }
          if (highlightedSide === 'right' && highlightedArcIndex === d.target.index) {
            return 0.95; // Make connected ribbons very prominent
          }
          return 0.2; // Dim non-connected ribbons more for better contrast
        }
        // Use stable base opacity without pulsing
        return settings.isDarkMode ? 0.7 : 0.6;
      })
      .attr('stroke-width', d => {
        // Enhanced stroke for highlighted ribbons to show connections clearly
        if (animationPhase === 'highlighting') {
          if ((highlightedSide === 'left' && highlightedArcIndex === d.source.index) ||
              (highlightedSide === 'right' && highlightedArcIndex === d.target.index)) {
            return 2.5; // Slightly thicker for better visibility
          }
        }
        return 0.5;
      })
      .attr('stroke', d => {
        // Enhanced stroke color for highlighted connections
        if (animationPhase === 'highlighting') {
          if ((highlightedSide === 'left' && highlightedArcIndex === d.source.index) ||
              (highlightedSide === 'right' && highlightedArcIndex === d.target.index)) {
            return settings.isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
          }
        }
        return 'none';
      });

    // --- Label placement: properly spaced around circle ---
    const labelRadius = Math.max(120, radius * 1.45); // Even more space for full text labels
    const labelGroup = svg.append('g').attr('transform', `translate(${margin.left + effectiveChartWidth / 2}, ${margin.top + effectiveChartHeight / 2})`);
    
    // Combine all arcs for unified label placement
    const allArcs = [...leftArcs.map(arc => ({...arc, side: 'left'})), ...rightArcs.map(arc => ({...arc, side: 'right'}))];
    
    // Add labels with smart positioning to avoid overlap
    labelGroup.selectAll('text.arc-label')
      .data(allArcs)
      .enter()
      .append('text')
      .attr('class', 'arc-label')
      .attr('transform', d => {
        const angle = (d.startAngle + d.endAngle) / 2 - Math.PI / 2;
        const x = labelRadius * Math.cos(angle);
        const y = labelRadius * Math.sin(angle);
        const rotation = angle * 180 / Math.PI;
        
        // Rotate text for better readability
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
          return `translate(${x}, ${y}) rotate(${rotation + 180})`;
        } else {
          return `translate(${x}, ${y}) rotate(${rotation})`;
        }
      })
      .attr('text-anchor', d => {
        const angle = (d.startAngle + d.endAngle) / 2 - Math.PI / 2;
        if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
          return 'end';
        } else {
          return 'start';
        }
      })
      .attr('alignment-baseline', 'middle')
      .style('font-family', labelFontFamily)
      .style('font-weight', labelFontWeight)
             .style('font-size', d => {
         // Dynamic font size based on number of labels - larger since we're showing full text
         const totalLabels = allArcs.length;
         if (totalLabels > 12) return '13px';
         if (totalLabels > 10) return '14px';
         if (totalLabels > 8) return '15px';
         return `${Math.max(16, labelFontSize)}px`;
       })
       .style('fill', labelColor)
       .style('text-transform', 'uppercase')
       .text(d => {
         const text = (d.name || 'Unknown').toString().replace(/_/g, ' ');
         // Show full text - no truncation
         return text;
       })
       .on('mouseenter', function(event, d) {
         pauseAnimation('label hover');
         const fullText = (d.name || 'Unknown').toString().replace(/_/g, ' ');
         setTooltip({
           x: event.pageX,
           y: event.pageY,
           content: (
             <div>
               <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{fullText}</div>
               <div>Count: {d.value}</div>
               <div>Side: {d.side}</div>
             </div>
           )
         });
       })
       .on('mouseleave', () => {
         resumeAnimation('label hover end');
         setTooltip(null);
       });

    // Update insights
    const totalConnections = connections.reduce((sum, d) => sum + d.value, 0);
    const strongestConnection = connections.length > 0 
      ? connections.reduce((max, d) => d.value > max.value ? d : max, connections[0])
      : null;
    setInsights([
      { title: 'Total Responses', value: filteredData.length.toString() },
      { title: 'Current View', value: `${currentSource} ↔ ${currentTarget}` },
      strongestConnection
        ? { 
            title: 'Strongest Connection', 
            value: `${strongestConnection.left.name || 'Unknown'} ↔ ${strongestConnection.right.name || 'Unknown'}`, 
            description: `${strongestConnection.value} connections` 
          }
        : { title: 'Strongest Connection', value: 'No connections found', description: '' },
      { title: 'Total Connections', value: totalConnections.toString() },
    ]);

  }, [data, currentSource, currentTarget, settings.useTestData, settings.categoryColors, isLoading, lastCategoryChange, isContainerTooSmall, chartWidth, chartHeight, showSecondaryChord, settings.isDarkMode]);

  // Render secondary chord when peak performance is involved
  useEffect(() => {
    if (showSecondaryChord) {
      renderSecondaryChord();
    }
  }, [showSecondaryChord, data, settings.useTestData, settings.isDarkMode, labelColor]);

  // Tooltip rendering
  const tooltipEl = tooltip ? (
    <div
      style={{
        position: 'absolute',
        left: tooltip.x + 16,
        top: tooltip.y + 16,
        background: 'rgba(20,20,30,0.98)',
        color: '#fff',
        padding: '10px 16px',
        borderRadius: 8,
        pointerEvents: 'none',
        zIndex: 100,
        fontFamily: 'Avenir Next World, sans-serif',
        fontWeight: 600,
        fontSize: 16,
        boxShadow: '0 4px 24px 0 rgba(16, 16, 235, 0.12)',
        maxWidth: 320,
      }}
      role="tooltip"
      aria-live="polite"
    >
      {tooltip.content}
    </div>
  ) : null;

  // Apply theme based on global settings
  const themeClass = settings.isDarkMode ? 'dark' : '';
  const backgroundColor = settings.isDarkMode ? '#1a1a1a' : '#ffffff';
  const textColor = settings.isDarkMode ? '#ffffff' : '#0A0A0F';

  // Handle case where container is too small
  if (isContainerTooSmall) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${themeClass}`} style={{ backgroundColor }}>
        <div className="text-center" style={{ color: textColor }}>
          <p className="text-lg mb-2">Container too small</p>
          <p className="text-sm opacity-70">Minimum size: 200x200px</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center ${themeClass}`} style={{ backgroundColor }}>
      <GlobalControlsNav />
      <div className="w-full h-full flex flex-col items-center justify-center">
        <div className="w-full flex flex-col items-center justify-center mb-4">
          <QuestionSelector
            availableFields={availableFields}
            currentSource={currentSource}
            currentTarget={currentTarget}
            onChange={(source, target) => {
              const corrected = ensureDifferentCategories(source, target);
              setCurrentSource(corrected.source);
              setCurrentTarget(corrected.target);
              setLastCategoryChange(corrected);
            }}
          />
        </div>
        <div 
          className="w-full flex justify-center items-center relative"
          style={{ height: height * 0.85 }} // Use 85% of available height for the chart to account for labels
        >
          {showSecondaryChord ? (
            // Two-chord layout when peak performance is involved
            <div className="w-full flex justify-center items-center gap-16">
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-bold mb-4" style={{ color: textColor }}>
                  Main Relationships
                </h3>
                <svg
                  ref={svgRef}
                  width={width * 0.45}
                  height={height * 0.8}
                  style={{ display: 'block', background: 'transparent', color: textColor }}
                />
              </div>
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-bold mb-4" style={{ color: textColor }}>
                  Years × Performance Types
                </h3>
                <svg
                  ref={secondarySvgRef}
                  width={width * 0.45}
                  height={height * 0.8}
                  style={{ display: 'block', background: 'transparent', color: textColor }}
                />
              </div>
            </div>
          ) : (
            // Single chord layout when peak performance is not involved
            <svg
              ref={svgRef}
              width={width}
              height={height * 0.85}
              style={{ display: 'block', margin: '0 auto', background: 'transparent', color: textColor }}
            />
          )}
          {tooltipEl}
        </div>
      </div>
    </div>
  );
} 