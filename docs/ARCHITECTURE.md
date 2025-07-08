# Architecture Documentation

## Overview

The Medtronic WE Summit Visualization Platform is built using a modern, scalable architecture that prioritizes performance, maintainability, and user experience. This document provides a comprehensive overview of the system architecture, design patterns, and technical decisions.

## High-Level Architecture

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Application                        │
├─────────────────────────────────────────────────────────────────┤
│  App Router (src/app/)                                          │
│  ├── Pages & Layouts                                            │
│  ├── API Routes                                                 │
│  └── Middleware                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Components Layer (src/components/)                             │
│  ├── DataVisualization/ (D3.js + React)                        │
│  ├── Form Components (Survey System)                           │
│  ├── Admin Components (Management UI)                          │
│  └── UI Components (Reusable Elements)                         │
├─────────────────────────────────────────────────────────────────┤
│  State Management (src/lib/)                                   │
│  ├── React Context (Global State)                              │
│  ├── SWR (Data Fetching & Caching)                            │
│  ├── Zustand Stores (Local State)                             │
│  └── Custom Hooks (Business Logic)                            │
├─────────────────────────────────────────────────────────────────┤
│  Utilities & Services (src/lib/)                               │
│  ├── Supabase Client                                          │
│  ├── Data Processing                                           │
│  ├── Visualization Utilities                                   │
│  └── Helper Functions                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Backend                           │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL Database                                            │
│  ├── Survey Responses Table                                     │
│  ├── Attendees Table                                           │
│  ├── Moderation Table                                          │
│  └── Analytics Views                                           │
├─────────────────────────────────────────────────────────────────┤
│  Authentication & Authorization                                 │
│  ├── Row Level Security (RLS)                                  │
│  ├── JWT Token Management                                      │
│  └── Role-Based Access Control                                 │
├─────────────────────────────────────────────────────────────────┤
│  Real-time Features                                            │
│  ├── WebSocket Connections                                     │
│  ├── Live Data Synchronization                                 │
│  └── Event Broadcasting                                        │
├─────────────────────────────────────────────────────────────────┤
│  Storage & CDN                                                 │
│  ├── File Storage Buckets                                      │
│  ├── Image Optimization                                        │
│  └── Static Asset Delivery                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Design Patterns

### 1. Component Architecture

#### Compound Components Pattern
Used for complex UI components like surveys and visualizations:

```typescript
// Example: Survey Form
<SurveyForm>
  <SurveyForm.Step id="personal">
    <SurveyForm.Field name="name" />
    <SurveyForm.Field name="email" />
  </SurveyForm.Step>
  <SurveyForm.Step id="preferences">
    <SurveyForm.Field name="learning_style" />
  </SurveyForm.Step>
</SurveyForm>
```

#### Render Props Pattern
For flexible data visualization components:

```typescript
<DataVisualization
  data={surveyData}
  render={({ processedData, insights }) => (
    <AlluvialDiagram data={processedData} insights={insights} />
  )}
/>
```

#### Higher-Order Components (HOC)
For cross-cutting concerns like authentication and error handling:

```typescript
export default withAuth(withErrorBoundary(AdminPanel));
```

### 2. State Management Patterns

#### Context + Reducer Pattern
For global application state:

```typescript
// AppContext.tsx
const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}
```

#### SWR for Data Fetching
Provides caching, revalidation, and error handling:

```typescript
export function useVisualizationData() {
  const { data, error, isLoading } = useSWR(
    '/api/visualization/data',
    fetcher,
    {
      refreshInterval: 30000, // 30 seconds
      revalidateOnFocus: true,
      errorRetryCount: 3
    }
  );
  
  return { data, error, isLoading };
}
```

### 3. Data Flow Architecture

#### Unidirectional Data Flow
```
User Action → Component → Hook → API Call → Database
     ↓
State Update → Re-render → UI Update
```

#### Real-time Data Synchronization
```
Database Change → Supabase Realtime → WebSocket → Client Update → UI Refresh
```

## Component Structure

### Visualization Components

#### AlluvialDiagram.tsx
- **Purpose**: Sankey flow diagrams for showing relationships between categories
- **Key Features**:
  - Dynamic node sizing based on data
  - Animated transitions between states
  - Interactive filtering and highlighting
  - Responsive design with ResizeObserver

#### ChordDiagram.tsx
- **Purpose**: Circular relationship mapping
- **Key Features**:
  - D3.js chord layout implementation
  - Error boundary for graceful degradation
  - TypeScript interfaces for type safety

#### Constellation/
- **Purpose**: 3D spatial data visualization
- **Key Features**:
  - Three.js integration
  - Interactive camera controls
  - WebGL rendering optimization

### Shared Utilities

#### colorUtils.ts
- **Purpose**: Centralized color management
- **Features**:
  - Theme-aware color generation
  - Consistent brand color application
  - Accessibility-compliant color contrast

#### useVisualizationData.ts
- **Purpose**: Data fetching and processing
- **Features**:
  - SWR integration for caching
  - Data transformation pipelines
  - Error handling and retry logic

## Database Schema

### Core Tables

#### survey_responses
```sql
CREATE TABLE survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id UUID REFERENCES attendees(id),
  years_at_medtronic INTEGER,
  learning_style TEXT,
  motivation TEXT,
  peak_performance TEXT,
  shaped_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  test_data BOOLEAN DEFAULT FALSE
);
```

#### attendees
```sql
CREATE TABLE attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT,
  department TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Security Policies

#### Row Level Security (RLS)
```sql
-- Allow users to read their own responses
CREATE POLICY "Users can read own responses" ON survey_responses
  FOR SELECT USING (attendee_id = auth.uid());

-- Allow admins to read all responses
CREATE POLICY "Admins can read all responses" ON survey_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM attendees 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );
```

## Performance Optimizations

### Frontend Optimizations

#### Code Splitting
```typescript
// Dynamic imports for large components
const AlluvialDiagram = dynamic(() => import('./AlluvialDiagram'), {
  loading: () => <LoadingSpinner />,
  ssr: false
});
```

#### Memoization
```typescript
// Expensive calculations memoized
const processedData = useMemo(() => {
  return processVisualizationData(rawData, filters);
}, [rawData, filters]);
```

#### Virtual Scrolling
```typescript
// For large datasets in admin panel
<VirtualizedList
  height={600}
  itemCount={responses.length}
  itemSize={80}
  renderItem={({ index, style }) => (
    <ResponseItem key={index} style={style} data={responses[index]} />
  )}
/>
```

### Backend Optimizations

#### Database Indexing
```sql
-- Indexes for common queries
CREATE INDEX idx_survey_responses_attendee_id ON survey_responses(attendee_id);
CREATE INDEX idx_survey_responses_created_at ON survey_responses(created_at);
CREATE INDEX idx_survey_responses_learning_style ON survey_responses(learning_style);
```

#### Query Optimization
```sql
-- Materialized views for analytics
CREATE MATERIALIZED VIEW survey_analytics AS
SELECT 
  learning_style,
  COUNT(*) as response_count,
  AVG(years_at_medtronic) as avg_years
FROM survey_responses
WHERE test_data = FALSE
GROUP BY learning_style;
```

## Security Architecture

### Authentication Flow
```
1. User Login → Supabase Auth → JWT Token
2. Token Validation → RLS Policies → Data Access
3. Session Management → Automatic Refresh → Secure Storage
```

### Data Protection
- **Encryption**: All data encrypted at rest and in transit
- **Input Validation**: Comprehensive validation on both client and server
- **SQL Injection Prevention**: Parameterized queries and ORM usage
- **XSS Protection**: Content Security Policy and input sanitization

## Deployment Architecture

### Docker Configuration
```dockerfile
# Multi-stage build for optimization
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Proxmox VM Setup
```bash
# VM specifications
CPU: 4 cores
RAM: 8GB
Storage: 100GB SSD
Network: VLAN segmented
OS: Debian 11 (Bullseye)
```

### Load Balancing & High Availability
```nginx
# Nginx configuration
upstream app_servers {
  server app1:3000;
  server app2:3000;
  server app3:3000;
}

server {
  listen 80;
  location / {
    proxy_pass http://app_servers;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## Monitoring & Observability

### Metrics Collection
- **Application Metrics**: Response times, error rates, throughput
- **Infrastructure Metrics**: CPU, memory, disk usage
- **Business Metrics**: Survey completion rates, user engagement

### Logging Strategy
```typescript
// Structured logging
import { logger } from '@/lib/logger';

logger.info('Survey submitted', {
  attendeeId: user.id,
  surveyType: 'we-summit',
  completionTime: Date.now() - startTime,
  userAgent: req.headers['user-agent']
});
```

### Error Tracking
```typescript
// Error boundary with reporting
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to monitoring service
    Sentry.captureException(error, {
      contexts: {
        react: errorInfo
      }
    });
  }
}
```

## Future Architecture Considerations

### Scalability Improvements
- **Microservices**: Split into smaller, focused services
- **Event-Driven Architecture**: Implement event sourcing for better scalability
- **CDN Integration**: Global content delivery for improved performance

### Technology Upgrades
- **React 18**: Concurrent features and Suspense
- **Next.js 15**: Enhanced App Router and performance improvements
- **WebAssembly**: For computationally intensive visualizations

### DevOps Enhancements
- **Kubernetes**: Container orchestration for better scaling
- **CI/CD Pipeline**: Automated testing and deployment
- **Infrastructure as Code**: Terraform for reproducible deployments

## Conclusion

This architecture provides a solid foundation for the Medtronic WE Summit Visualization Platform, balancing performance, maintainability, and scalability. The modular design allows for easy extension and modification while maintaining code quality and user experience standards. 