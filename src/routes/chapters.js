const express = require('express');
const Chapter = require('../models/Chapter');
const Topic = require('../models/Topic');
const { authenticateToken, authorize } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Chapter:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         class:
 *           type: string
 *           enum: [6, 7]
 *         subject:
 *           type: string
 *           enum: [Math, Science, Social Science]
 *         chapterNumber:
 *           type: number
 *         chapterName:
 *           type: string
 *         description:
 *           type: string
 *         topics:
 *           type: array
 *           items:
 *             type: string
 *         ncertReference:
 *           type: string
 *         isActive:
 *           type: boolean
 *         createdBy:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         topicsCount:
 *           type: number
 *         chapterId:
 *           type: string
 *     CreateChapterRequest:
 *       type: object
 *       required:
 *         - class
 *         - subject
 *         - chapterNumber
 *         - chapterName
 *       properties:
 *         class:
 *           type: string
 *           enum: [6, 7]
 *         subject:
 *           type: string
 *           enum: [Math, Science, Social Science]
 *         chapterNumber:
 *           type: number
 *           minimum: 1
 *           maximum: 20
 *         chapterName:
 *           type: string
 *           maxLength: 200
 *         description:
 *           type: string
 *           maxLength: 1000
 *         ncertReference:
 *           type: string
 *           maxLength: 100
 *     UpdateChapterRequest:
 *       type: object
 *       properties:
 *         chapterName:
 *           type: string
 *           maxLength: 200
 *         description:
 *           type: string
 *           maxLength: 1000
 *         ncertReference:
 *           type: string
 *           maxLength: 100
 *         isActive:
 *           type: boolean
 */

/**
 * @swagger
 * /api/chapters:
 *   post:
 *     summary: Create a new chapter
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateChapterRequest'
 *     responses:
 *       201:
 *         description: Chapter created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chapter:
 *                   $ref: '#/components/schemas/Chapter'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 *       409:
 *         description: Chapter already exists
 */
router.post('/', authenticateToken, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { class: classLevel, subject, chapterNumber, chapterName, description, ncertReference } = req.body;
    const createdBy = req.user._id;

    // Check if chapter already exists
    const existingChapter = await Chapter.findOne({
      class: classLevel,
      subject,
      chapterNumber,
      isActive: true
    });

    if (existingChapter) {
      return res.status(409).json({
        error: {
          message: 'Chapter already exists for this class, subject, and chapter number',
          code: 'CHAPTER_EXISTS'
        }
      });
    }

    const chapterData = {
      class: classLevel,
      subject,
      chapterNumber,
      chapterName,
      description,
      ncertReference,
      createdBy
    };

    const chapter = new Chapter(chapterData);
    await chapter.save();

    logger.info(`Chapter created: ${chapter._id} by user ${createdBy}`);

    res.status(201).json({
      chapter
    });
  } catch (error) {
    logger.error('Create chapter error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create chapter',
        code: 'CREATE_CHAPTER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/chapters:
 *   get:
 *     summary: List chapters with filtering
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: class
 *         schema:
 *           type: string
 *           enum: [6, 7]
 *         description: Filter by class
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *           enum: [Math, Science, Social Science]
 *         description: Filter by subject
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
 *         description: Number of chapters per page
 *     responses:
 *       200:
 *         description: Chapters retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chapters:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Chapter'
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
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { class: classLevel, subject, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const criteria = {};
    if (classLevel) criteria.class = classLevel;
    if (subject) criteria.subject = subject;

    // Build query directly instead of using findByCriteria to avoid double populate
    const query = { isActive: true };
    if (classLevel) query.class = classLevel;
    if (subject) query.subject = subject;

    const chapters = await Chapter.find(query)
      .populate('topics', 'topicName description difficulty')
      .sort({ class: 1, subject: 1, chapterNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Chapter.countDocuments(query);

    res.json({
      chapters,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get chapters error:', error);
    logger.error('Error stack:', error.stack);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve chapters',
        code: 'GET_CHAPTERS_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
});

/**
 * @swagger
 * /api/chapters/{id}:
 *   get:
 *     summary: Get chapter details with topics
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Chapter ID
 *     responses:
 *       200:
 *         description: Chapter retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chapter:
 *                   $ref: '#/components/schemas/Chapter'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Chapter not found
 */
router.get('/:id', authenticateToken, validateObjectId('id'), async (req, res) => {
  try {
    const { id } = req.params;

    const chapter = await Chapter.findById(id)
      .populate('topics', 'topicName description difficulty concepts learningObjectives')
      .populate('createdBy', 'name email');

    if (!chapter) {
      return res.status(404).json({
        error: {
          message: 'Chapter not found',
          code: 'CHAPTER_NOT_FOUND'
        }
      });
    }

    res.json({
      chapter
    });
  } catch (error) {
    logger.error('Get chapter error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve chapter',
        code: 'GET_CHAPTER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/chapters/{id}:
 *   put:
 *     summary: Update chapter
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Chapter ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateChapterRequest'
 *     responses:
 *       200:
 *         description: Chapter updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chapter:
 *                   $ref: '#/components/schemas/Chapter'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 *       404:
 *         description: Chapter not found
 */
router.put('/:id', authenticateToken, authorize('teacher', 'admin'), validateObjectId('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({
        error: {
          message: 'Chapter not found',
          code: 'CHAPTER_NOT_FOUND'
        }
      });
    }

    // Update chapter fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        chapter[key] = updates[key];
      }
    });

    await chapter.save();

    logger.info(`Chapter updated: ${chapter._id} by user ${req.user._id}`);

    res.json({
      chapter
    });
  } catch (error) {
    logger.error('Update chapter error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update chapter',
        code: 'UPDATE_CHAPTER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/chapters/{id}:
 *   delete:
 *     summary: Soft delete chapter
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Chapter ID
 *     responses:
 *       200:
 *         description: Chapter deleted successfully
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
 *         description: Access denied (teachers and admins only)
 *       404:
 *         description: Chapter not found
 */
router.delete('/:id', authenticateToken, authorize('teacher', 'admin'), validateObjectId('id'), async (req, res) => {
  try {
    const { id } = req.params;

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({
        error: {
          message: 'Chapter not found',
          code: 'CHAPTER_NOT_FOUND'
        }
      });
    }

    // Soft delete
    chapter.isActive = false;
    await chapter.save();

    logger.info(`Chapter soft deleted: ${chapter._id} by user ${req.user._id}`);

    res.json({
      message: 'Chapter deleted successfully'
    });
  } catch (error) {
    logger.error('Delete chapter error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete chapter',
        code: 'DELETE_CHAPTER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/chapters/{id}/topics:
 *   post:
 *     summary: Add topic to chapter
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - topicName
 *             properties:
 *               topicName:
 *                 type: string
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               difficulty:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *               concepts:
 *                 type: array
 *                 items:
 *                   type: string
 *               learningObjectives:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Topic added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 topic:
 *                   type: object
 *                 chapter:
 *                   $ref: '#/components/schemas/Chapter'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 *       404:
 *         description: Chapter not found
 */
router.post('/:id/topics', authenticateToken, authorize('teacher', 'admin'), validateObjectId('id'), async (req, res) => {
  try {
    const { id } = req.params;
    const { topicName, description, difficulty = 0.5, concepts = [], learningObjectives = [] } = req.body;
    const createdBy = req.user._id;

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({
        error: {
          message: 'Chapter not found',
          code: 'CHAPTER_NOT_FOUND'
        }
      });
    }

    // Create topic
    const topicData = {
      chapterId: id,
      topicName,
      description,
      difficulty,
      concepts,
      learningObjectives,
      createdBy
    };

    const topic = new Topic(topicData);
    await topic.save();

    // Add topic to chapter
    await chapter.addTopic(topic._id);

    logger.info(`Topic added to chapter: ${topic._id} to chapter ${chapter._id}`);

    res.status(201).json({
      topic,
      chapter
    });
  } catch (error) {
    logger.error('Add topic to chapter error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to add topic to chapter',
        code: 'ADD_TOPIC_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/chapters/{id}/topics/{topicId}:
 *   delete:
 *     summary: Remove topic from chapter
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Chapter ID
 *       - in: path
 *         name: topicId
 *         required: true
 *         schema:
 *           type: string
 *         description: Topic ID
 *     responses:
 *       200:
 *         description: Topic removed successfully
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
 *         description: Access denied (teachers and admins only)
 *       404:
 *         description: Chapter or topic not found
 */
router.delete('/:id/topics/:topicId', authenticateToken, authorize('teacher', 'admin'), validateObjectId('id'), validateObjectId('topicId'), async (req, res) => {
  try {
    const { id, topicId } = req.params;

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({
        error: {
          message: 'Chapter not found',
          code: 'CHAPTER_NOT_FOUND'
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

    // Remove topic from chapter
    await chapter.removeTopic(topicId);

    // Soft delete topic
    topic.isActive = false;
    await topic.save();

    logger.info(`Topic removed from chapter: ${topicId} from chapter ${id}`);

    res.json({
      message: 'Topic removed successfully'
    });
  } catch (error) {
    logger.error('Remove topic from chapter error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to remove topic from chapter',
        code: 'REMOVE_TOPIC_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/chapters/statistics:
 *   get:
 *     summary: Get chapter statistics
 *     tags: [Chapters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: class
 *         schema:
 *           type: string
 *           enum: [6, 7]
 *         description: Filter by class
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *           enum: [Math, Science, Social Science]
 *         description: Filter by subject
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
 *                     totalChapters:
 *                       type: number
 *                     averageTopicsPerChapter:
 *                       type: number
 *                     subjects:
 *                       type: array
 *                       items:
 *                         type: string
 *                     classes:
 *                       type: array
 *                       items:
 *                         type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const { class: classLevel, subject } = req.query;

    const criteria = {};
    if (classLevel) criteria.class = classLevel;
    if (subject) criteria.subject = subject;

    const statistics = await Chapter.getStatistics(classLevel, subject);

    res.json({
      statistics: statistics.length > 0 ? statistics[0] : {
        totalChapters: 0,
        averageTopicsPerChapter: 0,
        subjects: [],
        classes: []
      }
    });
  } catch (error) {
    logger.error('Get chapter statistics error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve chapter statistics',
        code: 'GET_CHAPTER_STATISTICS_ERROR'
      }
    });
  }
});

module.exports = router;
