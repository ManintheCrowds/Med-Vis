# API Documentation

## Overview

The Medtronic WE Summit Visualization Platform provides a RESTful API for managing survey data, user authentication, and data visualization. All API endpoints follow REST conventions and return JSON responses.

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

The API uses Supabase authentication with JWT tokens. Include the token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific error details"
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Internal Server Error |

## Endpoints

### Survey Management

#### Submit Survey Response

Create a new survey response.

```http
POST /api/survey
```

**Request Body:**

```json
{
  "attendeeId": "uuid",
  "years_at_medtronic": 5,
  "learning_style": "visual",
  "motivation": "impact",
  "peak_performance": "Extrovert, Morning",
  "shaped_by": "mentor",
  "test_data": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "attendeeId": "uuid",
    "years_at_medtronic": 5,
    "learning_style": "visual",
    "motivation": "impact",
    "peak_performance": "Extrovert, Morning",
    "shaped_by": "mentor",
    "test_data": false,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Validation Rules:**

- `attendeeId`: Required UUID
- `years_at_medtronic`: Integer between 0 and 50
- `learning_style`: One of ["visual", "auditory", "kinesthetic", "reading_writing"]
- `motivation`: One of ["impact", "growth", "recognition", "autonomy", "purpose"]
- `peak_performance`: One of ["Extrovert, Morning", "Extrovert, Evening", "Introvert, Morning", "Introvert, Night", "Ambivert, Morning", "Ambivert, Night"]
- `shaped_by`: One of ["mentor", "challenge", "failure", "success", "team", "other"]

#### Get Survey Responses

Retrieve survey responses with pagination and filtering.

```http
GET /api/survey
```

**Query Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | integer | Number of responses to return | 50 |
| `offset` | integer | Number of responses to skip | 0 |
| `includeTestData` | boolean | Include test data in results | false |
| `learningStyle` | string | Filter by learning style | - |
| `yearsRange` | string | Filter by years range (e.g., "0-5") | - |
| `sortBy` | string | Sort field | "created_at" |
| `sortOrder` | string | Sort direction ("asc" or "desc") | "desc" |

**Example Request:**

```http
GET /api/survey?limit=25&offset=0&learningStyle=visual&sortBy=created_at&sortOrder=desc
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "attendeeId": "uuid",
      "years_at_medtronic": 5,
      "learning_style": "visual",
      "motivation": "impact",
      "peak_performance": "Extrovert, Morning",
      "shaped_by": "mentor",
      "test_data": false,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "attendee": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john.doe@medtronic.com",
        "department": "Engineering",
        "role": "user"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 25,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Get Survey Response by ID

Retrieve a specific survey response.

```http
GET /api/survey/{id}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "attendeeId": "uuid",
    "years_at_medtronic": 5,
    "learning_style": "visual",
    "motivation": "impact",
    "peak_performance": "Extrovert, Morning",
    "shaped_by": "mentor",
    "test_data": false,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "attendee": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john.doe@medtronic.com",
      "department": "Engineering",
      "role": "user"
    }
  }
}
```

#### Update Survey Response

Update an existing survey response (admin only).

```http
PUT /api/survey/{id}
```

**Request Body:**

```json
{
  "years_at_medtronic": 6,
  "learning_style": "auditory",
  "motivation": "growth"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "attendeeId": "uuid",
    "years_at_medtronic": 6,
    "learning_style": "auditory",
    "motivation": "growth",
    "peak_performance": "Extrovert, Morning",
    "shaped_by": "mentor",
    "test_data": false,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:45:00Z"
  }
}
```

#### Delete Survey Response

Delete a survey response (admin only).

```http
DELETE /api/survey/{id}
```

**Response:**

```json
{
  "success": true,
  "message": "Survey response deleted successfully"
}
```

### Visualization Data

#### Get Visualization Data

Retrieve processed data for visualizations.

```http
GET /api/visualization/data
```

**Query Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `type` | string | Visualization type ("alluvial", "chord", "constellation") | "alluvial" |
| `source` | string | Source category field | "years_at_medtronic" |
| `target` | string | Target category field | "learning_style" |
| `includeTestData` | boolean | Include test data | false |
| `aggregation` | string | Aggregation method ("count", "average") | "count" |

**Example Request:**

```http
GET /api/visualization/data?type=alluvial&source=years_at_medtronic&target=learning_style&includeTestData=false
```

**Response:**

```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "years_at_medtronic:0-5",
        "name": "0-5",
        "category": "years_at_medtronic",
        "value": 45,
        "color": "#4F46E5"
      },
      {
        "id": "learning_style:visual",
        "name": "visual",
        "category": "learning_style",
        "value": 32,
        "color": "#10B981"
      }
    ],
    "links": [
      {
        "source": "years_at_medtronic:0-5",
        "target": "learning_style:visual",
        "value": 15,
        "percentage": 33.3
      }
    ],
    "insights": [
      {
        "title": "Most Common Flow",
        "value": "0-5 years → Visual Learning",
        "description": "15 respondents (33.3%)"
      },
      {
        "title": "Total Responses",
        "value": 150,
        "description": "Survey responses analyzed"
      }
    ],
    "metadata": {
      "totalResponses": 150,
      "sourceCategories": 5,
      "targetCategories": 4,
      "generatedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

#### Get Analytics Summary

Retrieve high-level analytics data.

```http
GET /api/visualization/analytics
```

**Query Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `period` | string | Time period ("day", "week", "month", "all") | "all" |
| `includeTestData` | boolean | Include test data | false |

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalResponses": 150,
      "uniqueAttendees": 145,
      "completionRate": 96.7,
      "averageCompletionTime": 180
    },
    "distributions": {
      "years_at_medtronic": {
        "0-5": 45,
        "6-10": 38,
        "11-15": 32,
        "16-20": 25,
        "20+": 10
      },
      "learning_style": {
        "visual": 65,
        "auditory": 40,
        "kinesthetic": 30,
        "reading_writing": 15
      }
    },
    "trends": {
      "daily": [
        {
          "date": "2024-01-15",
          "responses": 25
        }
      ]
    },
    "insights": [
      {
        "type": "trend",
        "title": "Peak Response Time",
        "description": "Most responses submitted between 10 AM - 2 PM"
      }
    ]
  }
}
```

### User Management

#### Get Current User

Retrieve current authenticated user information.

```http
GET /api/user/me
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "john.doe@medtronic.com",
    "name": "John Doe",
    "department": "Engineering",
    "role": "user",
    "created_at": "2024-01-01T00:00:00Z",
    "last_login": "2024-01-15T10:30:00Z",
    "preferences": {
      "theme": "dark",
      "notifications": true
    }
  }
}
```

#### Update User Profile

Update user profile information.

```http
PUT /api/user/me
```

**Request Body:**

```json
{
  "name": "John Smith",
  "department": "Product Management",
  "preferences": {
    "theme": "light",
    "notifications": false
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "john.doe@medtronic.com",
    "name": "John Smith",
    "department": "Product Management",
    "role": "user",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T11:45:00Z",
    "preferences": {
      "theme": "light",
      "notifications": false
    }
  }
}
```

### Admin Endpoints

#### Get All Users (Admin Only)

Retrieve all users with pagination.

```http
GET /api/admin/users
```

**Query Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `limit` | integer | Number of users to return | 50 |
| `offset` | integer | Number of users to skip | 0 |
| `role` | string | Filter by role | - |
| `department` | string | Filter by department | - |
| `search` | string | Search by name or email | - |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "john.doe@medtronic.com",
      "name": "John Doe",
      "department": "Engineering",
      "role": "user",
      "created_at": "2024-01-01T00:00:00Z",
      "last_login": "2024-01-15T10:30:00Z",
      "response_count": 1
    }
  ],
  "pagination": {
    "total": 200,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Moderate Survey Response (Admin Only)

Flag or approve a survey response.

```http
POST /api/admin/moderate/{responseId}
```

**Request Body:**

```json
{
  "action": "flag",
  "reason": "inappropriate_content",
  "notes": "Contains inappropriate language"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "response_id": "uuid",
    "action": "flag",
    "reason": "inappropriate_content",
    "notes": "Contains inappropriate language",
    "moderated_by": "uuid",
    "moderated_at": "2024-01-15T11:45:00Z"
  }
}
```

#### Export Data (Admin Only)

Export survey data in various formats.

```http
GET /api/admin/export
```

**Query Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `format` | string | Export format ("csv", "json", "xlsx") | "csv" |
| `includeTestData` | boolean | Include test data | false |
| `dateFrom` | string | Start date (ISO 8601) | - |
| `dateTo` | string | End date (ISO 8601) | - |
| `fields` | string | Comma-separated field list | "all" |

**Example Request:**

```http
GET /api/admin/export?format=csv&includeTestData=false&dateFrom=2024-01-01&dateTo=2024-01-31
```

**Response:**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="survey_responses_2024-01-15.csv"

id,attendee_name,years_at_medtronic,learning_style,motivation,created_at
uuid,John Doe,5,visual,impact,2024-01-15T10:30:00Z
```

### Test Data Management

#### Generate Test Data (Development Only)

Generate mock survey responses for testing.

```http
POST /api/test-data/generate
```

**Request Body:**

```json
{
  "count": 100,
  "seed": 12345,
  "distributions": {
    "years_at_medtronic": {
      "0-5": 0.4,
      "6-10": 0.3,
      "11-15": 0.2,
      "16-20": 0.08,
      "20+": 0.02
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "generated": 100,
    "seed": 12345,
    "message": "Test data generated successfully"
  }
}
```

#### Clear Test Data (Development Only)

Remove all test data from the database.

```http
DELETE /api/test-data/clear
```

**Response:**

```json
{
  "success": true,
  "data": {
    "deleted": 100,
    "message": "Test data cleared successfully"
  }
}
```

## Data Models

### SurveyResponse

```typescript
interface SurveyResponse {
  id: string;
  attendeeId: string;
  years_at_medtronic: number;
  learning_style: 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing';
  motivation: 'impact' | 'growth' | 'recognition' | 'autonomy' | 'purpose';
  peak_performance: 'Extrovert, Morning' | 'Extrovert, Evening' | 'Introvert, Morning' | 'Introvert, Night' | 'Ambivert, Morning' | 'Ambivert, Night';
  shaped_by: 'mentor' | 'challenge' | 'failure' | 'success' | 'team' | 'other';
  test_data: boolean;
  created_at: string;
  updated_at: string;
  attendee?: Attendee;
}
```

### Attendee

```typescript
interface Attendee {
  id: string;
  email: string;
  name: string;
  department: string;
  role: 'user' | 'admin';
  created_at: string;
  last_login?: string;
  preferences?: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}
```

### VisualizationNode

```typescript
interface VisualizationNode {
  id: string;
  name: string;
  category: string;
  value: number;
  color: string;
  percentage?: number;
}
```

### VisualizationLink

```typescript
interface VisualizationLink {
  source: string;
  target: string;
  value: number;
  percentage: number;
}
```

### Insight

```typescript
interface Insight {
  title: string;
  value: string | number;
  description?: string;
  type?: 'metric' | 'trend' | 'comparison';
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Survey submission**: 5 requests per minute per user
- **Data retrieval**: 100 requests per minute per user
- **Admin operations**: 50 requests per minute per admin

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

## Webhooks

The API supports webhooks for real-time notifications:

### Survey Response Created

Triggered when a new survey response is submitted.

```json
{
  "event": "survey.response.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": "uuid",
    "attendeeId": "uuid",
    "learning_style": "visual"
  }
}
```

### Response Moderated

Triggered when a response is moderated by an admin.

```json
{
  "event": "survey.response.moderated",
  "timestamp": "2024-01-15T11:45:00Z",
  "data": {
    "responseId": "uuid",
    "action": "flag",
    "moderatedBy": "uuid"
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { MedtronicAPI } from '@medtronic/we-summit-sdk';

const api = new MedtronicAPI({
  baseURL: 'https://api.medtronic-we-summit.com',
  apiKey: 'your-api-key'
});

// Submit survey response
const response = await api.survey.submit({
  attendeeId: 'uuid',
  years_at_medtronic: 5,
  learning_style: 'visual',
  motivation: 'impact'
});

// Get visualization data
const vizData = await api.visualization.getData({
  type: 'alluvial',
  source: 'years_at_medtronic',
  target: 'learning_style'
});
```

### Python

```python
from medtronic_we_summit import MedtronicAPI

api = MedtronicAPI(
    base_url='https://api.medtronic-we-summit.com',
    api_key='your-api-key'
)

# Submit survey response
response = api.survey.submit({
    'attendeeId': 'uuid',
    'years_at_medtronic': 5,
    'learning_style': 'visual',
    'motivation': 'impact'
})

# Get visualization data
viz_data = api.visualization.get_data(
    type='alluvial',
    source='years_at_medtronic',
    target='learning_style'
)
```

## Error Handling

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `VALIDATION_ERROR` | Request validation failed | Check request format and required fields |
| `UNAUTHORIZED` | Authentication failed | Verify API key or JWT token |
| `FORBIDDEN` | Insufficient permissions | Check user role and permissions |
| `NOT_FOUND` | Resource not found | Verify resource ID exists |
| `RATE_LIMITED` | Too many requests | Wait before retrying |
| `SERVER_ERROR` | Internal server error | Contact support |

### Error Response Example

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "years_at_medtronic": "Must be between 0 and 50",
    "learning_style": "Must be one of: visual, auditory, kinesthetic, reading_writing"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456"
}
```

## Changelog

### v2.0.0 (2024-01-15)
- Added comprehensive visualization data endpoints
- Implemented admin moderation features
- Added export functionality
- Enhanced error handling and validation

### v1.1.0 (2024-01-01)
- Added user profile management
- Implemented rate limiting
- Added webhook support

### v1.0.0 (2023-12-01)
- Initial API release
- Basic survey CRUD operations
- User authentication 