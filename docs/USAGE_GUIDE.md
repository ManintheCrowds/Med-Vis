# Usage Guide

## Table of Contents
- [For End Users](#for-end-users)
- [For Administrators](#for-administrators)
- [For Developers](#for-developers)
- [Common Workflows](#common-workflows)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## For End Users

### Taking the Survey

#### Step 1: Access the Survey
1. Navigate to the survey URL provided by your organization
2. Click "Start Survey" on the welcome page
3. The survey consists of multiple steps - you can navigate back and forth

#### Step 2: Complete Personal Information
- **Name**: Enter your full name
- **Email**: Use your Medtronic email address
- **Department**: Select your department from the dropdown
- **Years at Medtronic**: Enter the number of years you've been with the company

#### Step 3: Answer Preference Questions
- **Learning Style**: Choose how you prefer to learn new information
  - Visual: Charts, diagrams, images
  - Auditory: Listening, discussions, verbal instructions
  - Kinesthetic: Hands-on, movement, practice
  - Reading/Writing: Text-based materials, note-taking

- **Peak Performance Time**: When do you feel most productive?
  - Morning (6 AM - 12 PM)
  - Afternoon (12 PM - 6 PM)
  - Evening (6 PM - 12 AM)
  - Night (12 AM - 6 AM)

- **Motivation**: What drives you most at work?
  - Career Growth
  - Skill Development
  - Networking
  - Recognition

- **Shaped By**: What has most influenced your professional development?
  - Mentorship
  - Experience
  - Education
  - Collaboration

#### Step 4: Review and Submit
1. Review your answers on the summary page
2. Make any necessary changes by clicking "Edit" next to each section
3. Click "Submit Survey" to complete the process
4. You'll receive a confirmation message and can view the live visualizations

### Viewing Visualizations

#### Alluvial (Sankey) Diagrams
- **Purpose**: Shows flow relationships between categories
- **How to Read**: 
  - Left side shows source categories (e.g., Years at Medtronic)
  - Right side shows target categories (e.g., Learning Style)
  - Flowing lines show connections between categories
  - Thicker lines indicate more responses

- **Interactive Features**:
  - Hover over nodes to highlight connected flows
  - Use dropdown menus to change source and target categories
  - Animation automatically cycles through different highlights

#### Chord Diagrams
- **Purpose**: Shows circular relationships between all categories
- **How to Read**:
  - Categories are arranged around a circle
  - Curved lines connect related categories
  - Thicker curves indicate stronger relationships

#### Constellation Views
- **Purpose**: 3D spatial representation of data relationships
- **How to Interact**:
  - Click and drag to rotate the view
  - Scroll to zoom in/out
  - Click on nodes to see details

### Customization Options

#### Theme Selection
- Toggle between light and dark themes using the theme switcher
- Dark theme is recommended for presentations
- Light theme is better for detailed analysis

#### Animation Controls
- Pause/play automatic animations
- Adjust animation speed
- Skip to specific categories

## For Administrators

### Accessing the Admin Panel

#### Login Process
1. Navigate to `/admin` on the platform
2. Use your administrator credentials
3. You'll see the admin dashboard with key metrics

### Managing Survey Responses

#### Viewing All Responses
1. Go to "Survey Responses" in the admin panel
2. Use filters to find specific responses:
   - Date range
   - Department
   - Learning style
   - Years at Medtronic
3. Sort by any column by clicking the header

#### Moderating Content
1. Click on any response to view details
2. If content needs moderation:
   - Click "Flag Response"
   - Select reason (inappropriate content, spam, etc.)
   - Add notes for your team
   - Click "Submit Moderation"

#### Bulk Operations
- Select multiple responses using checkboxes
- Use "Bulk Actions" dropdown for:
  - Export selected
  - Delete selected (use carefully)
  - Flag selected

### Data Export

#### CSV Export
1. Go to "Data Export" section
2. Select date range
3. Choose fields to include
4. Select "CSV" format
5. Click "Export Data"
6. File will download automatically

#### Advanced Export Options
- **JSON Format**: For developers and data analysis
- **Excel Format**: For business users and presentations
- **Filtered Export**: Export only specific segments
- **Scheduled Exports**: Set up automatic daily/weekly exports

### User Management

#### Adding New Users
1. Go to "User Management"
2. Click "Add New User"
3. Fill in user details:
   - Name and email
   - Department
   - Role (User or Admin)
4. User will receive an invitation email

#### Managing Permissions
- **User Role**: Can take surveys and view visualizations
- **Admin Role**: Full access to admin panel and data management
- **Department Admin**: Can manage users within their department

### Analytics Dashboard

#### Key Metrics
- **Response Rate**: Percentage of invited users who completed the survey
- **Completion Time**: Average time to complete the survey
- **Drop-off Points**: Where users tend to abandon the survey
- **Popular Combinations**: Most common response patterns

#### Real-time Monitoring
- Live response counter
- Recent activity feed
- Error rate monitoring
- Performance metrics

## For Developers

### Setting Up Development Environment

#### Prerequisites Installation
```bash
# Install Node.js (18.x or later)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

#### Database Setup
```bash
# Initialize Supabase
npx supabase init
npx supabase start

# Run migrations
npx supabase db push

# Generate types
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

### Creating Custom Visualizations

#### Basic Structure
```typescript
// src/components/DataVisualization/MyCustomVisualization.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useVisualizationData } from './shared/useVisualizationData';

interface MyCustomVisualizationProps {
  width?: number;
  height?: number;
  data?: any[];
}

export default function MyCustomVisualization({
  width = 800,
  height = 600,
  data
}: MyCustomVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { data: vizData, isLoading } = useVisualizationData();

  useEffect(() => {
    if (!svgRef.current || !vizData) return;

    // D3.js visualization code here
    const svg = d3.select(svgRef.current);
    
    // Clear previous content
    svg.selectAll('*').remove();
    
    // Your visualization logic
    
  }, [vizData, width, height]);

  if (isLoading) return <div>Loading...</div>;

  return <svg ref={svgRef} width={width} height={height} />;
}
```

#### Adding to Visualization Router
```typescript
// src/app/visualization/my-custom/page.tsx
import MyCustomVisualization from '@/components/DataVisualization/MyCustomVisualization';

export default function MyCustomPage() {
  return (
    <div className="container mx-auto p-4">
      <h1>My Custom Visualization</h1>
      <MyCustomVisualization />
    </div>
  );
}
```

### API Integration

#### Fetching Data
```typescript
// Custom hook for specific data needs
import useSWR from 'swr';

export function useCustomData(filters: any) {
  const { data, error, isLoading } = useSWR(
    `/api/custom-endpoint?${new URLSearchParams(filters)}`,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true
    }
  );

  return { data, error, isLoading };
}
```

#### Creating API Endpoints
```typescript
// src/app/api/custom-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const filter = searchParams.get('filter');
    
    // Query database
    const { data, error } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('some_field', filter);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
```

### Testing

#### Unit Tests
```typescript
// __tests__/components/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import MyComponent from '@/components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

#### Integration Tests
```typescript
// __tests__/api/survey.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '@/app/api/survey/route';

describe('/api/survey', () => {
  it('creates a survey response', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        attendeeId: 'test-id',
        learning_style: 'visual'
      }
    });

    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(201);
  });
});
```

### Deployment

#### Docker Deployment
```bash
# Build image
docker build -t medtronic-we-summit .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your-url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  medtronic-we-summit
```

#### Production Environment
```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2 for process management
pm2 start ecosystem.config.js
```

## Common Workflows

### Survey Campaign Management

#### Planning Phase
1. **Define Objectives**: What insights do you want to gain?
2. **Design Questions**: Keep it concise but comprehensive
3. **Set Timeline**: Plan launch, reminder, and closure dates
4. **Prepare Communications**: Email templates, announcements

#### Launch Phase
1. **Test Survey**: Complete a test run with a small group
2. **Send Invitations**: Use your organization's communication channels
3. **Monitor Progress**: Check response rates daily
4. **Send Reminders**: Follow up with non-respondents

#### Analysis Phase
1. **Review Data Quality**: Check for incomplete or suspicious responses
2. **Generate Insights**: Use the visualization tools to find patterns
3. **Create Reports**: Export data and create presentation materials
4. **Share Results**: Distribute findings to stakeholders

### Data Analysis Workflow

#### Exploratory Analysis
1. Start with the Alluvial diagram to see overall patterns
2. Use different source/target combinations to explore relationships
3. Look for unexpected patterns or outliers
4. Note interesting findings for deeper investigation

#### Detailed Analysis
1. Export raw data for statistical analysis
2. Use filters to segment the data by department, years, etc.
3. Compare different time periods if you have historical data
4. Create custom visualizations for specific insights

#### Reporting
1. Capture screenshots of key visualizations
2. Export summary statistics
3. Create narrative around the findings
4. Include actionable recommendations

### Troubleshooting Common Issues

#### Survey Issues

**Problem**: Users can't access the survey
**Solutions**:
- Check if the survey is still active
- Verify the URL is correct
- Ensure users are using supported browsers
- Check if there are any network restrictions

**Problem**: Survey responses aren't saving
**Solutions**:
- Check internet connection
- Try refreshing the page and resubmitting
- Contact administrator if the issue persists
- Check browser console for error messages

**Problem**: Visualization not loading
**Solutions**:
- Ensure there's sufficient data (at least 10 responses)
- Check if test data is enabled/disabled as needed
- Try a different browser
- Clear browser cache and cookies

#### Admin Issues

**Problem**: Can't export data
**Solutions**:
- Check if you have admin permissions
- Verify the date range includes responses
- Try a smaller dataset first
- Check browser's download settings

**Problem**: Users not receiving invitations
**Solutions**:
- Verify email addresses are correct
- Check spam/junk folders
- Ensure email service is configured properly
- Try sending a test email

#### Technical Issues

**Problem**: Performance is slow
**Solutions**:
- Check if there's too much data being processed
- Try filtering to smaller datasets
- Clear browser cache
- Check network connection
- Contact technical support

**Problem**: Visualizations look incorrect
**Solutions**:
- Verify data quality in the admin panel
- Check if filters are applied correctly
- Try refreshing the page
- Compare with exported data to verify accuracy

## Best Practices

### For Survey Design
1. **Keep it Short**: Aim for 5-10 minutes completion time
2. **Clear Instructions**: Provide context for each question
3. **Logical Flow**: Group related questions together
4. **Test First**: Always test with a small group before full launch
5. **Mobile-Friendly**: Ensure the survey works on all devices

### For Data Analysis
1. **Start Broad**: Begin with high-level visualizations
2. **Drill Down**: Use filters to explore specific segments
3. **Cross-Reference**: Compare multiple data views
4. **Document Insights**: Keep notes of interesting findings
5. **Validate Results**: Cross-check unexpected patterns

### For Administration
1. **Regular Monitoring**: Check response rates and data quality daily
2. **Backup Data**: Export data regularly for backup
3. **User Support**: Provide clear instructions and support contacts
4. **Security**: Regularly review user permissions and access
5. **Updates**: Keep the platform updated with latest features

### For Development
1. **Code Documentation**: Comment your code thoroughly
2. **Testing**: Write tests for new features
3. **Performance**: Monitor and optimize for large datasets
4. **Security**: Follow security best practices
5. **Accessibility**: Ensure features work for all users

### For Data Privacy
1. **Consent**: Ensure users understand how their data will be used
2. **Anonymization**: Remove personally identifiable information when possible
3. **Access Control**: Limit data access to authorized personnel only
4. **Retention**: Follow data retention policies
5. **Compliance**: Adhere to relevant privacy regulations (GDPR, etc.)

## Support and Resources

### Getting Help
- **Technical Issues**: Contact IT support
- **Survey Questions**: Reach out to the survey administrators
- **Feature Requests**: Submit through the feedback form
- **Training**: Request training sessions for your team

### Additional Resources
- **Video Tutorials**: Available in the help section
- **User Manual**: Downloadable PDF guide
- **FAQ**: Common questions and answers
- **Release Notes**: Updates and new features
- **Community Forum**: Connect with other users

### Contact Information
- **Technical Support**: tech-support@medtronic.com
- **Survey Administration**: survey-admin@medtronic.com
- **Training Requests**: training@medtronic.com
- **General Questions**: we-summit@medtronic.com

## Peak Performance Analysis

The system tracks peak performance patterns based on personality type and time of day:

### Peak Performance Categories
- **Extrovert, Morning**: Extroverts who perform best in morning hours
- **Extrovert, Evening**: Extroverts who perform best in evening hours  
- **Introvert, Morning**: Introverts who perform best in morning hours
- **Introvert, Night**: Introverts who perform best at night
- **Ambivert, Morning**: Ambiverts who perform best in morning hours
- **Ambivert, Night**: Ambiverts who perform best at night

### Color Configuration
All visualization colors are managed through the admin panel at `/admin/controls`. Admins can:
- Customize colors for each category
- Set different colors for light and dark themes
- Update colors in real-time without code changes
- Ensure consistency across all visualizations

### Visualization Features
- **Chord Diagram**: Shows relationships between peak performance and other factors
- **Alluvial Diagram**: Displays flow patterns across different categories
- **Interactive Controls**: Filter and explore data relationships
- **Real-time Updates**: Colors update immediately when changed in admin panel 