const express = require('express');
const Recommendation = require('../models/Recommendation');
const RecommendationEngine = require('../services/recommendationEngine');
const { authenticateToken, authorize } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Recommendation:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         studentId:
 *           type: string
 *         sessionId:
 *           type: string
 *         questionId:
 *           type: string
 *         incorrectAnswer:
 *           type: string
 *         recommendationType:
 *           type: string
 *           enum: [concept_explanation, practice_questions, learning_resources, study_tips, common_mistakes, step_by_step_solution, related_topics, difficulty_adjustment]
 *         content:
 *           type: string
 *         resources:
 *           type: array
 *           items:
 *             type: object
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         isRead:
 *           type: boolean
 *         isHelpful:
 *           type: boolean
 *         feedback:
 *           type: string
 *         relatedTopics:
 *           type: array
 *           items:
 *             type: string
 *         generatedBy:
 *           type: string
 *           enum: [ai, teacher, system]
 *         confidence:
 *           type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *     GenerateRecommendationRequest:
 *       type: object
 *       required:
 *         - sessionId
 *         - questionId
 *         - incorrectAnswer
 *       properties:
 *         sessionId:
 *           type: string
 *         questionId:
 *           type: string
 *         incorrectAnswer:
 *           type: string
 *     MarkHelpfulRequest:
 *       type: object
 *       required:
 *         - isHelpful
 *       properties:
 *         isHelpful:
 *           type: boolean
 *         feedback:
 *           type: string
 */

/**
 * @swagger
 * /api/recommendations/generate:
 *   post:
 *     summary: Generate recommendations for incorrect answers
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GenerateRecommendationRequest'
 *     responses:
 *       201:
 *         description: Recommendations generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Recommendation'
 *                 analysis:
 *                   type: object
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { sessionId, questionId, incorrectAnswer } = req.body;
    const studentId = req.user._id;

    if (!sessionId || !questionId || !incorrectAnswer) {
      return res.status(400).json({
        error: {
          message: 'Missing required fields: sessionId, questionId, incorrectAnswer',
          code: 'MISSING_REQUIRED_FIELDS'
        }
      });
    }

    const result = await RecommendationEngine.generateRecommendationsForIncorrectAnswer(
      studentId,
      sessionId,
      questionId,
      incorrectAnswer
    );

    logger.info(`Generated recommendations for student ${studentId}`);

    res.status(201).json(result);
  } catch (error) {
    logger.error('Generate recommendations error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to generate recommendations',
        code: 'GENERATE_RECOMMENDATIONS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/recommendations/student/{studentId}:
 *   get:
 *     summary: Get recommendations for a student
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: recommendationType
 *         schema:
 *           type: string
 *           enum: [concept_explanation, practice_questions, learning_resources, study_tips, common_mistakes, step_by_step_solution, related_topics, difficulty_adjustment]
 *         description: Filter by recommendation type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of recommendations to return
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Recommendation'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (students can only access their own recommendations)
 *       404:
 *         description: Student not found
 */
router.get('/student/:studentId', authenticateToken, validateObjectId('studentId'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { isRead, priority, recommendationType, limit } = req.query;

    // Check if user can access this student's recommendations
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this student\'s recommendations',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const options = {};
    if (isRead !== undefined) options.isRead = isRead === 'true';
    if (priority) options.priority = priority;
    if (recommendationType) options.recommendationType = recommendationType;
    if (limit) options.limit = parseInt(limit);

    const recommendations = await RecommendationEngine.getRecommendationsForStudent(studentId, options);

    res.json({
      recommendations
    });
  } catch (error) {
    logger.error('Get student recommendations error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve recommendations',
        code: 'GET_RECOMMENDATIONS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/recommendations/session/{sessionId}:
 *   get:
 *     summary: Get recommendations for a session
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Recommendation'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session not found
 */
router.get('/session/:sessionId', authenticateToken, validateObjectId('sessionId'), async (req, res) => {
  try {
    const { sessionId } = req.params;

    const recommendations = await RecommendationEngine.getRecommendationsForSession(sessionId);

    res.json({
      recommendations
    });
  } catch (error) {
    logger.error('Get session recommendations error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve session recommendations',
        code: 'GET_SESSION_RECOMMENDATIONS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/recommendations/{id}/mark-helpful:
 *   post:
 *     summary: Mark recommendation as helpful or not helpful
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Recommendation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MarkHelpfulRequest'
 *     responses:
 *       200:
 *         description: Recommendation updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendation:
 *                   $ref: '#/components/schemas/Recommendation'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Recommendation not found
 */
router.post('/:id/mark-helpful', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isHelpful, feedback } = req.body;

    if (typeof isHelpful !== 'boolean') {
      return res.status(400).json({
        error: {
          message: 'isHelpful must be a boolean value',
          code: 'INVALID_ISHELPFUL_VALUE'
        }
      });
    }

    const recommendation = await RecommendationEngine.markRecommendationAsHelpful(id, isHelpful, feedback);

    res.json({
      recommendation
    });
  } catch (error) {
    logger.error('Mark recommendation helpful error:', error);
    
    if (error.message === 'Recommendation not found') {
      return res.status(404).json({
        error: {
          message: 'Recommendation not found',
          code: 'RECOMMENDATION_NOT_FOUND'
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to update recommendation',
        code: 'UPDATE_RECOMMENDATION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/recommendations/{id}/read:
 *   post:
 *     summary: Mark recommendation as read
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Recommendation ID
 *     responses:
 *       200:
 *         description: Recommendation marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Recommendation not found
 */
router.post('/:id/read', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const { id } = req.params;

    const recommendation = await Recommendation.findById(id);
    if (!recommendation) {
      return res.status(404).json({
        error: {
          message: 'Recommendation not found',
          code: 'RECOMMENDATION_NOT_FOUND'
        }
      });
    }

    await recommendation.markAsRead();

    res.json({
      message: 'Recommendation marked as read'
    });
  } catch (error) {
    logger.error('Mark recommendation read error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to mark recommendation as read',
        code: 'MARK_READ_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/recommendations/student/{studentId}/statistics:
 *   get:
 *     summary: Get recommendation statistics for a student
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     totalRecommendations:
 *                       type: number
 *                     readRecommendations:
 *                       type: number
 *                     helpfulRecommendations:
 *                       type: number
 *                     unhelpfulRecommendations:
 *                       type: number
 *                     averageConfidence:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
router.get('/student/:studentId/statistics', authenticateToken, validateObjectId('studentId'), async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check if user can access this student's statistics
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this student\'s statistics',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const statistics = await RecommendationEngine.getRecommendationStatistics(studentId);

    res.json({
      statistics
    });
  } catch (error) {
    logger.error('Get recommendation statistics error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve recommendation statistics',
        code: 'GET_RECOMMENDATION_STATISTICS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/recommendations/cleanup:
 *   post:
 *     summary: Clean up expired recommendations
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 cleanedUp:
 *                   type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (admins only)
 */
router.post('/cleanup', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const cleanedUp = await RecommendationEngine.cleanupExpiredRecommendations();

    res.json({
      message: 'Cleanup completed successfully',
      cleanedUp
    });
  } catch (error) {
    logger.error('Cleanup recommendations error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to cleanup recommendations',
        code: 'CLEANUP_RECOMMENDATIONS_ERROR'
      }
    });
  }
});

module.exports = router;
