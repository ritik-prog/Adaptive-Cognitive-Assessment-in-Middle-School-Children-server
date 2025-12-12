const express = require('express');
const Question = require('../models/Question');
const { authenticateToken, authorize } = require('../middlewares/auth');
const {
  validateCreateQuestion,
  validateUpdateQuestion,
  validateQuestionQuery,
  validateObjectId
} = require('../middlewares/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Question:
 *       type: object
 *       required:
 *         - stem
 *         - choices
 *         - correctIndex
 *         - difficulty
 *         - grade
 *         - topic
 *       properties:
 *         stem:
 *           type: string
 *           description: The question text
 *         choices:
 *           type: array
 *           items:
 *             type: string
 *           minItems: 2
 *           maxItems: 4
 *           description: Answer choices
 *         correctIndex:
 *           type: integer
 *           minimum: 0
 *           description: Index of the correct answer
 *         difficulty:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           description: Difficulty level (0=easy, 1=hard)
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Question tags
 *         grade:
 *           type: string
 *           enum: [6, 7, 8, 9]
 *           description: Grade level
 *         topic:
 *           type: string
 *           description: Question topic
 *         passage:
 *           type: string
 *           description: Optional reading passage
 *         explanation:
 *           type: string
 *           description: Explanation of the correct answer
 *         isGenerated:
 *           type: boolean
 *           description: Whether the question was AI-generated
 *         usageCount:
 *           type: number
 *           description: Number of times this question has been used
 *         successRate:
 *           type: number
 *           description: Success rate of this question
 *         averageResponseTime:
 *           type: number
 *           description: Average response time in milliseconds
 */

/**
 * @swagger
 * /api/questions:
 *   post:
 *     summary: Create a new question
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Question'
 *     responses:
 *       201:
 *         description: Question created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Question'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 */
router.post('/', authenticateToken, authorize('teacher', 'admin'), validateCreateQuestion, async(req, res) => {
  try {
    const questionData = {
      ...req.body,
      createdBy: req.user._id,
      // Preserve isGenerated and generatedBy if provided, otherwise default to manual
      isGenerated: req.body.isGenerated !== undefined ? req.body.isGenerated : false,
      generatedBy: req.body.generatedBy || 'manual'
    };

    // Check for duplicate questions based on stem content
    const existingQuestion = await Question.findOne({
      stem: { $regex: new RegExp(`^${questionData.stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      isActive: true
    });

    if (existingQuestion) {
      return res.status(409).json({
        error: {
          message: 'A question with this content already exists in the database',
          code: 'DUPLICATE_QUESTION',
          details: {
            existingQuestionId: existingQuestion._id,
            existingQuestionStem: existingQuestion.stem
          }
        }
      });
    }

    const question = new Question(questionData);
    await question.save();

    logger.info(`Question created: ${question._id} by ${req.user.email}`);

    res.status(201).json(question);
  } catch (error) {
    logger.error('Create question error:', error);
    
    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors
        }
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        error: {
          message: 'A question with this content already exists',
          code: 'DUPLICATE_QUESTION'
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to create question',
        code: 'CREATE_QUESTION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/questions:
 *   get:
 *     summary: List questions with filtering and pagination
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of questions per page
 *       - in: query
 *         name: grade
 *         schema:
 *           type: string
 *           enum: [6, 7, 8, 9]
 *         description: Filter by grade
 *       - in: query
 *         name: difficulty
 *         schema:
 *           oneOf:
 *             - type: number
 *               minimum: 0
 *               maximum: 1
 *             - type: object
 *               properties:
 *                 min:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 1
 *                 max:
 *                   type: number
 *                   minimum: 0
 *                   maximum: 1
 *         description: Filter by difficulty
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *         description: Filter by topic
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tags
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: isGenerated
 *         schema:
 *           type: boolean
 *         description: Filter by generation status
 *       - in: query
 *         name: questionType
 *         schema:
 *           type: string
 *           enum: [mcq, fill-in-blank, short-answer]
 *         description: Filter by question type
 *       - in: query
 *         name: chapterId
 *         schema:
 *           type: string
 *         description: Filter by chapter ID
 *       - in: query
 *         name: topicId
 *         schema:
 *           type: string
 *         description: Filter by topic ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, difficulty, usageCount, successRate]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Questions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 questions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Question'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     total:
 *                       type: number
 *                     pages:
 *                       type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateToken, validateQuestionQuery, async(req, res) => {
  try {
    const {
      page,
      limit,
      grade,
      difficulty,
      topic,
      tags,
      isActive,
      isGenerated,
      questionType,
      chapterId,
      topicId,
      sortBy,
      sortOrder
    } = req.query;

    const skip = (page - 1) * limit;

    // Build filter query
    const filter = {};
    if (grade) filter.grade = grade;
    if (difficulty) {
      const difficultyNum = parseFloat(difficulty);
      if (typeof difficulty === 'object') {
        filter.difficulty = difficulty;
      } else if (!isNaN(difficultyNum)) {
        filter.difficulty = {
          $gte: difficultyNum - 0.05,
          $lte: difficultyNum + 0.05
        };
      }
    }
    if (topic) filter.topic = new RegExp(topic, 'i');
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagArray };
    }
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (isGenerated !== undefined) filter.isGenerated = isGenerated === 'true';
    if (questionType) filter.questionType = questionType;
    if (chapterId) filter.chapterId = chapterId;
    if (topicId) filter.topicId = topicId;

    // Build sort query
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get questions with pagination
    const questions = await Question.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email')
      .populate('chapterId', 'chapterName class subject')
      .populate('topicId', 'topicName description difficulty');

    // Get total count
    const total = await Question.countDocuments(filter);

    res.json({
      questions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get questions error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve questions',
        code: 'GET_QUESTIONS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/questions/{id}:
 *   get:
 *     summary: Get question by ID
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Question retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Question'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Question not found
 */
router.get('/:id', authenticateToken, validateObjectId('id'), async(req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!question) {
      return res.status(404).json({
        error: {
          message: 'Question not found',
          code: 'QUESTION_NOT_FOUND'
        }
      });
    }

    res.json(question);
  } catch (error) {
    logger.error('Get question error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve question',
        code: 'GET_QUESTION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/questions/{id}:
 *   put:
 *     summary: Update question
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stem:
 *                 type: string
 *               choices:
 *                 type: array
 *                 items:
 *                   type: string
 *               correctIndex:
 *                 type: integer
 *               difficulty:
 *                 type: number
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               grade:
 *                 type: string
 *               topic:
 *                 type: string
 *               passage:
 *                 type: string
 *               explanation:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Question updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Question'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 *       404:
 *         description: Question not found
 */
router.put('/:id', authenticateToken, authorize('teacher', 'admin'), validateObjectId('id'), validateUpdateQuestion, async(req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        error: {
          message: 'Question not found',
          code: 'QUESTION_NOT_FOUND'
        }
      });
    }

    // Update question
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        question[key] = req.body[key];
      }
    });

    await question.save();

    logger.info(`Question updated: ${question._id} by ${req.user.email}`);

    res.json(question);
  } catch (error) {
    logger.error('Update question error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update question',
        code: 'UPDATE_QUESTION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/questions/{id}:
 *   delete:
 *     summary: Delete question
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Question deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (admins only)
 *       404:
 *         description: Question not found
 */
router.delete('/:id', authenticateToken, authorize('teacher', 'admin'), validateObjectId('id'), async(req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        error: {
          message: 'Question not found',
          code: 'QUESTION_NOT_FOUND'
        }
      });
    }

    // Soft delete by setting isActive to false
    question.isActive = false;
    await question.save();

    logger.info(`Question deleted: ${question._id} by ${req.user.email}`);

    res.json({
      message: 'Question deleted successfully'
    });
  } catch (error) {
    logger.error('Delete question error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete question',
        code: 'DELETE_QUESTION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/questions/bulk-upload:
 *   post:
 *     summary: Bulk upload questions via CSV
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file with questions
 *               chapterId:
 *                 type: string
 *                 description: Chapter ID to associate questions with
 *     responses:
 *       200:
 *         description: Questions uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 uploaded:
 *                   type: number
 *                 failed:
 *                   type: number
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 */
router.post('/bulk-upload', authenticateToken, authorize('teacher', 'admin'), async (req, res) => {
  try {
    // This would require multer middleware for file upload
    // For now, return a placeholder response
    res.status(501).json({
      error: {
        message: 'Bulk upload feature not yet implemented',
        code: 'NOT_IMPLEMENTED'
      }
    });
  } catch (error) {
    logger.error('Bulk upload error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to upload questions',
        code: 'BULK_UPLOAD_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/questions/by-chapter/{chapterId}:
 *   get:
 *     summary: Get questions by chapter
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chapter ID
 *       - in: query
 *         name: questionType
 *         schema:
 *           type: string
 *           enum: [mcq, fill-in-blank, short-answer]
 *         description: Filter by question type
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *         description: Filter by difficulty
 *     responses:
 *       200:
 *         description: Questions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 questions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Question'
 *                 total:
 *                   type: number
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Chapter not found
 */
router.get('/by-chapter/:chapterId', authenticateToken, validateObjectId('chapterId'), async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { questionType, difficulty } = req.query;

    const criteria = { chapterId };
    if (questionType) criteria.questionType = questionType;
    if (difficulty) {
      const difficultyNum = parseFloat(difficulty);
      if (!isNaN(difficultyNum)) {
        criteria.difficulty = {
          $gte: difficultyNum - 0.1,
          $lte: difficultyNum + 0.1
        };
      }
    }

    const questions = await Question.findByCriteria(criteria)
      .populate('topicId', 'topicName description difficulty')
      .populate('createdBy', 'name email');

    res.json({
      questions,
      total: questions.length
    });
  } catch (error) {
    logger.error('Get questions by chapter error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve questions by chapter',
        code: 'GET_QUESTIONS_BY_CHAPTER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/questions/{id}/validate-answer:
 *   post:
 *     summary: Validate answer for a question
 *     tags: [Questions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answer:
 *                 oneOf:
 *                   - type: number
 *                     description: Answer index for MCQ
 *                   - type: string
 *                     description: Answer text for fill-in-blank or short-answer
 *                   - type: array
 *                     items:
 *                       type: string
 *                     description: Multiple answers for fill-in-blank
 *     responses:
 *       200:
 *         description: Answer validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isValid:
 *                   type: boolean
 *                 isCorrect:
 *                   type: boolean
 *                 correctAnswer:
 *                   type: string
 *                 selectedAnswer:
 *                   type: string
 *                 feedback:
 *                   type: object
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Question not found
 */
router.post('/:id/validate-answer', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({
        error: {
          message: 'Question not found',
          code: 'QUESTION_NOT_FOUND'
        }
      });
    }

    const AnswerValidator = require('../services/answerValidator');
    const validationResult = AnswerValidator.validateAnswer(question, answer);
    const feedback = AnswerValidator.getFeedback(question, answer, validationResult);

    res.json({
      ...validationResult,
      feedback
    });
  } catch (error) {
    logger.error('Validate answer error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to validate answer',
        code: 'VALIDATE_ANSWER_ERROR'
      }
    });
  }
});

module.exports = router;
