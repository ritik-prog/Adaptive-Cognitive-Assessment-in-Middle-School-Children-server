const express = require('express');
const { generateQuestion } = require('../services/llmClient');
const Question = require('../models/Question');
const GeneratedQuestion = require('../models/GeneratedQuestion');
const { authenticateToken, authorize } = require('../middlewares/auth');
const { validateGenerateQuestion } = require('../middlewares/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     GenerateQuestionRequest:
 *       type: object
 *       required:
 *         - topic
 *         - grade
 *         - difficulty
 *       properties:
 *         topic:
 *           type: string
 *           description: Topic for the question
 *         grade:
 *           type: string
 *           enum: [6, 7, 8, 9]
 *           description: Grade level
 *         difficulty:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           description: Difficulty level (0=easy, 1=hard)
 *     GeneratedQuestionResponse:
 *       type: object
 *       properties:
 *         question:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             stem:
 *               type: string
 *             choices:
 *               type: array
 *               items:
 *                 type: string
 *             correctIndex:
 *               type: integer
 *             difficulty:
 *               type: number
 *             tags:
 *               type: array
 *               items:
 *                 type: string
 *         generationId:
 *           type: string
 *         modelUsed:
 *           type: string
 *         latencyMs:
 *           type: number
 */

/**
 * @swagger
 * /api/generate/question:
 *   post:
 *     summary: Generate a question using AI
 *     tags: [Generate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: mock
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Use mock data instead of real AI generation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GenerateQuestionRequest'
 *     responses:
 *       200:
 *         description: Question generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GeneratedQuestionResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 *       503:
 *         description: AI service unavailable
 */
router.post('/question', authenticateToken, authorize('teacher', 'admin'), validateGenerateQuestion, async(req, res) => {
  try {
    const { topic, grade, difficulty } = req.body;
    const { mock } = req.query;

    // Check if OpenAI API key is available when not using mock
    if (mock !== 'true' && !process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: {
          message: 'AI service is not configured. Please set OPENAI_API_KEY environment variable or use ?mock=true for testing.',
          code: 'AI_SERVICE_UNAVAILABLE'
        }
      });
    }

    // Generate the question
    const result = await generateQuestion({
      topic,
      grade,
      difficulty,
      mock: mock === 'true'
    });

    // Prepare the question data for the frontend (don't save yet)
    const questionData = {
      stem: result.question.stem,
      choices: result.question.choices,
      correctIndex: result.question.correctIndex,
      difficulty: result.question.difficulty,
      tags: result.question.tags || [],
      grade,
      topic,
      isGenerated: true,
      generatedBy: result.modelUsed === 'mock' ? 'mock' : 'openai'
    };

    // Only add optional fields if they have values
    if (result.question.explanation && result.question.explanation.trim()) {
      questionData.explanation = result.question.explanation;
    }
    if (result.question.passage && result.question.passage.trim()) {
      questionData.passage = result.question.passage;
    }

    logger.info(`Question generated using ${result.modelUsed}`);

    res.json({
      question: questionData,
      generationId: result.generationId,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs
    });
  } catch (error) {
    logger.error('Generate question error:', error);

    if (error.message.includes('OpenAI API key not configured')) {
      return res.status(503).json({
        error: {
          message: 'AI service is not configured. Please set OPENAI_API_KEY environment variable or use ?mock=true for testing.',
          code: 'AI_SERVICE_UNAVAILABLE'
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to generate question',
        code: 'GENERATE_QUESTION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/generate/stats:
 *   get:
 *     summary: Get generation statistics
 *     tags: [Generate]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: modelUsed
 *         schema:
 *           type: string
 *           enum: [gpt-3.5-turbo, gpt-4, gpt-4-turbo, mock]
 *         description: Filter by model used
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: Generation statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalGenerated:
 *                   type: number
 *                 averageLatency:
 *                   type: number
 *                 averageQualityScore:
 *                   type: number
 *                 storedCount:
 *                   type: number
 *                 averageUsageCount:
 *                   type: number
 *                 averageSuccessRate:
 *                   type: number
 *                 modelPerformance:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       model:
 *                         type: string
 *                       totalGenerated:
 *                         type: number
 *                       averageLatency:
 *                         type: number
 *                       averageQualityScore:
 *                         type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 */
router.get('/stats', authenticateToken, authorize('teacher', 'admin'), async(req, res) => {
  try {
    const { modelUsed, startDate, endDate } = req.query;

    const filters = {};
    if (modelUsed) filters.modelUsed = modelUsed;
    if (startDate || endDate) {
      filters.dateRange = {};
      if (startDate) filters.dateRange.start = new Date(startDate);
      if (endDate) filters.dateRange.end = new Date(endDate);
    }

    // Get overall statistics
    const overallStats = await GeneratedQuestion.getGenerationStats(filters);

    // Get model performance comparison
    const modelPerformance = await GeneratedQuestion.getModelPerformance();

    const stats = overallStats.length > 0 ? overallStats[0] : {
      totalGenerated: 0,
      averageLatency: 0,
      averageQualityScore: 0,
      storedCount: 0,
      averageUsageCount: 0,
      averageSuccessRate: 0
    };

    res.json({
      totalGenerated: stats.totalGenerated,
      averageLatency: Math.round(stats.averageLatency * 100) / 100,
      averageQualityScore: Math.round(stats.averageQualityScore * 100) / 100,
      storedCount: stats.storedCount,
      averageUsageCount: Math.round(stats.averageUsageCount * 100) / 100,
      averageSuccessRate: Math.round(stats.averageSuccessRate * 100) / 100,
      modelPerformance: modelPerformance.map(model => ({
        model: model._id,
        totalGenerated: model.totalGenerated,
        averageLatency: Math.round(model.averageLatency * 100) / 100,
        averageQualityScore: Math.round(model.averageQualityScore * 100) / 100,
        storedCount: model.storedCount,
        averageUsageCount: Math.round(model.averageUsageCount * 100) / 100,
        averageSuccessRate: Math.round(model.averageSuccessRate * 100) / 100
      }))
    });
  } catch (error) {
    logger.error('Get generation stats error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve generation statistics',
        code: 'GET_GENERATION_STATS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/generate/questions:
 *   get:
 *     summary: List generated questions
 *     tags: [Generate]
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
 *         name: modelUsed
 *         schema:
 *           type: string
 *           enum: [gpt-3.5-turbo, gpt-4, gpt-4-turbo, mock]
 *         description: Filter by model used
 *       - in: query
 *         name: isStored
 *         schema:
 *           type: boolean
 *         description: Filter by storage status
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *         description: Filter by topic
 *       - in: query
 *         name: grade
 *         schema:
 *           type: string
 *           enum: [6, 7, 8, 9]
 *         description: Filter by grade
 *     responses:
 *       200:
 *         description: Generated questions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       inputPrompt:
 *                         type: string
 *                       outputJSON:
 *                         type: string
 *                       generatedAt:
 *                         type: string
 *                         format: date-time
 *                       modelUsed:
 *                         type: string
 *                       latencyMs:
 *                         type: number
 *                       parameters:
 *                         type: object
 *                       questionId:
 *                         type: string
 *                       isStored:
 *                         type: boolean
 *                       qualityScore:
 *                         type: number
 *                       usageCount:
 *                         type: number
 *                       successRate:
 *                         type: number
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
 *       403:
 *         description: Access denied (teachers and admins only)
 */
router.get('/questions', authenticateToken, authorize('teacher', 'admin'), async(req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      modelUsed,
      isStored,
      topic,
      grade
    } = req.query;

    const skip = (page - 1) * limit;

    // Build filter query
    const filter = {};
    if (modelUsed) filter.modelUsed = modelUsed;
    if (isStored !== undefined) filter.isStored = isStored === 'true';
    if (topic) filter['parameters.topic'] = new RegExp(topic, 'i');
    if (grade) filter['parameters.grade'] = grade;

    // Get generated questions with pagination
    const questions = await GeneratedQuestion.find(filter)
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await GeneratedQuestion.countDocuments(filter);

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
    logger.error('Get generated questions error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve generated questions',
        code: 'GET_GENERATED_QUESTIONS_ERROR'
      }
    });
  }
});

module.exports = router;
