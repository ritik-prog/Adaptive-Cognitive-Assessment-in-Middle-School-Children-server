const express = require('express');
const AssessmentSession = require('../models/AssessmentSession');
const Question = require('../models/Question');
const Chapter = require('../models/Chapter');
const Response = require('../models/Response');
const TopicPerformance = require('../models/TopicPerformance');
const AnswerValidator = require('../services/answerValidator');
const { authenticateToken } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     RevisionSession:
 *       type: object
 *       properties:
 *         sessionId:
 *           type: string
 *         chapterId:
 *           type: string
 *         chapterName:
 *           type: string
 *         mode:
 *           type: string
 *           enum: [revision]
 *         currentQuestion:
 *           type: object
 *         progress:
 *           type: object
 *         allowRetry:
 *           type: boolean
 *         showSolutions:
 *           type: boolean
 *     RevisionProgress:
 *       type: object
 *       properties:
 *         chapterId:
 *           type: string
 *         chapterName:
 *           type: string
 *         totalIncorrectQuestions:
 *           type: number
 *         revisedQuestions:
 *           type: number
 *         masteredQuestions:
 *           type: number
 *         accuracy:
 *           type: number
 *         timeSpent:
 *           type: number
 *         topics:
 *           type: array
 *           items:
 *             type: object
 */

/**
 * @swagger
 * /api/revision/start:
 *   post:
 *     summary: Start revision session for a chapter
 *     tags: [Revision]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chapterId
 *             properties:
 *               chapterId:
 *                 type: string
 *                 description: Chapter ID to revise
 *               topicId:
 *                 type: string
 *                 description: Specific topic ID (optional)
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard, all]
 *                 default: all
 *                 description: Difficulty level to focus on
 *     responses:
 *       201:
 *         description: Revision session started successfully
 *         content:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/RevisionSession'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Chapter not found
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { chapterId, topicId, difficulty = 'all' } = req.body;
    const studentId = req.user._id;

    if (!chapterId) {
      return res.status(400).json({
        error: {
          message: 'chapterId is required',
          code: 'MISSING_CHAPTER_ID'
        }
      });
    }

    // Verify chapter exists
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({
        error: {
          message: 'Chapter not found',
          code: 'CHAPTER_NOT_FOUND'
        }
      });
    }

    // Check for existing active revision session
    const existingSession = await AssessmentSession.findOne({
      studentId,
      chapterId,
      mode: 'revision',
      status: 'active'
    });

    if (existingSession) {
      return res.status(409).json({
        error: {
          message: 'Active revision session already exists for this chapter',
          code: 'ACTIVE_REVISION_SESSION_EXISTS',
          sessionId: existingSession._id
        }
      });
    }

    // Get questions the student got wrong in previous sessions
    const incorrectQuestions = await getIncorrectQuestions(studentId, chapterId, topicId, difficulty);

    if (incorrectQuestions.length === 0) {
      return res.status(404).json({
        error: {
          message: 'No incorrect questions found for revision',
          code: 'NO_INCORRECT_QUESTIONS'
        }
      });
    }

    // Create revision session
    const sessionData = {
      studentId,
      sessionType: 'fixed',
      mode: 'revision',
      chapterId,
      allowRetry: true,
      showSolutions: true,
      totalQuestions: incorrectQuestions.length
    };

    const session = new AssessmentSession(sessionData);

    // Add first question to session
    const firstQuestion = incorrectQuestions[0];
    await session.addItem(firstQuestion._id, {
      difficulty: firstQuestion.difficulty,
      topic: firstQuestion.topic
    });

    await session.save();

    logger.info(`Revision session started: ${session._id} for student ${studentId}`);

    res.status(201).json({
      session: {
        sessionId: session._id,
        chapterId: chapter._id,
        chapterName: chapter.chapterName,
        mode: 'revision',
        currentQuestion: firstQuestion,
        progress: {
          totalIncorrectQuestions: incorrectQuestions.length,
          revisedQuestions: 0,
          masteredQuestions: 0
        },
        allowRetry: true,
        showSolutions: true
      }
    });
  } catch (error) {
    logger.error('Start revision session error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to start revision session',
        code: 'START_REVISION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/revision/{sessionId}/answer:
 *   post:
 *     summary: Submit answer in revision mode
 *     tags: [Revision]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Revision session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answer
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
 *               responseTimeMs:
 *                 type: number
 *                 description: Response time in milliseconds
 *               markAsMastered:
 *                 type: boolean
 *                 default: false
 *                 description: Mark question as mastered
 *     responses:
 *       200:
 *         description: Answer submitted successfully
 *         content:
 *             schema:
 *               type: object
 *               properties:
 *                 isCorrect:
 *                   type: boolean
 *                 feedback:
 *                   type: object
 *                 nextQuestion:
 *                   type: object
 *                 progress:
 *                   type: object
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session not found
 */
router.post('/:sessionId/answer', authenticateToken, validateObjectId('sessionId'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { answer, responseTimeMs = 0, markAsMastered = false } = req.body;
    const studentId = req.user._id;

    // Find revision session
    const session = await AssessmentSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Revision session not found',
          code: 'SESSION_NOT_FOUND'
        }
      });
    }

    // Verify session belongs to student and is revision mode
    if (session.studentId.toString() !== studentId.toString()) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this session',
          code: 'SESSION_ACCESS_DENIED'
        }
      });
    }

    if (session.mode !== 'revision') {
      return res.status(400).json({
        error: {
          message: 'This endpoint is only for revision sessions',
          code: 'INVALID_SESSION_MODE'
        }
      });
    }

    // Get current question
    const currentItem = session.items.find(item => !item.answeredAt);
    if (!currentItem) {
      return res.status(400).json({
        error: {
          message: 'No current question to answer',
          code: 'NO_CURRENT_QUESTION'
        }
      });
    }

    const question = await Question.findById(currentItem.questionId);
    if (!question) {
      return res.status(404).json({
        error: {
          message: 'Question not found',
          code: 'QUESTION_NOT_FOUND'
        }
      });
    }

    // Validate answer
    const validationResult = AnswerValidator.validateAnswer(question, answer);
    const feedback = AnswerValidator.getFeedback(question, answer, validationResult);

    if (!validationResult.isValid) {
      return res.status(400).json({
        error: {
          message: 'Invalid answer format',
          code: 'INVALID_ANSWER_FORMAT',
          details: validationResult.error
        }
      });
    }

    const isCorrect = validationResult.isCorrect;

    // Answer the question
    await session.answerQuestion(currentItem.questionNumber, answer, responseTimeMs, isCorrect);

    // Update correct answers count
    if (isCorrect) {
      session.correctAnswers += 1;
    }

    // Create response record
    const response = new Response({
      sessionId: session._id,
      questionId: question._id,
      answerIndex: typeof answer === 'number' ? answer : null,
      answerText: typeof answer === 'string' ? answer : null,
      correct: isCorrect,
      responseTimeMs,
      questionNumber: currentItem.questionNumber,
      difficulty: question.difficulty,
      topic: question.topic,
      studentAbility: session.estimatedAbility
    });
    await response.save();

    // Update question usage statistics
    await question.updateUsageStats(isCorrect, responseTimeMs);

    // Mark as mastered if requested and correct
    if (markAsMastered && isCorrect) {
      await markQuestionAsMastered(studentId, question._id);
    }

    // Get next question (remaining incorrect questions)
    const usedQuestionIds = session.items.map(item => item.questionId);
    const remainingQuestions = await getIncorrectQuestions(studentId, session.chapterId, null, 'all', usedQuestionIds);
    
    let nextQuestion = null;
    if (remainingQuestions.length > 0) {
      nextQuestion = remainingQuestions[0];
      await session.addItem(nextQuestion._id, {
        difficulty: nextQuestion.difficulty,
        topic: nextQuestion.topic
      });
    }

    await session.save();

    res.json({
      isCorrect,
      feedback,
      nextQuestion,
      progress: {
        totalIncorrectQuestions: session.totalQuestions,
        revisedQuestions: session.answeredQuestions,
        masteredQuestions: await getMasteredQuestionsCount(studentId, session.chapterId),
        accuracy: session.answeredQuestions > 0 ? (session.correctAnswers / session.answeredQuestions) : 0
      }
    });
  } catch (error) {
    logger.error('Revision answer submission error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to submit revision answer',
        code: 'SUBMIT_REVISION_ANSWER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/revision/{sessionId}/progress:
 *   get:
 *     summary: Get revision progress for a session
 *     tags: [Revision]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Revision session ID
 *     responses:
 *       200:
 *         description: Progress retrieved successfully
 *         content:
 *             schema:
 *               type: object
 *               properties:
 *                 progress:
 *                   $ref: '#/components/schemas/RevisionProgress'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session not found
 */
router.get('/:sessionId/progress', authenticateToken, validateObjectId('sessionId'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const studentId = req.user._id;

    const session = await AssessmentSession.findById(sessionId).populate('chapterId');
    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Revision session not found',
          code: 'SESSION_NOT_FOUND'
        }
      });
    }

    if (session.studentId.toString() !== studentId.toString()) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this session',
          code: 'SESSION_ACCESS_DENIED'
        }
      });
    }

    // Calculate time spent
    const timeSpent = session.finishedAt 
      ? session.finishedAt - session.startedAt
      : Date.now() - session.startedAt;

    const progress = {
      chapterId: session.chapterId._id,
      chapterName: session.chapterId.chapterName,
      totalIncorrectQuestions: session.totalQuestions,
      revisedQuestions: session.answeredQuestions,
      masteredQuestions: await getMasteredQuestionsCount(studentId, session.chapterId),
      accuracy: session.answeredQuestions > 0 ? (session.correctAnswers / session.answeredQuestions) : 0,
      timeSpent: Math.floor(timeSpent / 1000), // in seconds
      topics: []
    };

    // Get topic-wise performance
    const topicIds = [...new Set(session.items.map(item => item.topic))];
    for (const topicId of topicIds) {
      const topic = await Topic.findById(topicId);
      if (topic) {
        const topicQuestions = session.items.filter(item => item.topic === topicId);
        const correctAnswers = topicQuestions.filter(item => item.isCorrect).length;
        
        progress.topics.push({
          topicId: topic._id,
          topicName: topic.topicName,
          totalQuestions: topicQuestions.length,
          correctAnswers,
          accuracy: topicQuestions.length > 0 ? (correctAnswers / topicQuestions.length) : 0
        });
      }
    }

    res.json({
      progress
    });
  } catch (error) {
    logger.error('Get revision progress error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve revision progress',
        code: 'GET_REVISION_PROGRESS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/revision/student/{studentId}/progress:
 *   get:
 *     summary: Get overall revision progress for a student
 *     tags: [Revision]
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
 *         name: chapterId
 *         schema:
 *           type: string
 *         description: Filter by chapter ID
 *     responses:
 *       200:
 *         description: Student revision progress retrieved successfully
 *         content:
 *             schema:
 *               type: object
 *               properties:
 *                 progress:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RevisionProgress'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
router.get('/student/:studentId/progress', authenticateToken, validateObjectId('studentId'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { chapterId } = req.query;

    // Check if user can access this student's progress
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this student\'s progress',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const query = {
      studentId,
      mode: 'revision',
      status: { $in: ['completed', 'active'] }
    };

    if (chapterId) {
      query.chapterId = chapterId;
    }

    const sessions = await AssessmentSession.find(query)
      .populate('chapterId', 'chapterName class subject')
      .sort({ startedAt: -1 });

    const progress = await Promise.all(sessions.map(async (session) => {
      const timeSpent = session.finishedAt 
        ? session.finishedAt - session.startedAt
        : Date.now() - session.startedAt;

      return {
        sessionId: session._id,
        chapterId: session.chapterId._id,
        chapterName: session.chapterId.chapterName,
        class: session.chapterId.class,
        subject: session.chapterId.subject,
        totalIncorrectQuestions: session.totalQuestions,
        revisedQuestions: session.answeredQuestions,
        masteredQuestions: await getMasteredQuestionsCount(studentId, session.chapterId),
        accuracy: session.answeredQuestions > 0 ? (session.correctAnswers / session.answeredQuestions) : 0,
        timeSpent: Math.floor(timeSpent / 1000),
        status: session.status,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt
      };
    }));

    res.json({
      progress
    });
  } catch (error) {
    logger.error('Get student revision progress error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve student revision progress',
        code: 'GET_STUDENT_REVISION_PROGRESS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/revision/{sessionId}/master/{questionId}:
 *   post:
 *     summary: Mark question as mastered
 *     tags: [Revision]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Revision session ID
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID to mark as mastered
 *     responses:
 *       200:
 *         description: Question marked as mastered successfully
 *         content:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session or question not found
 */
router.post('/:sessionId/master/:questionId', authenticateToken, validateObjectId('sessionId'), validateObjectId('questionId'), async (req, res) => {
  try {
    const { sessionId, questionId } = req.params;
    const studentId = req.user._id;

    const session = await AssessmentSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Revision session not found',
          code: 'SESSION_NOT_FOUND'
        }
      });
    }

    if (session.studentId.toString() !== studentId.toString()) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this session',
          code: 'SESSION_ACCESS_DENIED'
        }
      });
    }

    await markQuestionAsMastered(studentId, questionId);

    res.json({
      message: 'Question marked as mastered successfully'
    });
  } catch (error) {
    logger.error('Mark question mastered error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to mark question as mastered',
        code: 'MARK_MASTERED_ERROR'
      }
    });
  }
});

// Helper functions

/**
 * Get incorrect questions for revision
 */
async function getIncorrectQuestions(studentId, chapterId, topicId, difficulty, excludeIds = []) {
  try {
    const query = {
      studentId: require('mongoose').Types.ObjectId(studentId),
      correct: false
    };

    // Add chapter filter
    const chapterQuestions = await Question.find({ chapterId, isActive: true });
    const questionIds = chapterQuestions.map(q => q._id);
    query.questionId = { $in: questionIds };

    // Add topic filter if specified
    if (topicId) {
      const topicQuestions = chapterQuestions.filter(q => q.topicId && q.topicId.toString() === topicId);
      query.questionId = { $in: topicQuestions.map(q => q._id) };
    }

    // Add difficulty filter
    if (difficulty !== 'all') {
      const difficultyMap = { easy: [0, 0.3], medium: [0.3, 0.7], hard: [0.7, 1] };
      if (difficultyMap[difficulty]) {
        const [min, max] = difficultyMap[difficulty];
        const filteredQuestions = chapterQuestions.filter(q => 
          q.difficulty >= min && q.difficulty <= max
        );
        query.questionId = { $in: filteredQuestions.map(q => q._id) };
      }
    }

    // Exclude already used questions
    if (excludeIds.length > 0) {
      query.questionId = { 
        $in: query.questionId.$in.filter(id => !excludeIds.includes(id.toString()))
      };
    }

    const incorrectResponses = await Response.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$questionId',
          wrongCount: { $sum: 1 },
          lastAttempt: { $max: '$createdAt' }
        }
      },
      {
        $sort: { wrongCount: -1, lastAttempt: -1 }
      }
    ]);

    const questionIdsToFetch = incorrectResponses.map(r => r._id);
    const questions = await Question.find({ 
      _id: { $in: questionIdsToFetch },
      isActive: true 
    });

    return questions;
  } catch (error) {
    logger.error('Error getting incorrect questions:', error);
    return [];
  }
}

/**
 * Mark question as mastered
 */
async function markQuestionAsMastered(studentId, questionId) {
  try {
    // This would typically involve updating a mastered questions collection
    // For now, we'll just log it
    logger.info(`Question ${questionId} marked as mastered for student ${studentId}`);
    return true;
  } catch (error) {
    logger.error('Error marking question as mastered:', error);
    return false;
  }
}

/**
 * Get count of mastered questions
 */
async function getMasteredQuestionsCount(studentId, chapterId) {
  try {
    // This would typically query a mastered questions collection
    // For now, return 0
    return 0;
  } catch (error) {
    logger.error('Error getting mastered questions count:', error);
    return 0;
  }
}

module.exports = router;
