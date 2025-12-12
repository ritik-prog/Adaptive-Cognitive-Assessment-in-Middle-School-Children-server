require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const questionRoutes = require('./routes/questions');
const assessmentRoutes = require('./routes/assessments');
const generateRoutes = require('./routes/generate');
const chapterRoutes = require('./routes/chapters');
const recommendationRoutes = require('./routes/recommendations');
const chatbotRoutes = require('./routes/chatbot');
const translationRoutes = require('./routes/translation');
const practiceRoutes = require('./routes/practice');
const revisionRoutes = require('./routes/revision');
const analyticsRoutes = require('./routes/analytics');
const gamificationRoutes = require('./routes/gamification');

const app = express();
const PORT = process.env.PORT || 3000;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cognitive Assessment API',
      version: '1.0.0',
      description: 'Generative-AI Based System for Inferential Learning and Adaptive Cognitive Assessment'
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

app.use('/api/auth/login', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Swagger documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/translation', translationRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/revision', revisionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/gamification', gamificationRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      code: 'ROUTE_NOT_FOUND'
    }
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cognitive-assessment', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    logger.info('Connected to MongoDB');
    // Only start the server if not in test mode
    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        logger.info(`API Documentation available at http://localhost:${PORT}/api/docs`);
      });
    }
  })
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  });

module.exports = app;
