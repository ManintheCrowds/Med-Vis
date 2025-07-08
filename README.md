# Medtronic WE Summit Interactive Visualization Platform

[![Next.js](https://img.shields.io/badge/Next.js-14.0.4-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square&logo=supabase)](https://supabase.com/)
[![D3.js](https://img.shields.io/badge/D3.js-7.8-orange?style=flat-square&logo=d3.js)](https://d3js.org/)

A sophisticated real-time data visualization platform for the Medtronic WE Summit, featuring interactive surveys, dynamic data visualizations, and comprehensive analytics. Built with modern web technologies and designed for scalability and performance.

## 🌟 Features

### Core Functionality
- **📊 Interactive Data Visualizations**
  - Alluvial (Sankey) diagrams for flow analysis
  - Chord diagrams for relationship mapping
  - Constellation views for spatial data exploration
  - Real-time animation and filtering capabilities

- **📝 Multi-Step Survey System**
  - Dynamic form validation with Pydantic-style schemas
  - Progressive disclosure for better UX
  - Real-time data collection and storage
  - Mobile-responsive design

- **🔧 Admin Dashboard**
  - Response moderation and filtering
  - Data export functionality (CSV, JSON)
  - Real-time analytics and insights
  - User management and controls

- **🎨 Advanced UI/UX**
  - Dark/Light theme support
  - Responsive design for all devices
  - Accessibility compliance (WCAG 2.1)
  - Smooth animations and transitions

### Technical Features
- **⚡ Performance Optimized**
  - Server-side rendering (SSR) with Next.js
  - Efficient data caching with Redis
  - Optimized D3.js rendering
  - Lazy loading and code splitting

- **🔒 Security & Reliability**
  - Row-level security (RLS) with Supabase
  - Input validation and sanitization
  - Error boundaries and graceful degradation
  - Comprehensive logging and monitoring

- **🚀 Scalable Architecture**
  - Modular component structure
  - Clean separation of concerns
  - Type-safe development with TypeScript
  - Automated testing and CI/CD ready

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14 + TypeScript | React framework with App Router |
| **Styling** | Tailwind CSS + Custom CSS | Utility-first styling with brand consistency |
| **Database** | Supabase (PostgreSQL) | Real-time database with authentication |
| **Visualization** | D3.js + Three.js | Advanced data visualization and 3D graphics |
| **State Management** | React Context + SWR | Global state and data fetching |
| **Deployment** | Docker + Proxmox VM | Containerized deployment on VM infrastructure |

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Frontend (Next.js)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Survey    │ │Visualization│ │    Admin    │ │   Layout    ││
│  │ Components  │ │ Components  │ │ Components  │ │ Components  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    State Management Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Context   │ │     SWR     │ │   Stores    │ │    Hooks    ││
│  │  Providers  │ │   Caching   │ │  (Zustand)  │ │ (Custom)    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                       API Layer                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Supabase  │ │   REST API  │ │  Real-time  │ │    Auth     ││
│  │   Client    │ │ Endpoints   │ │ Subscriptions│ │ Middleware  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Backend                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ PostgreSQL  │ │   Auth      │ │  Real-time  │ │   Storage   ││
│  │  Database   │ │  Service    │ │  Engine     │ │   Bucket    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed:
- **Node.js** 18.x or later
- **npm** or **yarn**
- **Git**
- **Docker** (optional, for containerized deployment)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd medtronic-we-summit
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment setup:**
   Create a `.env.local` file in the root directory:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # Application Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NODE_ENV=development
   
   # Optional: Redis for caching
   REDIS_URL=redis://localhost:6379
   
   # Optional: Monitoring
   GRAFANA_URL=http://localhost:3000
   PROMETHEUS_URL=http://localhost:9090
   ```

4. **Database setup:**
   ```bash
   # Initialize Supabase locally (optional)
   npx supabase init
   npx supabase start
   
   # Or use hosted Supabase and run migrations
   npx supabase db push
   ```

5. **Start development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
medtronic-we-summit/
├── 📁 src/
│   ├── 📁 app/                    # Next.js App Router pages
│   │   ├── 📁 admin/              # Admin dashboard pages
│   │   ├── 📁 api/                # API route handlers
│   │   ├── 📁 survey/             # Survey form pages
│   │   ├── 📁 visualization/      # Data visualization pages
│   │   ├── layout.tsx             # Root layout component
│   │   └── page.tsx               # Home page
│   ├── 📁 components/             # Reusable React components
│   │   ├── 📁 admin/              # Admin-specific components
│   │   ├── 📁 DataVisualization/  # Visualization components
│   │   │   ├── AlluvialDiagram.tsx    # Sankey flow diagrams
│   │   │   ├── ChordDiagram.tsx       # Relationship chord diagrams
│   │   │   ├── Constellation/         # 3D constellation views
│   │   │   └── 📁 shared/             # Shared visualization utilities
│   │   ├── 📁 form/               # Survey form components
│   │   ├── 📁 Layout/             # Layout components
│   │   └── 📁 ui/                 # Base UI components
│   ├── 📁 lib/                    # Utility functions and configurations
│   │   ├── 📁 context/            # React Context providers
│   │   ├── 📁 hooks/              # Custom React hooks
│   │   ├── 📁 supabase/           # Supabase client and utilities
│   │   ├── 📁 utils/              # Helper functions
│   │   └── 📁 visualization/      # Data processing utilities
│   ├── 📁 styles/                 # Global styles and themes
│   ├── 📁 types/                  # TypeScript type definitions
│   └── 📁 data/                   # Mock data and generators
├── 📁 public/                     # Static assets
│   └── 📁 branding/               # Medtronic brand assets
├── 📁 supabase/                   # Database schema and migrations
│   └── 📁 migrations/             # SQL migration files
├── 📁 docs/                       # Additional documentation
├── 🐳 Dockerfile                  # Docker configuration
├── 📦 package.json                # Node.js dependencies
├── 🔧 next.config.js              # Next.js configuration
├── 🎨 tailwind.config.js          # Tailwind CSS configuration
└── 📋 tsconfig.json               # TypeScript configuration
```

## 🎯 Usage Guide

### For End Users

#### Taking a Survey
1. Navigate to `/survey`
2. Complete the multi-step form
3. Submit your responses
4. View your contribution in real-time visualizations

#### Exploring Visualizations
1. Go to `/visualization`
2. Choose from available visualization types:
   - **Alluvial Diagrams**: Flow relationships between categories
   - **Chord Diagrams**: Circular relationship mapping
   - **Constellation Views**: 3D spatial data exploration
3. Use interactive controls to filter and explore data

### For Administrators

#### Accessing Admin Panel
1. Navigate to `/admin`
2. Authenticate with admin credentials
3. Access moderation and analytics tools

#### Managing Responses
- **View**: Browse all survey responses
- **Moderate**: Flag or approve responses
- **Export**: Download data in CSV/JSON format
- **Analytics**: View real-time insights and trends

### For Developers

#### Adding New Visualizations
1. Create a new component in `src/components/DataVisualization/`
2. Follow the existing pattern:
   ```typescript
   interface YourVisualizationProps {
     width?: number;
     height?: number;
     data?: any[];
   }
   
   export default function YourVisualization({ width, height, data }: YourVisualizationProps) {
     // Implementation
   }
   ```
3. Add to the visualization index file
4. Update routing in `src/app/visualization/`

#### Customizing Themes
1. Edit `src/styles/brand.css` for brand colors
2. Update `tailwind.config.js` for utility classes
3. Modify theme context in `src/lib/context/AppContext.tsx`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes | - |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes | - |
| `NEXT_PUBLIC_APP_URL` | Application base URL | Yes | http://localhost:3000 |
| `NODE_ENV` | Environment mode | No | development |
| `REDIS_URL` | Redis connection string | No | - |

### Customization Options

#### Visualization Settings
```typescript
// src/lib/context/AppContext.tsx
interface VisualizationSettings {
  autoPlaySpeed: number;        // Animation speed (ms)
  isAutoPlayEnabled: boolean;   // Enable/disable auto-play
  isDarkMode: boolean;          // Theme preference
  useTestData: boolean;         // Show test data
  categoryColors: Record<string, string>; // Custom color mapping
}
```

#### Survey Configuration
```typescript
// src/types/survey.ts
interface SurveyStep {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  validation?: ValidationSchema;
}
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### Test Structure
```
tests/
├── unit/                 # Unit tests
├── integration/          # Integration tests
├── e2e/                  # End-to-end tests
└── __mocks__/           # Mock data and utilities
```

## 🚀 Deployment

### Docker Deployment (Recommended)

1. **Build the Docker image:**
   ```bash
   docker build -t medtronic-we-summit .
   ```

2. **Run the container:**
   ```bash
   docker run -p 3000:3000 \
     -e NEXT_PUBLIC_SUPABASE_URL=your-url \
     -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
     medtronic-we-summit
   ```

### Proxmox VM Deployment

1. **Prepare the VM:**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install Docker
   sudo apt-get install -y docker.io docker-compose
   ```

2. **Deploy with Docker Compose:**
   ```yaml
   # docker-compose.yml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
         - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
       restart: unless-stopped
   ```

3. **Set up HTTPS with Let's Encrypt:**
   ```bash
   # Install Certbot
   sudo apt install certbot python3-certbot-nginx
   
   # Obtain SSL certificate
   sudo certbot --nginx -d your-domain.com
   ```

### Vercel Deployment

1. **Connect your repository to Vercel**
2. **Configure environment variables**
3. **Deploy automatically on push**

## 📊 Monitoring & Analytics

### Grafana Dashboard
- **Metrics**: Response rates, user engagement, performance
- **Alerts**: Error rates, response times
- **Visualizations**: Real-time charts and graphs

### Prometheus Metrics
- Application performance metrics
- Database query performance
- User interaction tracking

### Logging
- Structured logging with Winston
- Error tracking with Sentry
- Performance monitoring with Web Vitals

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Run tests:**
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```
5. **Commit with conventional commits:**
   ```bash
   git commit -m "feat: add new visualization component"
   ```
6. **Push and create a pull request**

### Code Style

- **ESLint**: Enforced code quality rules
- **Prettier**: Consistent code formatting
- **TypeScript**: Strict type checking
- **Conventional Commits**: Standardized commit messages

### Pull Request Guidelines

- Include a clear description of changes
- Add tests for new functionality
- Update documentation as needed
- Ensure all CI checks pass

## 📚 API Reference

### Survey API

#### Submit Survey Response
```typescript
POST /api/survey
Content-Type: application/json

{
  "attendeeId": "string",
  "responses": {
    "years_at_medtronic": number,
    "learning_style": "string",
    "motivation": "string",
    // ... other fields
  }
}
```

#### Get Survey Responses
```typescript
GET /api/survey?limit=50&offset=0
Authorization: Bearer <token>

Response: {
  "data": SurveyResponse[],
  "count": number,
  "hasMore": boolean
}
```

### Visualization API

#### Get Processed Data
```typescript
GET /api/visualization/data?type=alluvial&source=years_at_medtronic&target=learning_style

Response: {
  "nodes": Node[],
  "links": Link[],
  "insights": Insight[]
}
```

## 🔍 Troubleshooting

### Common Issues

#### "Cannot access 'margin' before initialization"
**Solution**: Ensure margin calculations are moved before usage in component lifecycle.

#### "Module parse failed: Identifier 'React' has already been declared"
**Solution**: Remove duplicate React imports in component files.

#### "Cannot read properties of undefined (reading 'map')"
**Solution**: Add proper null checks and default values for props.

### Debug Mode

Enable debug logging:
```typescript
// Add to .env.local
DEBUG=true
NEXT_PUBLIC_DEBUG=true
```

### Performance Issues

1. **Check bundle size:**
   ```bash
   npm run analyze
   ```

2. **Monitor memory usage:**
   ```bash
   npm run dev -- --inspect
   ```

3. **Profile React components:**
   Use React DevTools Profiler

## 📄 License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited. 

**© 2024 Medtronic. All rights reserved.**

## 🙏 Acknowledgments

- **Medtronic WE Summit Team** - Project vision and requirements
- **D3.js Community** - Visualization techniques and examples
- **Next.js Team** - Framework and best practices
- **Supabase Team** - Backend-as-a-Service platform

---

## 📞 Support

For technical support or questions:
- **Email**: [technical-support@medtronic.com](mailto:technical-support@medtronic.com)
- **Internal Wiki**: [confluence.medtronic.com/we-summit](https://confluence.medtronic.com/we-summit)
- **Slack**: #we-summit-tech

---

**Built with ❤️ for the Medtronic WE Summit** 

## Features

- **Interactive Data Visualizations**: Chord diagrams, alluvial diagrams, and constellation views
- **Admin-Driven Color Configuration**: Centralized color management through `/admin/controls`
- **Peak Performance Analysis**: Track personality types and optimal performance times
- **Real-time Data Updates**: Live data synchronization with Supabase
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Theme Support**: Automatic theme switching with custom colors
- **Export Capabilities**: Download visualizations as images or data
- **Survey Management**: Complete survey response tracking and analysis 