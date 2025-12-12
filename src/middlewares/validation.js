const Joi = require('joi');
const { param, query, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      }
    });
  }
  next();
};

// Auth validation schemas
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(6).max(128).required(),
  role: Joi.string().valid('student', 'teacher', 'admin').default('student'),
  grade: Joi.when('role', {
    is: 'student',
    then: Joi.string().valid('6', '7', '8', '9').required(),
    otherwise: Joi.forbidden()
  }),
  consentFlag: Joi.when('role', {
    is: 'student',
    then: Joi.boolean().required(),
    otherwise: Joi.forbidden()
  }),
  parentEmail: Joi.when('role', {
    is: 'student',
    then: Joi.string().email().optional(),
    otherwise: Joi.forbidden()
  }),
  schoolName: Joi.string().trim().max(200).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

// User validation schemas
const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().lowercase().optional(),
  grade: Joi.string().valid('6', '7', '8', '9').optional(),
  consentFlag: Joi.boolean().optional(),
  parentEmail: Joi.string().email().optional(),
  schoolName: Joi.string().trim().max(200).optional(),
  learningPreferences: Joi.object({
    difficulty: Joi.string().valid('easy', 'medium', 'hard').optional(),
    topics: Joi.array().items(Joi.string().trim()).optional()
  }).optional()
});

// Question validation schemas
const createQuestionSchema = Joi.object({
  stem: Joi.string().trim().min(10).max(2000).required(),
  choices: Joi.array().items(Joi.string().trim().max(500)).min(2).max(4).required(),
  correctIndex: Joi.number().integer().min(0).required(),
  difficulty: Joi.number().min(0).max(1).required(),
  tags: Joi.array().items(Joi.string().trim().max(50)).optional(),
  grade: Joi.string().valid('6', '7', '8', '9').required(),
  topic: Joi.string().trim().min(2).max(100).required(),
  chapterId: Joi.string().hex().length(24).required(),
  topicId: Joi.string().hex().length(24).required(),
  passage: Joi.string().trim().max(5000).optional(),
  explanation: Joi.string().trim().max(1000).optional(),
  isGenerated: Joi.boolean().optional(),
  generatedBy: Joi.string().valid('openai', 'manual', 'seed', 'mock').optional()
});

const updateQuestionSchema = Joi.object({
  stem: Joi.string().trim().min(10).max(2000).optional(),
  choices: Joi.array().items(Joi.string().trim().max(500)).min(2).max(4).optional(),
  correctIndex: Joi.number().integer().min(0).optional(),
  difficulty: Joi.number().min(0).max(1).optional(),
  tags: Joi.array().items(Joi.string().trim().max(50)).optional(),
  grade: Joi.string().valid('6', '7', '8', '9').optional(),
  topic: Joi.string().trim().min(2).max(100).optional(),
  chapterId: Joi.string().hex().length(24).optional(),
  topicId: Joi.string().hex().length(24).optional(),
  passage: Joi.string().trim().max(5000).optional(),
  explanation: Joi.string().trim().max(1000).optional(),
  isActive: Joi.boolean().optional()
});

// Assessment validation schemas
const startAssessmentSchema = Joi.object({
  sessionType: Joi.string().valid('adaptive', 'fixed').required(),
  mode: Joi.string().valid('assessment', 'practice', 'revision').required(),
  chapterId: Joi.string().required(),
  grade: Joi.string().valid('6', '7', '8', '9').optional(),
  topic: Joi.string().trim().min(2).max(100).optional(),
  maxQuestions: Joi.number().integer().min(5).max(50).optional(),
  adaptiveParameters: Joi.object({
    initialDifficulty: Joi.number().min(0).max(1).optional(),
    difficultyStep: Joi.number().min(0.05).max(0.3).optional(),
    maxQuestions: Joi.number().integer().min(5).max(50).optional(),
    minQuestions: Joi.number().integer().min(3).max(20).optional(),
    confidenceThreshold: Joi.number().min(0.5).max(0.95).optional()
  }).optional()
});

const submitAnswerSchema = Joi.object({
  answerIndex: Joi.alternatives().try(
    Joi.number().integer().min(0),
    Joi.string()
  ).optional(),
  answer: Joi.alternatives().try(
    Joi.number().integer().min(0),
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional(),
  responseTimeMs: Joi.number().integer().min(0).max(300000).required() // Max 5 minutes
}).or('answerIndex', 'answer'); // At least one of answerIndex or answer is required

// Generate question validation schemas
const generateQuestionSchema = Joi.object({
  topic: Joi.string().trim().min(2).max(100).required(),
  grade: Joi.string().valid('6', '7', '8', '9').required(),
  difficulty: Joi.number().min(0).max(1).required()
});

// Query parameter validation
const questionQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  grade: Joi.string().valid('6', '7', '8', '9').optional(),
  difficulty: Joi.alternatives().try(
    Joi.number().min(0).max(1),
    Joi.object({
      min: Joi.number().min(0).max(1),
      max: Joi.number().min(0).max(1)
    })
  ).optional(),
  topic: Joi.string().trim().max(100).optional(),
  tags: Joi.string().optional(), // Comma-separated tags
  isActive: Joi.boolean().optional(),
  isGenerated: Joi.boolean().optional(),
  sortBy: Joi.string().valid('createdAt', 'difficulty', 'usageCount', 'successRate').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const studentQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  grade: Joi.string().valid('6', '7', '8', '9').optional(),
  schoolName: Joi.string().trim().max(200).optional(),
  sortBy: Joi.string().valid('createdAt', 'name', 'grade').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Validation middleware functions
const validateRegister = (req, res, next) => {
  const { error } = registerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details
      }
    });
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details
      }
    });
  }
  next();
};

const validateRefreshToken = (req, res, next) => {
  const { error } = refreshTokenSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details
      }
    });
  }
  next();
};

const validateUpdateUser = (req, res, next) => {
  const { error } = updateUserSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details
      }
    });
  }
  next();
};

const validateCreateQuestion = (req, res, next) => {
  const { error } = createQuestionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details
      }
    });
  }
  next();
};

const validateUpdateQuestion = (req, res, next) => {
  const { error } = updateQuestionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details
      }
    });
  }
  next();
};

const validateStartAssessment = (req, res, next) => {
  const { error } = startAssessmentSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details
      }
    });
  }
  next();
};

const validateSubmitAnswer = (req, res, next) => {
  const { error } = submitAnswerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details
      }
    });
  }
  next();
};

const validateGenerateQuestion = (req, res, next) => {
  const { error } = generateQuestionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details
      }
    });
  }
  next();
};

const validateQuestionQuery = (req, res, next) => {
  const { error } = questionQuerySchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details
      }
    });
  }
  next();
};

const validateStudentQuery = (req, res, next) => {
  const { error } = studentQuerySchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details
      }
    });
  }
  next();
};

// Express-validator middleware for common validations
const validateObjectId = (paramName) => [
  param(paramName).isMongoId().withMessage('Invalid ID format'),
  handleValidationErrors
];

const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateUpdateUser,
  validateCreateQuestion,
  validateUpdateQuestion,
  validateStartAssessment,
  validateSubmitAnswer,
  validateGenerateQuestion,
  validateQuestionQuery,
  validateStudentQuery,
  validateObjectId,
  validatePagination,
  handleValidationErrors
};
