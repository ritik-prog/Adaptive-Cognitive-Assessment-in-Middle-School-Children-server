const mongoose = require('mongoose');

// Setup test environment
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_assessment_system';
  
  // Connect to test database
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
});

afterAll(async () => {
  // Clean up test database
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  }
});

// Global test utilities
global.testUtils = {
  createTestUser: async (userData = {}) => {
    const User = require('../src/models/User');
    const defaultUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'student',
      grade: '6',
      ...userData
    };
    return await User.create(defaultUser);
  },

  createTestChapter: async (chapterData = {}) => {
    const Chapter = require('../src/models/Chapter');
    const defaultChapter = {
      class: '6',
      subject: 'Math',
      chapterNumber: 1,
      chapterName: 'Test Chapter',
      description: 'Test chapter description',
      ncertReference: 'NCERT Test Reference',
      ...chapterData
    };
    return await Chapter.create(defaultChapter);
  },

  createTestTopic: async (topicData = {}) => {
    const Topic = require('../src/models/Topic');
    const defaultTopic = {
      chapterId: new mongoose.Types.ObjectId(),
      topicName: 'Test Topic',
      description: 'Test topic description',
      difficultyBaseline: 0.5,
      concepts: ['concept1', 'concept2'],
      ...topicData
    };
    return await Topic.create(defaultTopic);
  },

  createTestQuestion: async (questionData = {}) => {
    const Question = require('../src/models/Question');
    const defaultQuestion = {
      stem: 'Test question?',
      choices: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: 0,
      questionType: 'mcq',
      difficulty: 0.5,
      grade: '6',
      topic: 'Test Topic',
      chapterId: new mongoose.Types.ObjectId(),
      topicId: new mongoose.Types.ObjectId(),
      ...questionData
    };
    return await Question.create(defaultQuestion);
  },

  createTestSession: async (sessionData = {}) => {
    const AssessmentSession = require('../src/models/AssessmentSession');
    const defaultSession = {
      studentId: new mongoose.Types.ObjectId(),
      sessionType: 'adaptive',
      mode: 'assessment',
      chapterId: new mongoose.Types.ObjectId(),
      totalQuestions: 5,
      ...sessionData
    };
    return await AssessmentSession.create(defaultSession);
  },

  generateAuthToken: (userId) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};