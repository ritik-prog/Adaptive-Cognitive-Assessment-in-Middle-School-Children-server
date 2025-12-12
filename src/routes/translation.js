const express = require('express');
const translationService = require('../services/translationService');
const Question = require('../models/Question');
const Chapter = require('../models/Chapter');
const Topic = require('../models/Topic');
const Recommendation = require('../models/Recommendation');
const { authenticateToken } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     TranslationRequest:
 *       type: object
 *       required:
 *         - text
 *         - targetLanguage
 *       properties:
 *         text:
 *           type: string
 *           description: Text to translate
 *         targetLanguage:
 *           type: string
 *           enum: [hi, te, ta]
 *           description: Target language code
 *         sourceLanguage:
 *           type: string
 *           enum: [en, hi, te, ta]
 *           default: en
 *           description: Source language code
 *     TranslationResponse:
 *       type: object
 *       properties:
 *         originalText:
 *           type: string
 *         translatedText:
 *           type: string
 *         sourceLanguage:
 *           type: string
 *         targetLanguage:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/translation/languages:
 *   get:
 *     summary: Get supported languages
 *     tags: [Translation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supported languages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 languages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       code:
 *                         type: string
 *                       name:
 *                         type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/languages', authenticateToken, async (req, res) => {
  try {
    const supportedLanguages = translationService.getSupportedLanguages();
    const languages = supportedLanguages.map(code => ({
      code,
      name: translationService.getLanguageName(code)
    }));

    res.json({
      languages
    });
  } catch (error) {
    logger.error('Get supported languages error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve supported languages',
        code: 'GET_LANGUAGES_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/translation/translate:
 *   post:
 *     summary: Translate text
 *     tags: [Translation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TranslationRequest'
 *     responses:
 *       200:
 *         description: Text translated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TranslationResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/translate', authenticateToken, async (req, res) => {
  try {
    const { text, targetLanguage, sourceLanguage = 'en' } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({
        error: {
          message: 'Text and targetLanguage are required',
          code: 'MISSING_REQUIRED_FIELDS'
        }
      });
    }

    const translatedText = await translationService.translateText(text, targetLanguage, sourceLanguage);

    res.json({
      originalText: text,
      translatedText,
      sourceLanguage,
      targetLanguage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Translate text error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to translate text',
        code: 'TRANSLATE_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/translation/question/{questionId}:
 *   post:
 *     summary: Translate question
 *     tags: [Translation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
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
 *             required:
 *               - targetLanguage
 *             properties:
 *               targetLanguage:
 *                 type: string
 *                 enum: [hi, te, ta]
 *                 description: Target language code
 *     responses:
 *       200:
 *         description: Question translated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 question:
 *                   type: object
 *                 targetLanguage:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Question not found
 */
router.post('/question/:questionId', authenticateToken, validateObjectId('questionId'), async (req, res) => {
  try {
    const { questionId } = req.params;
    const { targetLanguage } = req.body;

    if (!targetLanguage) {
      return res.status(400).json({
        error: {
          message: 'targetLanguage is required',
          code: 'MISSING_TARGET_LANGUAGE'
        }
      });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        error: {
          message: 'Question not found',
          code: 'QUESTION_NOT_FOUND'
        }
      });
    }

    const translatedQuestion = await translationService.translateQuestion(question, targetLanguage);

    res.json({
      question: translatedQuestion,
      targetLanguage
    });
  } catch (error) {
    logger.error('Translate question error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to translate question',
        code: 'TRANSLATE_QUESTION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/translation/chapter/{chapterId}:
 *   post:
 *     summary: Translate chapter
 *     tags: [Translation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chapter ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetLanguage
 *             properties:
 *               targetLanguage:
 *                 type: string
 *                 enum: [hi, te, ta]
 *                 description: Target language code
 *     responses:
 *       200:
 *         description: Chapter translated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chapter:
 *                   type: object
 *                 targetLanguage:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Chapter not found
 */
router.post('/chapter/:chapterId', authenticateToken, validateObjectId('chapterId'), async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { targetLanguage } = req.body;

    if (!targetLanguage) {
      return res.status(400).json({
        error: {
          message: 'targetLanguage is required',
          code: 'MISSING_TARGET_LANGUAGE'
        }
      });
    }

    const chapter = await Chapter.findById(chapterId).populate('topics');
    if (!chapter) {
      return res.status(404).json({
        error: {
          message: 'Chapter not found',
          code: 'CHAPTER_NOT_FOUND'
        }
      });
    }

    const translatedChapter = await translationService.translateChapter(chapter, targetLanguage);

    // Translate topics if they exist
    if (translatedChapter.topics && translatedChapter.topics.length > 0) {
      translatedChapter.topics = await Promise.all(
        translatedChapter.topics.map(topic => 
          translationService.translateTopic(topic, targetLanguage)
        )
      );
    }

    res.json({
      chapter: translatedChapter,
      targetLanguage
    });
  } catch (error) {
    logger.error('Translate chapter error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to translate chapter',
        code: 'TRANSLATE_CHAPTER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/translation/topic/{topicId}:
 *   post:
 *     summary: Translate topic
 *     tags: [Translation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: topicId
 *         required: true
 *         schema:
 *           type: string
 *         description: Topic ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetLanguage
 *             properties:
 *               targetLanguage:
 *                 type: string
 *                 enum: [hi, te, ta]
 *                 description: Target language code
 *     responses:
 *       200:
 *         description: Topic translated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 topic:
 *                   type: object
 *                 targetLanguage:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Topic not found
 */
router.post('/topic/:topicId', authenticateToken, validateObjectId('topicId'), async (req, res) => {
  try {
    const { topicId } = req.params;
    const { targetLanguage } = req.body;

    if (!targetLanguage) {
      return res.status(400).json({
        error: {
          message: 'targetLanguage is required',
          code: 'MISSING_TARGET_LANGUAGE'
        }
      });
    }

    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({
        error: {
          message: 'Topic not found',
          code: 'TOPIC_NOT_FOUND'
        }
      });
    }

    const translatedTopic = await translationService.translateTopic(topic, targetLanguage);

    res.json({
      topic: translatedTopic,
      targetLanguage
    });
  } catch (error) {
    logger.error('Translate topic error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to translate topic',
        code: 'TRANSLATE_TOPIC_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/translation/recommendation/{recommendationId}:
 *   post:
 *     summary: Translate recommendation
 *     tags: [Translation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recommendationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Recommendation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetLanguage
 *             properties:
 *               targetLanguage:
 *                 type: string
 *                 enum: [hi, te, ta]
 *                 description: Target language code
 *     responses:
 *       200:
 *         description: Recommendation translated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendation:
 *                   type: object
 *                 targetLanguage:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Recommendation not found
 */
router.post('/recommendation/:recommendationId', authenticateToken, validateObjectId('recommendationId'), async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const { targetLanguage } = req.body;

    if (!targetLanguage) {
      return res.status(400).json({
        error: {
          message: 'targetLanguage is required',
          code: 'MISSING_TARGET_LANGUAGE'
        }
      });
    }

    const recommendation = await Recommendation.findById(recommendationId);
    if (!recommendation) {
      return res.status(404).json({
        error: {
          message: 'Recommendation not found',
          code: 'RECOMMENDATION_NOT_FOUND'
        }
      });
    }

    const translatedRecommendation = await translationService.translateRecommendation(recommendation, targetLanguage);

    res.json({
      recommendation: translatedRecommendation,
      targetLanguage
    });
  } catch (error) {
    logger.error('Translate recommendation error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to translate recommendation',
        code: 'TRANSLATE_RECOMMENDATION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/translation/ui:
 *   post:
 *     summary: Translate UI text
 *     tags: [Translation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - targetLanguage
 *             properties:
 *               key:
 *                 type: string
 *                 description: UI text key
 *               targetLanguage:
 *                 type: string
 *                 enum: [hi, te, ta]
 *                 description: Target language code
 *     responses:
 *       200:
 *         description: UI text translated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:
 *                   type: string
 *                 translatedText:
 *                   type: string
 *                 targetLanguage:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/ui', authenticateToken, async (req, res) => {
  try {
    const { key, targetLanguage } = req.body;

    if (!key || !targetLanguage) {
      return res.status(400).json({
        error: {
          message: 'key and targetLanguage are required',
          code: 'MISSING_REQUIRED_FIELDS'
        }
      });
    }

    const translatedText = await translationService.translateUI(key, targetLanguage);

    res.json({
      key,
      translatedText,
      targetLanguage
    });
  } catch (error) {
    logger.error('Translate UI text error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to translate UI text',
        code: 'TRANSLATE_UI_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/translation/cache/stats:
 *   get:
 *     summary: Get translation cache statistics
 *     tags: [Translation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   properties:
 *                     size:
 *                       type: number
 *                     supportedLanguages:
 *                       type: array
 *                       items:
 *                         type: string
 *                     languageNames:
 *                       type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/cache/stats', authenticateToken, async (req, res) => {
  try {
    const stats = translationService.getCacheStats();

    res.json({
      stats
    });
  } catch (error) {
    logger.error('Get cache stats error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve cache statistics',
        code: 'GET_CACHE_STATS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/translation/cache/clear:
 *   post:
 *     summary: Clear translation cache
 *     tags: [Translation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared successfully
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
 */
router.post('/cache/clear', authenticateToken, async (req, res) => {
  try {
    // Only allow admins to clear cache
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: {
          message: 'Access denied. Admin role required.',
          code: 'ACCESS_DENIED'
        }
      });
    }

    translationService.clearCache();

    res.json({
      message: 'Translation cache cleared successfully'
    });
  } catch (error) {
    logger.error('Clear cache error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to clear cache',
        code: 'CLEAR_CACHE_ERROR'
      }
    });
  }
});

module.exports = router;
