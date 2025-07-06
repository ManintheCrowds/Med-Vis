# Animation System Debug Guide

## 🎯 **Problem**: Animation not working in visualizations

## 📁 **Files That Control Animation**

### **Core Animation Control Files**
1. **`src/lib/context/AppContext.tsx`** - Global animation settings
   - `isAutoPlayEnabled: boolean` - Master switch for all animations
   - `autoPlaySpeed: number` - Speed in milliseconds (default: 5000ms)
   - `toggleAutoPlay()` - Function to toggle animation on/off

2. **`src/components/DataVisualization/index.tsx`** - Main visualization component
   - Passes `settings.isAutoPlayEnabled` to child components
   - Contains debug info panel in development mode

3. **`src/components/DataVisualization/AlluvialDiagram.tsx`** - Alluvial animation logic
   - Complex animation system with source highlighting
   - Uses `useEffect` with multiple dependencies
   - Has visibility/focus handlers that can interrupt animation

4. **`src/components/DataVisualization/ChordDiagram.tsx`** - Chord animation logic
   - Simpler interval-based animation
   - Cycles through different relationship modes

### **Animation Utility Files**
5. **`src/components/DataVisualization/shared/animationUtils.ts`** - Animation constants
6. **`src/components/DataVisualization/shared/chordUtils.ts`** - Chord-specific animations
7. **`src/components/DataVisualization/shared/d3Utils.ts`** - D3 animation helpers

### **Control Interface Files**
8. **`src/app/admin/controls/page.tsx`** - Admin controls for animation
9. **`src/components/DataVisualization/shared/EnhancedVisualizationHeader.tsx`** - Play/pause button

### **Data Loading**
10. **`src/components/DataVisualization/shared/useVisualizationData.ts`** - Data loading hook
    - Animation won't start without data
    - Falls back to mock data if real data fails

## 🔍 **Debug Steps**

### **Step 1: Check Browser Console**
Open browser dev tools and look for these debug messages:

**DataVisualization Component:**
```
🎨 DataVisualization component settings: { isAutoPlayEnabled: true, autoPlaySpeed: 5000, ... }
```

**Data Loading:**
```
📊 useVisualizationData hook state: { dataLength: 3, isLoading: false, ... }
✅ Loaded real data: { totalResponses: 3, validResponses: 3, ... }
```

**AlluvialDiagram Animation:**
```
🎬 Animation useEffect triggered with conditions: { autoPlay: true, isAutoPlayEnabled: true, ... }
✅ Starting animation with settings: { autoPlaySpeed: 5000, sortedSources: [...], ... }
🚀 Animation initialized, calling animate()
🎭 Animate function called: { running: true, dataLength: 3, ... }
🎯 Animation highlighting source: { currentSourceIndex: 0, sourceName: "0-5", ... }
```

**ChordDiagram Animation:**
```
🎵 ChordDiagram animation useEffect: { autoPlay: true, isAutoPlayEnabled: true, ... }
✅ ChordDiagram starting animation cycle
🔄 ChordDiagram cycling to: { from: "years_at_medtronic → learning_style", to: "..." }
```

### **Step 2: Common Issues & Solutions**

#### **Issue 1: Animation Settings Not Enabled**
**Symptoms:** `❌ Animation disabled: autoPlay= false isAutoPlayEnabled= false`
**Solution:** Go to `/admin/controls` and enable "Auto Play Animations"

#### **Issue 2: No Data Available**
**Symptoms:** `❌ No data available for animation, data.length= 0`
**Solution:** Check data loading. Should see mock data fallback if real data fails.

#### **Issue 3: Page Visibility Issues**
**Symptoms:** `🚫 Page hidden, cleaning up animation` or `🚫 Page lost focus, cleaning up animation`
**Solution:** Keep browser tab active and focused during testing

#### **Issue 4: SVG Not Ready**
**Symptoms:** `❌ SVG ref not available`
**Solution:** Component may be mounting before SVG is ready. Check render order.

#### **Issue 5: Animation Paused**
**Symptoms:** `❌ Animation paused: isAnimating= false`
**Solution:** Check if mouse hover or other interactions paused animation

### **Step 3: Manual Testing**

1. **Go to Admin Controls**: `/admin/controls`
   - Verify "Auto Play Animations" is ON
   - Check animation speed (1000-10000ms)
   - Use "Go to Visualization" button

2. **Check Visualization Page**: `/visualization`
   - Look for debug panel in top-left (development mode)
   - Check browser console for debug messages
   - Try toggling play/pause button in header

3. **Test Both Visualization Types**:
   - Alluvial diagram (default)
   - Chord diagram (switch in header)

### **Step 4: Force Animation Start**

If animation still doesn't work, try these in browser console:

```javascript
// Check current settings
console.log('Settings:', window.appSettings);

// Force animation restart (if component is available)
window.restartAnimation?.();

// Check if data is loaded
console.log('Data loaded:', window.visualizationData?.length);
```

## 🐛 **Known Issues**

1. **Animation stops when browser tab loses focus** - This is intentional for performance
2. **Animation doesn't start immediately** - There's a delay for data loading
3. **Mouse hover pauses animation** - This is intentional for user interaction
4. **Animation speed changes require page refresh** - Settings update but timers don't restart

## 🔧 **Quick Fixes**

### **Fix 1: Reset Animation Settings**
```javascript
// In browser console
localStorage.clear();
location.reload();
```

### **Fix 2: Force Enable Animation**
```javascript
// In browser console (if useAppContext is available)
const { toggleAutoPlay } = useAppContext();
toggleAutoPlay();
```

### **Fix 3: Check Data Loading**
```javascript
// In browser console
fetch('/api/survey').then(r => r.json()).then(console.log);
```

## 📊 **Debug Panel**

In development mode, a debug panel appears in the top-left corner showing:
- AutoPlay: ON/OFF
- Speed: 5000ms
- Type: alluvial/chord
- Size: 1728x972

## 🎮 **Animation Controls**

- **Header Play/Pause Button**: Toggles animation on/off
- **Admin Controls**: Global settings for all animations
- **Mouse Hover**: Temporarily pauses animation
- **Page Focus**: Animation stops when page loses focus

## 📝 **Notes**

- Animation requires data to be loaded (real or mock)
- AlluvialDiagram has more complex animation than ChordDiagram
- Visibility/focus handlers can interrupt animation
- Animation speed is configurable from 1-10 seconds
- Debug messages only appear in development mode 