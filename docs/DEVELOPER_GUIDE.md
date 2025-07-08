# Developer Guide

## Table of Contents
- [Getting Started](#getting-started)
- [Code Organization](#code-organization)
- [Development Workflow](#development-workflow)
- [Component Development](#component-development)
- [State Management](#state-management)
- [Data Visualization](#data-visualization)
- [Testing](#testing)
- [Performance Guidelines](#performance-guidelines)
- [Security Best Practices](#security-best-practices)
- [Deployment](#deployment)

## Getting Started

### Development Environment Setup

1. **Prerequisites**
   ```bash
   # Check Node.js version (required: 18.x or later)
   node --version
   
   # Check npm version
   npm --version
   
   # Install global dependencies
   npm install -g @supabase/cli
   ```

2. **Project Setup**
   ```bash
   # Clone and install
   git clone <repository-url>
   cd medtronic-we-summit
   npm install
   
   # Copy environment template
   cp .env.example .env.local
   
   # Start development server
   npm run dev
   ```

3. **Development Tools**
   - **VS Code Extensions**: ESLint, Prettier, TypeScript, Tailwind CSS IntelliSense
   - **Browser Extensions**: React DevTools, Redux DevTools
   - **Database Tools**: Supabase Studio, pgAdmin

### Environment Configuration

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
DEBUG=true
```

## Code Organization

### File Structure Conventions

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Route groups
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── form/             # Form-specific components
│   ├── DataVisualization/ # Visualization components
│   └── admin/            # Admin-specific components
├── lib/                  # Utilities and configurations
│   ├── hooks/            # Custom React hooks
│   ├── context/          # React Context providers
│   ├── utils/            # Helper functions
│   └── types/            # TypeScript definitions
└── styles/               # CSS and styling
```

### Naming Conventions

```typescript
// Components: PascalCase
export default function SurveyForm() {}

// Files: camelCase or kebab-case
// survey-form.tsx or surveyForm.tsx

// Constants: SCREAMING_SNAKE_CASE
const API_ENDPOINTS = {
  SURVEY: '/api/survey',
  VISUALIZATION: '/api/visualization'
};

// Functions: camelCase
function processVisualizationData() {}

// Types/Interfaces: PascalCase
interface SurveyResponse {
  id: string;
  attendeeId: string;
}
```

## Development Workflow

### Git Workflow

1. **Branch Naming**
   ```bash
   # Feature branches
   git checkout -b feature/add-chord-diagram
   
   # Bug fixes
   git checkout -b fix/survey-validation-error
   
   # Documentation
   git checkout -b docs/update-readme
   ```

2. **Commit Messages**
   ```bash
   # Use conventional commits
   git commit -m "feat: add chord diagram visualization"
   git commit -m "fix: resolve survey validation error"
   git commit -m "docs: update README with new features"
   ```

3. **Pull Request Process**
   - Create feature branch from `main`
   - Make changes with tests
   - Run linting and type checking
   - Create PR with clear description
   - Request code review
   - Merge after approval

### Code Quality Tools

```bash
# Linting
npm run lint
npm run lint:fix

# Type checking
npm run type-check

# Formatting
npm run format

# Pre-commit hooks
npx husky add .husky/pre-commit "npm run lint && npm run type-check"
```

## Component Development

### Component Template

```typescript
/**
 * SurveyForm - Multi-step survey component
 * 
 * @param onSubmit - Callback function when form is submitted
 * @param initialData - Initial form data for editing
 * @param disabled - Whether the form is disabled
 */

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { surveySchema } from '@/lib/validation/survey';

interface SurveyFormProps {
  onSubmit: (data: SurveyData) => Promise<void>;
  initialData?: Partial<SurveyData>;
  disabled?: boolean;
}

export default function SurveyForm({ 
  onSubmit, 
  initialData, 
  disabled = false 
}: SurveyFormProps) {
  // State management
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form handling
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue
  } = useForm<SurveyData>({
    resolver: zodResolver(surveySchema),
    defaultValues: initialData,
    mode: 'onChange'
  });

  // Event handlers
  const handleFormSubmit = useCallback(async (data: SurveyData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Survey submission failed:', error);
      // Handle error (show toast, etc.)
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit]);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS - 1));
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  // Render
  return (
    <div className="survey-form">
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        {/* Form content */}
      </form>
    </div>
  );
}

// Export types for consumers
export type { SurveyFormProps };
```

### Custom Hooks Pattern

```typescript
/**
 * useVisualizationData - Hook for fetching and processing visualization data
 * 
 * @param filters - Data filters to apply
 * @returns Object containing data, loading state, and error
 */

import { useMemo } from 'react';
import useSWR from 'swr';
import { processVisualizationData } from '@/lib/visualization/processData';

interface UseVisualizationDataOptions {
  source?: string;
  target?: string;
  includeTestData?: boolean;
}

export function useVisualizationData(options: UseVisualizationDataOptions = {}) {
  const { source, target, includeTestData = false } = options;
  
  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    if (target) params.set('target', target);
    if (includeTestData) params.set('includeTestData', 'true');
    return params.toString();
  }, [source, target, includeTestData]);

  // Fetch data with SWR
  const { data: rawData, error, isLoading } = useSWR(
    `/api/visualization/data?${queryParams}`,
    {
      refreshInterval: 30000, // 30 seconds
      revalidateOnFocus: true,
      errorRetryCount: 3,
      onError: (error) => {
        console.error('Visualization data fetch failed:', error);
      }
    }
  );

  // Process data
  const processedData = useMemo(() => {
    if (!rawData) return null;
    return processVisualizationData(rawData, { source, target });
  }, [rawData, source, target]);

  return {
    data: processedData,
    rawData,
    isLoading,
    error,
    refetch: () => mutate(`/api/visualization/data?${queryParams}`)
  };
}
```

## State Management

### Context Pattern

```typescript
/**
 * AppContext - Global application state management
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// State interface
interface AppState {
  user: User | null;
  settings: AppSettings;
  surveyData: SurveyData | null;
  isLoading: boolean;
}

// Action types
type AppAction = 
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_SURVEY_DATA'; payload: SurveyData }
  | { type: 'SET_LOADING'; payload: boolean };

// Initial state
const initialState: AppState = {
  user: null,
  settings: {
    isDarkMode: false,
    autoPlaySpeed: 3000,
    isAutoPlayEnabled: true,
    useTestData: false,
    categoryColors: {}
  },
  surveyData: null,
  isLoading: false
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'UPDATE_SETTINGS':
      return { 
        ...state, 
        settings: { ...state.settings, ...action.payload } 
      };
    
    case 'SET_SURVEY_DATA':
      return { ...state, surveyData: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    default:
      return state;
  }
}

// Context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Helper functions
  setUser: (user: User | null) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  getCurrentThemeColors: () => ThemeColors;
} | undefined>(undefined);

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Helper functions
  const setUser = (user: User | null) => {
    dispatch({ type: 'SET_USER', payload: user });
  };

  const updateSettings = (settings: Partial<AppSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  };

  const getCurrentThemeColors = (): ThemeColors => {
    return state.settings.isDarkMode ? darkThemeColors : lightThemeColors;
  };

  const value = {
    state,
    dispatch,
    setUser,
    updateSettings,
    getCurrentThemeColors
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// Hook for consuming context
export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
```

## Data Visualization

### D3.js Integration Pattern

```typescript
/**
 * AlluvialDiagram - Sankey flow diagram component
 * 
 * Key patterns:
 * - useEffect for D3 DOM manipulation
 * - useRef for SVG element access
 * - useMemo for expensive calculations
 * - Custom hooks for data processing
 */

import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

interface AlluvialDiagramProps {
  width?: number;
  height?: number;
  data: VisualizationData[];
  onNodeClick?: (node: SankeyNode) => void;
}

export default function AlluvialDiagram({
  width = 800,
  height = 600,
  data,
  onNodeClick
}: AlluvialDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Process data for Sankey layout
  const { nodes, links } = useMemo(() => {
    return processDataForSankey(data);
  }, [data]);

  // D3 rendering effect
  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    // Set up dimensions and margins
    const margin = { top: 20, right: 100, bottom: 20, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create main group
    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create Sankey layout
    const sankeyGenerator = sankey<SankeyNode, SankeyLink>()
      .nodeId(d => d.id)
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    // Generate layout
    const sankeyData = sankeyGenerator({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d }))
    });

    // Render links
    g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(sankeyData.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', d => getNodeColor(d.source))
      .attr('stroke-width', d => Math.max(1, d.width))
      .attr('fill', 'none')
      .attr('opacity', 0.6)
      .on('mouseover', handleLinkHover)
      .on('mouseout', handleLinkOut);

    // Render nodes
    g.append('g')
      .attr('class', 'nodes')
      .selectAll('rect')
      .data(sankeyData.nodes)
      .join('rect')
      .attr('x', d => d.x0!)
      .attr('y', d => d.y0!)
      .attr('height', d => d.y1! - d.y0!)
      .attr('width', d => d.x1! - d.x0!)
      .attr('fill', getNodeColor)
      .attr('stroke', '#000')
      .on('click', (event, d) => onNodeClick?.(d))
      .on('mouseover', handleNodeHover)
      .on('mouseout', handleNodeOut);

    // Add labels
    g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(sankeyData.nodes)
      .join('text')
      .attr('x', d => d.x0! < innerWidth / 2 ? d.x1! + 6 : d.x0! - 6)
      .attr('y', d => (d.y1! + d.y0!) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => d.x0! < innerWidth / 2 ? 'start' : 'end')
      .text(d => d.name)
      .style('font-family', 'Avenir Next World, sans-serif')
      .style('font-size', '14px');

    // Event handlers
    function handleLinkHover(event: any, d: any) {
      d3.select(event.currentTarget).attr('opacity', 0.8);
    }

    function handleLinkOut(event: any) {
      d3.select(event.currentTarget).attr('opacity', 0.6);
    }

    function handleNodeHover(event: any, d: any) {
      // Highlight connected links
      g.selectAll('path')
        .attr('opacity', link => 
          link.source === d || link.target === d ? 0.8 : 0.2
        );
    }

    function handleNodeOut() {
      g.selectAll('path').attr('opacity', 0.6);
    }

  }, [nodes, links, width, height, onNodeClick]);

  return (
    <div className="alluvial-diagram">
      <svg ref={svgRef} />
    </div>
  );
}

// Helper function for data processing
function processDataForSankey(data: VisualizationData[]) {
  // Implementation details...
  return { nodes: [], links: [] };
}

// Helper function for node colors
function getNodeColor(node: SankeyNode): string {
  // Implementation details...
  return '#4F46E5';
}
```

### Responsive Design Pattern

```typescript
/**
 * useResponsiveVisualization - Hook for responsive D3 visualizations
 */

import { useEffect, useRef, useState } from 'react';

export function useResponsiveVisualization() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return { containerRef, dimensions };
}

// Usage in component
export default function ResponsiveChart() {
  const { containerRef, dimensions } = useResponsiveVisualization();

  return (
    <div ref={containerRef} className="w-full h-full">
      {dimensions.width > 0 && (
        <SomeVisualization 
          width={dimensions.width} 
          height={dimensions.height} 
        />
      )}
    </div>
  );
}
```

## Testing

### Unit Testing with Jest

```typescript
// __tests__/components/SurveyForm.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SurveyForm } from '@/components/form/SurveyForm';

// Mock dependencies
jest.mock('@/lib/hooks/useSurveyForm', () => ({
  useSurveyForm: () => ({
    currentStep: 0,
    nextStep: jest.fn(),
    prevStep: jest.fn(),
    submitForm: jest.fn()
  })
}));

describe('SurveyForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the first step by default', () => {
    render(<SurveyForm onSubmit={mockOnSubmit} />);
    
    expect(screen.getByText('Personal Information')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<SurveyForm onSubmit={mockOnSubmit} />);
    
    const submitButton = screen.getByRole('button', { name: /next/i });
    await user.click(submitButton);
    
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    render(<SurveyForm onSubmit={mockOnSubmit} />);
    
    // Fill out form
    await user.type(screen.getByLabelText('Name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    
    // Submit
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com'
      });
    });
  });
});
```

### Integration Testing

```typescript
// __tests__/integration/survey-flow.test.tsx

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '@/lib/context/AppContext';
import { SurveyPage } from '@/app/survey/page';

// Test wrapper with providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      {children}
    </AppProvider>
  );
}

describe('Survey Flow Integration', () => {
  it('completes full survey flow', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <SurveyPage />
      </TestWrapper>
    );

    // Step 1: Personal Info
    await user.type(screen.getByLabelText('Name'), 'Test User');
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 2: Preferences
    await user.selectOptions(screen.getByLabelText('Learning Style'), 'visual');
    await user.click(screen.getByRole('button', { name: /next/i }));

    // Step 3: Submit
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Verify success
    expect(screen.getByText('Thank you for your response!')).toBeInTheDocument();
  });
});
```

### E2E Testing with Playwright

```typescript
// e2e/survey.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Survey Application', () => {
  test('user can complete survey', async ({ page }) => {
    await page.goto('/survey');

    // Fill personal information
    await page.fill('[data-testid="name-input"]', 'Test User');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.click('[data-testid="next-button"]');

    // Select preferences
    await page.selectOption('[data-testid="learning-style"]', 'visual');
    await page.click('[data-testid="next-button"]');

    // Submit survey
    await page.click('[data-testid="submit-button"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('visualization loads after survey completion', async ({ page }) => {
    // Complete survey first
    await page.goto('/survey');
    // ... survey completion steps ...

    // Navigate to visualization
    await page.goto('/visualization');

    // Check that visualization renders
    await expect(page.locator('[data-testid="alluvial-diagram"]')).toBeVisible();
    await expect(page.locator('svg')).toBeVisible();
  });
});
```

## Performance Guidelines

### Code Splitting

```typescript
// Dynamic imports for large components
import dynamic from 'next/dynamic';

const AlluvialDiagram = dynamic(
  () => import('@/components/DataVisualization/AlluvialDiagram'),
  {
    loading: () => <div>Loading visualization...</div>,
    ssr: false // Disable SSR for D3 components
  }
);

const AdminPanel = dynamic(
  () => import('@/components/admin/AdminPanel'),
  {
    loading: () => <div>Loading admin panel...</div>
  }
);
```

### Memoization Best Practices

```typescript
// Memoize expensive calculations
const processedData = useMemo(() => {
  return heavyDataProcessing(rawData, filters);
}, [rawData, filters]);

// Memoize callback functions
const handleNodeClick = useCallback((node: SankeyNode) => {
  onNodeSelect?.(node);
  setSelectedNode(node);
}, [onNodeSelect]);

// Memoize components with React.memo
const ExpensiveComponent = React.memo(function ExpensiveComponent({ 
  data, 
  onUpdate 
}: Props) {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison function
  return prevProps.data === nextProps.data;
});
```

### Bundle Optimization

```javascript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
    swcMinify: true
  },
  webpack: (config, { isServer }) => {
    // Optimize bundle size
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false
      };
    }
    
    return config;
  }
};
```

## Security Best Practices

### Input Validation

```typescript
// Use Zod for runtime validation
import { z } from 'zod';

const surveySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email format'),
  yearsAtMedtronic: z.number().min(0).max(50),
  learningStyle: z.enum(['visual', 'auditory', 'kinesthetic'])
});

// API route validation
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = surveySchema.parse(body);
    
    // Process validated data
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    throw error;
  }
}
```

### XSS Prevention

```typescript
// Sanitize user input
import DOMPurify from 'dompurify';

function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: []
  });
}

// Safe HTML rendering
function SafeHTML({ content }: { content: string }) {
  const sanitizedContent = sanitizeInput(content);
  
  return (
    <div 
      dangerouslySetInnerHTML={{ 
        __html: sanitizedContent 
      }} 
    />
  );
}
```

### Authentication & Authorization

```typescript
// Middleware for API route protection
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res: response });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Check admin role
    const { data: profile } = await supabase
      .from('attendees')
      .select('role')
      .eq('id', session.user.id)
      .single();
      
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}
```

## Deployment

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Environment-Specific Configurations

```typescript
// lib/config.ts
interface Config {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  app: {
    url: string;
    environment: 'development' | 'staging' | 'production';
  };
  features: {
    enableAnalytics: boolean;
    enableTestData: boolean;
  };
}

export const config: Config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL!,
    environment: (process.env.NODE_ENV as any) || 'development',
  },
  features: {
    enableAnalytics: process.env.NODE_ENV === 'production',
    enableTestData: process.env.NODE_ENV === 'development',
  },
};
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to production
        run: |
          # Deploy script here
          echo "Deploying to production..."
```

This developer guide provides a comprehensive foundation for working with the Medtronic WE Summit visualization platform. Follow these patterns and practices to maintain code quality and consistency across the project. 