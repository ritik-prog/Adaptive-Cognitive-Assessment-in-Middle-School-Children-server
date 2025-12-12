# Generative-AI Based System for Inferential Learning and Adaptive Cognitive Assessment

A comprehensive Node.js application for adaptive cognitive assessment in middle school children, featuring AI-generated questions and intelligent assessment algorithms.

## Features

- **User Management**: Role-based access control (Students, Teachers, Admins)
- **Question Bank**: CRUD operations for educational questions
- **Adaptive Assessment**: Intelligent question selection based on student performance
- **AI Question Generation**: OpenAI-powered question creation with mock support
- **Real-time Analytics**: Performance tracking and reporting
- **RESTful API**: Well-documented endpoints with Swagger UI
- **Comprehensive Testing**: Unit and integration tests with >80% coverage

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (Access + Refresh tokens)
- **AI Integration**: OpenAI GPT API with mock fallback
- **Testing**: Jest, Supertest
- **Documentation**: Swagger/OpenAPI
- **Code Quality**: ESLint, Prettier

## Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB 6.0+
- OpenAI API key (optional, for real AI generation)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd generative-ai-cognitive-assessment
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Seed the database**
   ```bash
   npm run seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/cognitive-assessment

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OpenAI Configuration (Optional)
OPENAI_API_KEY=your-openai-api-key-here
LLM_MOCK=false

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=info
```

## API Documentation

Once the server is running, visit `http://localhost:3001/api/docs` for interactive Swagger documentation.

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user

#### Questions
- `GET /api/questions` - List questions (with filtering)
- `POST /api/questions` - Create question (Teachers/Admins)
- `GET /api/questions/:id` - Get question by ID
- `PUT /api/questions/:id` - Update question (Teachers/Admins)
- `DELETE /api/questions/:id` - Delete question (Admins only)

#### Assessments
- `POST /api/assessments/start` - Start new assessment session
- `POST /api/assessments/:sessionId/answer` - Submit answer
- `GET /api/assessments/:sessionId` - Get session status

#### AI Generation
- `POST /api/generate/question` - Generate AI question
- `GET /api/generate/stats` - Get generation statistics
- `GET /api/generate/questions` - List generated questions

#### Users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `GET /api/students` - List students (Teachers/Admins)
- `GET /api/teacher/:teacherId/report` - Get teacher report

## Sample Data

The seed script creates sample users and questions:

### Login Credentials
- **Admin**: `john.smith@school.edu` / `password123`
- **Teacher**: `sarah.johnson@school.edu` / `password123`
- **Student**: `emma.davis@school.edu` / `password123`

### Sample Questions
- 20+ pre-loaded questions across grades 6-9
- Topics: Mathematics, Science, Reading Comprehension
- Difficulty levels: 0.2 (Easy) to 0.8 (Hard)

## AI Question Generation

The system supports both real AI generation and mock mode:

### Mock Mode (Default)
```bash
# Use mock data for testing
curl -X POST "http://localhost:3001/api/generate/question?mock=true" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "mathematics",
    "grade": "6",
    "difficulty": 0.5
  }'
```

### Real AI Mode
Set `OPENAI_API_KEY` in your `.env` file and use:
```bash
curl -X POST "http://localhost:3001/api/generate/question" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "mathematics",
    "grade": "6",
    "difficulty": 0.5
  }'
```

## Testing

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Test Structure
- **Unit Tests**: `tests/unit/` - Individual component testing
- **Integration Tests**: `tests/integration/` - API endpoint testing
- **Mock Mode**: All tests use `LLM_MOCK=true` to avoid external API calls

## Scripts

```bash
# Development
npm run dev          # Start with nodemon
npm run start        # Start production server

# Database
npm run seed         # Seed sample data

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run format       # Format code with Prettier
```

## Database Schema

### Core Models
- **User**: Authentication and basic profile
- **StudentProfile**: Extended student information
- **Question**: Question bank with metadata
- **AssessmentSession**: Assessment sessions and progress
- **Response**: Individual question responses
- **GeneratedQuestion**: AI-generated question records

### Key Features
- Soft deletes for questions
- Usage statistics tracking
- Adaptive difficulty algorithms
- Comprehensive indexing for performance

## Security Features

- JWT-based authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting on sensitive endpoints
- CORS protection
- Helmet.js security headers
- Input validation with Joi
- Role-based access control

## Performance

- MongoDB indexing for efficient queries
- Pagination for large datasets
- Response time tracking
- Usage analytics
- Adaptive algorithms for optimal question selection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions or issues, please create an issue in the repository or contact the development team.

---

**Note**: This application is designed for educational purposes and should be properly configured for production use with appropriate security measures and monitoring.
