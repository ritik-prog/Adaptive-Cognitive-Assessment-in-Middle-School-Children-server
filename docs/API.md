# API Documentation

This document provides detailed information about the Cognitive Assessment API endpoints with sample curl commands.

## Base URL
```
http://localhost:3001/api
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```bash
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Authentication Endpoints

### Register User
```bash
curl -X POST "http://localhost:3001/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "password": "password123",
    "role": "student",
    "grade": "6",
    "consentFlag": true,
    "parentEmail": "parent@example.com",
    "schoolName": "Lincoln Middle School"
  }'
```

### Login User
```bash
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "password123"
  }'
```

### Refresh Token
```bash
curl -X POST "http://localhost:3001/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### Logout
```bash
curl -X POST "http://localhost:3001/api/auth/logout" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Question Management

### Create Question (Teachers/Admins)
```bash
curl -X POST "http://localhost:3001/api/questions" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stem": "What is 2 + 2?",
    "choices": ["3", "4", "5", "6"],
    "correctIndex": 1,
    "difficulty": 0.2,
    "tags": ["arithmetic", "basic"],
    "grade": "6",
    "topic": "mathematics",
    "explanation": "2 + 2 equals 4"
  }'
```

### List Questions
```bash
# Get all questions
curl -X GET "http://localhost:3001/api/questions" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by grade
curl -X GET "http://localhost:3001/api/questions?grade=6" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by difficulty
curl -X GET "http://localhost:3001/api/questions?difficulty=0.5" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by topic
curl -X GET "http://localhost:3001/api/questions?topic=mathematics" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by tags
curl -X GET "http://localhost:3001/api/questions?tags=arithmetic,algebra" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Pagination
curl -X GET "http://localhost:3001/api/questions?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Question by ID
```bash
curl -X GET "http://localhost:3001/api/questions/QUESTION_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Update Question (Teachers/Admins)
```bash
curl -X PUT "http://localhost:3001/api/questions/QUESTION_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stem": "Updated question text",
    "difficulty": 0.3
  }'
```

### Delete Question (Admins only)
```bash
curl -X DELETE "http://localhost:3001/api/questions/QUESTION_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Assessment Management

### Start Assessment Session
```bash
# Adaptive assessment
curl -X POST "http://localhost:3001/api/assessments/start" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionType": "adaptive",
    "grade": "6",
    "topic": "mathematics",
    "adaptiveParameters": {
      "initialDifficulty": 0.5,
      "maxQuestions": 20,
      "minQuestions": 5,
      "confidenceThreshold": 0.8
    }
  }'

# Fixed assessment
curl -X POST "http://localhost:3001/api/assessments/start" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionType": "fixed",
    "grade": "6",
    "topic": "mathematics",
    "maxQuestions": 15
  }'
```

### Submit Answer
```bash
curl -X POST "http://localhost:3001/api/assessments/SESSION_ID/answer" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answerIndex": 1,
    "responseTimeMs": 5000
  }'
```

### Get Session Status
```bash
curl -X GET "http://localhost:3001/api/assessments/SESSION_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## AI Question Generation

### Generate Question (Mock Mode)
```bash
curl -X POST "http://localhost:3001/api/generate/question?mock=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "mathematics",
    "grade": "6",
    "difficulty": 0.5
  }'
```

### Generate Question (Real AI Mode)
```bash
curl -X POST "http://localhost:3001/api/generate/question" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "science",
    "grade": "8",
    "difficulty": 0.7
  }'
```

### Get Generation Statistics
```bash
# All statistics
curl -X GET "http://localhost:3001/api/generate/stats" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by model
curl -X GET "http://localhost:3001/api/generate/stats?modelUsed=mock" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by date range
curl -X GET "http://localhost:3001/api/generate/stats?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### List Generated Questions
```bash
# All generated questions
curl -X GET "http://localhost:3001/api/generate/questions" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by storage status
curl -X GET "http://localhost:3001/api/generate/questions?isStored=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by topic
curl -X GET "http://localhost:3001/api/generate/questions?topic=mathematics" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by grade
curl -X GET "http://localhost:3001/api/generate/questions?grade=6" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## User Management

### Get User Profile
```bash
curl -X GET "http://localhost:3001/api/users/USER_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Update User Profile
```bash
curl -X PUT "http://localhost:3001/api/users/USER_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "grade": "7",
    "learningPreferences": {
      "difficulty": "medium",
      "topics": ["mathematics", "science"]
    }
  }'
```

### List Students (Teachers/Admins)
```bash
# All students
curl -X GET "http://localhost:3001/api/students" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by grade
curl -X GET "http://localhost:3001/api/students?grade=6" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Filter by school
curl -X GET "http://localhost:3001/api/students?schoolName=Lincoln" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Pagination
curl -X GET "http://localhost:3001/api/students?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Teacher Report
```bash
curl -X GET "http://localhost:3001/api/teacher/TEACHER_ID/report" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Health Check

### API Health
```bash
curl -X GET "http://localhost:3001/api/health"
```

## Error Responses

All error responses follow this format:
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR` - Request validation failed
- `AUTH_REQUIRED` - Authentication required
- `INVALID_TOKEN` - Invalid or expired token
- `INSUFFICIENT_PERMISSIONS` - Insufficient permissions
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `AI_SERVICE_UNAVAILABLE` - AI service not configured

## Rate Limiting

- Login endpoint: 100 requests per 15 minutes per IP
- Other endpoints: No specific limits (configurable)

## Response Formats

### Success Response
```json
{
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Authentication Response
```json
{
  "user": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "student"
  },
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

## Testing with Sample Data

Use the provided sample credentials for testing:

```bash
# Login as admin
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.smith@school.edu",
    "password": "password123"
  }'

# Login as teacher
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.johnson@school.edu",
    "password": "password123"
  }'

# Login as student
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "emma.davis@school.edu",
    "password": "password123"
  }'
```

## Interactive Documentation

For a more interactive experience, visit the Swagger UI at:
```
http://localhost:3001/api/docs
```
