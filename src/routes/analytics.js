const express = require('express');
const AssessmentSession = require('../models/AssessmentSession');
const Question = require('../models/Question');
const Chapter = require('../models/Chapter');
const Topic = require('../models/Topic');
const TopicPerformance = require('../models/TopicPerformance');
const Response = require('../models/Response');
const User = require('../models/User');
const { authenticateToken, authorize } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ChapterAnalytics:
 *       type: object
 *       properties:
 *         chapterId:
 *           type: string
 *         chapterName:
 *           type: string
 *         class:
 *           type: string
 *         subject:
 *           type: string
 *         totalStudents:
 *           type: number
 *         completedStudents:
 *           type: number
 *         averageScore:
 *           type: number
 *         averageTime:
 *           type: number
 *         difficultyDistribution:
 *           type: object
 *         topicPerformance:
 *           type: array
 *           items:
 *             type: object
 *     StudentAnalytics:
 *       type: object
 *       properties:
 *         studentId:
 *           type: string
 *         studentName:
 *           type: string
 *         totalSessions:
 *           type: number
 *         averageScore:
 *           type: number
 *         totalTimeSpent:
 *           type: number
 *         chapterProgress:
 *           type: array
 *           items:
 *             type: object
 *         weakTopics:
 *           type: array
 *           items:
 *             type: object
 *         strongTopics:
 *           type: array
 *           items:
 *             type: object
 */

/**
 * @swagger
 * /api/analytics/chapters:
 *   get:
 *     summary: Get chapter-wise analytics
 *     tags: [Analytics]
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
 *         name: chapterId
 *         schema:
 *           type: string
 *         description: Filter by specific chapter
 *     responses:
 *       200:
 *         description: Chapter analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 analytics:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChapterAnalytics'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 */
router.get('/chapters', authenticateToken, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { class: classLevel, subject, chapterId } = req.query;

    let chapters;
    if (chapterId) {
      chapters = await Chapter.findById(chapterId);
      if (!chapters) {
        return res.status(404).json({
          error: {
            message: 'Chapter not found',
            code: 'CHAPTER_NOT_FOUND'
          }
        });
      }
      chapters = [chapters];
    } else {
      const query = { isActive: true };
      if (classLevel) query.class = classLevel;
      if (subject) query.subject = subject;
      
      chapters = await Chapter.find(query).populate('topics');
    }

    const analytics = await Promise.all(chapters.map(async (chapter) => {
      // Get all sessions for this chapter
      const sessions = await AssessmentSession.find({
        chapterId: chapter._id,
        status: 'completed'
      }).populate('studentId', 'name email');

      const totalStudents = sessions.length;
      const completedStudents = sessions.filter(s => s.status === 'completed').length;
      
      const averageScore = sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + (s.correctAnswers / s.answeredQuestions), 0) / sessions.length
        : 0;

      const averageTime = sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (s.finishedAt - s.startedAt), 0) / sessions.length
        : 0;

      // Get difficulty distribution
      const difficultyDistribution = {
        easy: 0,
        medium: 0,
        hard: 0
      };

      sessions.forEach(session => {
        session.items.forEach(item => {
          if (item.difficulty <= 0.3) difficultyDistribution.easy++;
          else if (item.difficulty <= 0.7) difficultyDistribution.medium++;
          else difficultyDistribution.hard++;
        });
      });

      // Get topic performance
      const topicPerformance = await Promise.all(chapter.topics.map(async (topic) => {
        const topicSessions = sessions.filter(s => 
          s.items.some(item => item.topic === topic._id.toString())
        );

        const topicScores = topicSessions.map(session => {
          const topicItems = session.items.filter(item => item.topic === topic._id.toString());
          const correctAnswers = topicItems.filter(item => item.isCorrect).length;
          return topicItems.length > 0 ? correctAnswers / topicItems.length : 0;
        });

        const averageTopicScore = topicScores.length > 0
          ? topicScores.reduce((sum, score) => sum + score, 0) / topicScores.length
          : 0;

        return {
          topicId: topic._id,
          topicName: topic.topicName,
          totalAttempts: topicSessions.length,
          averageScore: averageTopicScore,
          difficulty: topic.difficulty
        };
      }));

      return {
        chapterId: chapter._id,
        chapterName: chapter.chapterName,
        class: chapter.class,
        subject: chapter.subject,
        totalStudents,
        completedStudents,
        averageScore: Math.round(averageScore * 100) / 100,
        averageTime: Math.round(averageTime / 1000), // in seconds
        difficultyDistribution,
        topicPerformance
      };
    }));

    res.json({
      analytics
    });
  } catch (error) {
    logger.error('Get chapter analytics error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve chapter analytics',
        code: 'GET_CHAPTER_ANALYTICS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/analytics/students:
 *   get:
 *     summary: Get student performance analytics
 *     tags: [Analytics]
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
 *         name: chapterId
 *         schema:
 *           type: string
 *         description: Filter by chapter
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of students to return
 *     responses:
 *       200:
 *         description: Student analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 analytics:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StudentAnalytics'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 */
router.get('/students', authenticateToken, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { class: classLevel, chapterId, limit = 20 } = req.query;

    // Get students who have completed sessions
    const query = { status: 'completed' };
    if (chapterId) query.chapterId = chapterId;

    const sessions = await AssessmentSession.find(query)
      .populate('studentId', 'name email role')
      .populate('chapterId', 'chapterName class subject');

    // Filter by class if specified
    const filteredSessions = classLevel 
      ? sessions.filter(s => s.chapterId && s.chapterId.class === classLevel)
      : sessions;

    // Group by student
    const studentSessions = {};
    filteredSessions.forEach(session => {
      const studentId = session.studentId._id.toString();
      if (!studentSessions[studentId]) {
        studentSessions[studentId] = {
          student: session.studentId,
          sessions: []
        };
      }
      studentSessions[studentId].sessions.push(session);
    });

    // Calculate analytics for each student
    const analytics = Object.values(studentSessions)
      .slice(0, parseInt(limit))
      .map(({ student, sessions }) => {
        const totalSessions = sessions.length;
        const averageScore = sessions.length > 0
          ? sessions.reduce((sum, s) => sum + (s.correctAnswers / s.answeredQuestions), 0) / sessions.length
          : 0;

        const totalTimeSpent = sessions.reduce((sum, s) => 
          sum + (s.finishedAt - s.startedAt), 0
        );

        // Get chapter progress
        const chapterProgress = sessions.map(session => ({
          chapterId: session.chapterId._id,
          chapterName: session.chapterId.chapterName,
          score: session.correctAnswers / session.answeredQuestions,
          timeSpent: session.finishedAt - session.startedAt,
          completedAt: session.finishedAt
        }));

        return {
          studentId: student._id,
          studentName: student.name,
          studentEmail: student.email,
          totalSessions,
          averageScore: Math.round(averageScore * 100) / 100,
          totalTimeSpent: Math.round(totalTimeSpent / 1000), // in seconds
          chapterProgress
        };
      });

    // Sort by average score descending
    analytics.sort((a, b) => b.averageScore - a.averageScore);

    res.json({
      analytics
    });
  } catch (error) {
    logger.error('Get student analytics error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve student analytics',
        code: 'GET_STUDENT_ANALYTICS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/analytics/student/{studentId}:
 *   get:
 *     summary: Get detailed analytics for a specific student
 *     tags: [Analytics]
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
 *         description: Student detailed analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 student:
 *                   type: object
 *                 analytics:
 *                   $ref: '#/components/schemas/StudentAnalytics'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Student not found
 */
router.get('/student/:studentId', authenticateToken, validateObjectId('studentId'), async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check if user can access this student's analytics
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this student\'s analytics',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        error: {
          message: 'Student not found',
          code: 'STUDENT_NOT_FOUND'
        }
      });
    }

    // Get all sessions for this student
    const sessions = await AssessmentSession.find({
      studentId,
      status: 'completed'
    }).populate('chapterId', 'chapterName class subject');

    const totalSessions = sessions.length;
    const averageScore = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.correctAnswers / s.answeredQuestions), 0) / sessions.length
      : 0;

    const totalTimeSpent = sessions.reduce((sum, s) => 
      sum + (s.finishedAt - s.startedAt), 0
    );

    // Get chapter progress - group by chapter to get best score and mark as completed
    const chapterProgressMap = new Map();
    sessions.forEach(session => {
      const chapterId = session.chapterId._id.toString();
      const existing = chapterProgressMap.get(chapterId);
      const score = session.answeredQuestions > 0 
        ? session.correctAnswers / session.answeredQuestions 
        : 0;
      
      if (!existing || score > existing.score) {
        chapterProgressMap.set(chapterId, {
          chapterId: session.chapterId._id,
          chapterName: session.chapterId.chapterName,
          class: session.chapterId.class,
          subject: session.chapterId.subject,
          score: score,
          timeSpent: (existing?.timeSpent || 0) + (session.finishedAt - session.startedAt),
          completedAt: session.finishedAt,
          completed: true, // Mark as completed if there's a session
          attempts: (existing?.attempts || 0) + 1,
          mode: session.mode
        });
      } else {
        // Update time spent and attempts
        existing.timeSpent += (session.finishedAt - session.startedAt);
        existing.attempts += 1;
      }
    });
    
    const chapterProgress = Array.from(chapterProgressMap.values());

    // Get weak and strong topics
    const topicPerformances = await TopicPerformance.find({ studentId })
      .populate('topicId', 'topicName description chapterId')
      .populate('topicId.chapterId', 'chapterName class subject');

    const weakTopics = topicPerformances
      .filter(tp => tp.averageScore < 0.4 && tp.attemptsCount >= 2)
      .map(tp => ({
        topicId: tp.topicId._id,
        topicName: tp.topicId.topicName,
        chapterName: tp.topicId.chapterId.chapterName,
        averageScore: tp.averageScore,
        attemptsCount: tp.attemptsCount,
        masteryLevel: tp.masteryLevel
      }));

    const strongTopics = topicPerformances
      .filter(tp => tp.averageScore >= 0.8 && tp.attemptsCount >= 3)
      .map(tp => ({
        topicId: tp.topicId._id,
        topicName: tp.topicId.topicName,
        chapterName: tp.topicId.chapterId.chapterName,
        averageScore: tp.averageScore,
        attemptsCount: tp.attemptsCount,
        masteryLevel: tp.masteryLevel
      }));

    res.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        role: student.role
      },
      analytics: {
        studentId: student._id,
        studentName: student.name,
        totalSessions,
        averageScore: Math.round(averageScore * 100) / 100,
        totalTimeSpent: Math.round(totalTimeSpent / 1000), // in seconds
        chapterProgress,
        weakTopics,
        strongTopics
      }
    });
  } catch (error) {
    logger.error('Get student detailed analytics error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve student detailed analytics',
        code: 'GET_STUDENT_DETAILED_ANALYTICS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/analytics/topics:
 *   get:
 *     summary: Get topic-wise analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: chapterId
 *         schema:
 *           type: string
 *         description: Filter by chapter
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
 *         description: Topic analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 analytics:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       topicId:
 *                         type: string
 *                       topicName:
 *                         type: string
 *                       chapterName:
 *                         type: string
 *                       totalStudents:
 *                         type: number
 *                       averageScore:
 *                         type: number
 *                       strugglingStudents:
 *                         type: number
 *                       masteryDistribution:
 *                         type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 */
router.get('/topics', authenticateToken, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { chapterId, class: classLevel, subject } = req.query;

    let topics;
    if (chapterId) {
      const chapter = await Chapter.findById(chapterId).populate('topics');
      topics = chapter ? chapter.topics : [];
    } else {
      const query = { isActive: true };
      if (classLevel || subject) {
        const chapterQuery = {};
        if (classLevel) chapterQuery.class = classLevel;
        if (subject) chapterQuery.subject = subject;
        
        const chapters = await Chapter.find(chapterQuery);
        const chapterIds = chapters.map(c => c._id);
        query.chapterId = { $in: chapterIds };
      }
      
      topics = await Topic.find(query).populate('chapterId', 'chapterName class subject');
    }

    const analytics = await Promise.all(topics.map(async (topic) => {
      // Get topic performance data
      const topicPerformances = await TopicPerformance.find({ topicId: topic._id });
      
      const totalStudents = topicPerformances.length;
      const averageScore = totalStudents > 0
        ? topicPerformances.reduce((sum, tp) => sum + tp.averageScore, 0) / totalStudents
        : 0;

      const strugglingStudents = topicPerformances.filter(tp => 
        tp.averageScore < 0.4 && tp.attemptsCount >= 2
      ).length;

      const masteryDistribution = {
        beginner: 0,
        developing: 0,
        proficient: 0,
        advanced: 0
      };

      topicPerformances.forEach(tp => {
        masteryDistribution[tp.masteryLevel]++;
      });

      return {
        topicId: topic._id,
        topicName: topic.topicName,
        chapterName: topic.chapterId?.chapterName || 'Unknown',
        chapterClass: topic.chapterId?.class,
        chapterSubject: topic.chapterId?.subject,
        totalStudents,
        averageScore: Math.round(averageScore * 100) / 100,
        strugglingStudents,
        masteryDistribution,
        difficulty: topic.difficulty
      };
    }));

    res.json({
      analytics
    });
  } catch (error) {
    logger.error('Get topic analytics error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve topic analytics',
        code: 'GET_TOPIC_ANALYTICS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/analytics/questions:
 *   get:
 *     summary: Get question effectiveness analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: chapterId
 *         schema:
 *           type: string
 *         description: Filter by chapter
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
 *         description: Filter by difficulty level
 *     responses:
 *       200:
 *         description: Question analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 analytics:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       questionId:
 *                         type: string
 *                       stem:
 *                         type: string
 *                       questionType:
 *                         type: string
 *                       difficulty:
 *                         type: number
 *                       usageCount:
 *                         type: number
 *                       successRate:
 *                         type: number
 *                       averageResponseTime:
 *                         type: number
 *                       discriminationIndex:
 *                         type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 */
router.get('/questions', authenticateToken, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { chapterId, questionType, difficulty } = req.query;

    const query = { isActive: true };
    if (chapterId) query.chapterId = chapterId;
    if (questionType) query.questionType = questionType;
    if (difficulty) {
      const difficultyNum = parseFloat(difficulty);
      if (!isNaN(difficultyNum)) {
        query.difficulty = {
          $gte: difficultyNum - 0.1,
          $lte: difficultyNum + 0.1
        };
      }
    }

    const questions = await Question.find(query)
      .populate('chapterId', 'chapterName class subject')
      .populate('topicId', 'topicName')
      .sort({ usageCount: -1 });

    const analytics = questions.map(question => {
      // Calculate discrimination index (simplified)
      const discriminationIndex = question.usageCount > 0 
        ? question.successRate 
        : 0;

      return {
        questionId: question._id,
        stem: question.stem.substring(0, 100) + (question.stem.length > 100 ? '...' : ''),
        questionType: question.questionType,
        difficulty: question.difficulty,
        chapterName: question.chapterId?.chapterName || 'Unknown',
        topicName: question.topicId?.topicName || 'Unknown',
        usageCount: question.usageCount,
        successRate: Math.round(question.successRate * 100) / 100,
        averageResponseTime: Math.round(question.averageResponseTime),
        discriminationIndex: Math.round(discriminationIndex * 100) / 100
      };
    });

    res.json({
      analytics
    });
  } catch (error) {
    logger.error('Get question analytics error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve question analytics',
        code: 'GET_QUESTION_ANALYTICS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/analytics/export:
 *   post:
 *     summary: Export analytics data as CSV
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [chapters, students, topics, questions]
 *                 description: Type of analytics to export
 *               filters:
 *                 type: object
 *                 description: Filters to apply
 *     responses:
 *       200:
 *         description: Analytics data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 csvData:
 *                   type: string
 *                 filename:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied (teachers and admins only)
 */
router.post('/export', authenticateToken, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { type, filters = {} } = req.body;

    if (!type) {
      return res.status(400).json({
        error: {
          message: 'Export type is required',
          code: 'MISSING_EXPORT_TYPE'
        }
      });
    }

    let csvData = '';
    let filename = '';

    switch (type) {
      case 'chapters':
        // This would generate CSV for chapter analytics
        csvData = 'Chapter Name,Class,Subject,Total Students,Average Score,Average Time\n';
        filename = 'chapter_analytics.csv';
        break;
      case 'students':
        // This would generate CSV for student analytics
        csvData = 'Student Name,Email,Total Sessions,Average Score,Total Time Spent\n';
        filename = 'student_analytics.csv';
        break;
      case 'topics':
        // This would generate CSV for topic analytics
        csvData = 'Topic Name,Chapter,Total Students,Average Score,Struggling Students\n';
        filename = 'topic_analytics.csv';
        break;
      case 'questions':
        // This would generate CSV for question analytics
        csvData = 'Question Stem,Type,Difficulty,Usage Count,Success Rate,Response Time\n';
        filename = 'question_analytics.csv';
        break;
      default:
        return res.status(400).json({
          error: {
            message: 'Invalid export type',
            code: 'INVALID_EXPORT_TYPE'
          }
        });
    }

    res.json({
      csvData,
      filename,
      message: 'Analytics data exported successfully'
    });
  } catch (error) {
    logger.error('Export analytics error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to export analytics data',
        code: 'EXPORT_ANALYTICS_ERROR'
      }
    });
  }
});

module.exports = router;
