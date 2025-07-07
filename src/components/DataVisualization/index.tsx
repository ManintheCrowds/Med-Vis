'use client';
import React, { useState, useEffect, useRef } from 'react';
import AlluvialDiagram from './AlluvialDiagram';
import ChordDiagram from './ChordDiagram';
import { EnhancedVisualizationHeader } from './shared/EnhancedVisualizationHeader';
import { useAppContext } from '@/lib/context/AppContext';

type VisualizationType = 'alluvial' | 'chord';

export function DataVisualization() {
  const { settings, toggleAutoPlay } = useAppContext();
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('alluvial');
  const [containerSize, setContainerSize] = useState({ width: 1920, height: 1080 });

  // Only log when settings change
  const prevAutoPlay = useRef(settings.isAutoPlayEnabled);
  useEffect(() => {
    if (prevAutoPlay.current !== settings.isAutoPlayEnabled) {
      console.log('🎨 Animation setting changed:', {
        isAutoPlayEnabled: settings.isAutoPlayEnabled,
        autoPlaySpeed: settings.autoPlaySpeed,
        visualizationType
      });
      prevAutoPlay.current = settings.isAutoPlayEnabled;
    }
  }, [settings.isAutoPlayEnabled, settings.autoPlaySpeed, visualizationType]);

  // Calculate container size based on viewport
  useEffect(() => {
    const updateSize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Calculate 16:9 aspect ratio
      const aspectRatio = 16 / 9;
      
      let width, height;
      
      if (viewportWidth / viewportHeight > aspectRatio) {
        // Viewport is wider than 16:9, fit to height
        height = viewportHeight;
        width = height * aspectRatio;
      } else {
        // Viewport is taller than 16:9, fit to width
        width = viewportWidth;
        height = width / aspectRatio;
      }
      
      setContainerSize({ width, height });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Calculate visualization size (subtract header height and add bottom padding)
  const headerHeight = 80; // further reduced header height
  const bottomPadding = 24; // reduced bottom padding
  const visualizationHeight = (containerSize.height - headerHeight - bottomPadding) * 0.8; // Scale down to 80%
  const visualizationWidth = containerSize.width * 0.9; // Scale down to 90%

  return (
    <div 
      className="absolute top-0 left-0 w-screen h-screen flex flex-col bg-white overflow-hidden"
      style={{
        aspectRatio: '16/9',
        background: settings.isDarkMode ? '#0A0A0F' : 'white',
      }}
    >
      {/* Enhanced Header - Full Width at Top */}
      <EnhancedVisualizationHeader
        visualizationType={visualizationType}
        onVisualizationTypeChange={setVisualizationType}
        isAutoPlay={settings.isAutoPlayEnabled}
        onAutoPlayToggle={toggleAutoPlay}
      />

      {/* Visualization Content - Scales to fill remaining space */}
      <div 
        className="flex-1 w-full h-full flex flex-col pb-4"
        style={{ minHeight: 0 }}
      >
        {visualizationType === 'alluvial' ? (
          <AlluvialDiagram 
            width={visualizationWidth}
            height={visualizationHeight}
            autoPlay={settings.isAutoPlayEnabled}
          />
        ) : (
          <ChordDiagram 
            width={visualizationWidth}
            height={visualizationHeight}
            autoPlay={settings.isAutoPlayEnabled}
            enableRotation={true}
          />
        )}

        {/* Debug info - Disabled for production */}
        {false && (
          <div className="absolute top-20 left-4 bg-black/80 text-white p-2 rounded text-xs z-50">
            <div>AutoPlay: {settings.isAutoPlayEnabled ? 'ON' : 'OFF'}</div>
            <div>Speed: {settings.autoPlaySpeed}ms</div>
            <div>Type: {visualizationType}</div>
            <div>Size: {Math.round(visualizationWidth)}x{Math.round(visualizationHeight)}</div>
          </div>
        )}
      </div>
    </div>
  );
} 