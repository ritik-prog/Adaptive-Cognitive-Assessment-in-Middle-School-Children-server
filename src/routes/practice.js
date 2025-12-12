const express = require('express');
const AssessmentSession = require('../models/AssessmentSession');
const Question = require('../models/Question');
const Chapter = require('../models/Chapter');
const Topic = require('../models/Topic');
const Response = require('../models/Response');
const TopicPerformance = require('../models/TopicPerformance');
const AdaptiveDifficultyEngine = require('../services/adaptiveDifficulty');
const AnswerValidator = require('../services/answerValidator');
const { authenticateToken } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PracticeSession:
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
 *           enum: [practice, revision]
 *         currentQuestion:
 *           type: object
 *         progress:
 *           type: object
 *         allowRetry:
 *           type: boolean
 *         showSolutions:
 *           type: boolean
 *     PracticeProgress:
 *       type: object
 *       properties:
 *         chapterId:
 *           type: string
 *         chapterName:
 *           type: string
 *         totalQuestions:
 *           type: number
 *         attemptedQuestions:
 *           type: number
 *         correctAnswers:
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
 * /api/practice/start:
 *   post:
 *     summary: Start practice session for a chapter
 *     tags: [Practice]
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
 *                 description: Chapter ID to practice
 *               topicId:
 *                 type: string
 *                 description: Specific topic ID (optional)
 *               questionTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [mcq, fill-in-blank, short-answer]
 *                 description: Question types to include
 *               difficulty:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 description: Target difficulty level
 *     responses:
 *       201:
 *         description: Practice session started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/PracticeSession'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Chapter not found
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { chapterId, topicId, questionTypes, difficulty } = req.body;
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

    // Check for existing active practice session
    const existingSession = await AssessmentSession.findOne({
      studentId,
      chapterId,
      mode: 'practice',
      status: 'active'
    });

    if (existingSession) {
      return res.status(409).json({
        error: {
          message: 'Active practice session already exists for this chapter',
          code: 'ACTIVE_PRACTICE_SESSION_EXISTS',
          sessionId: existingSession._id
        }
      });
    }

    // Create practice session
    const sessionData = {
      studentId,
      sessionType: 'adaptive',
      mode: 'practice',
      chapterId,
      allowRetry: true,
      showSolutions: true,
      adaptiveParameters: {
        initialDifficulty: difficulty || 0.5,
        difficultyStep: 0.1,
        maxQuestions: 50, // Unlimited for practice
        minQuestions: 1,
        confidenceThreshold: 0.8
      }
    };

    const session = new AssessmentSession(sessionData);

    // Get first question
    let firstQuestion;
    if (topicId) {
      // Practice specific topic
      firstQuestion = await AdaptiveDifficultyEngine.getNextQuestion(studentId, topicId, []);
    } else {
      // Practice entire chapter
      const questions = await AdaptiveDifficultyEngine.getAdaptiveQuestionsForChapter(
        studentId, 
        chapterId, 
        1, 
        []
      );
      firstQuestion = questions[0];
    }

    if (!firstQuestion) {
      return res.status(404).json({
        error: {
          message: 'No questions available for practice',
          code: 'NO_QUESTIONS_AVAILABLE'
        }
      });
    }

    // Add first question to session
    await session.addItem(firstQuestion._id, {
      difficulty: firstQuestion.difficulty,
      topic: firstQuestion.topic
    });

    await session.save();

    logger.info(`Practice session started: ${session._id} for student ${studentId}`);

    res.status(201).json({
      session: {
        sessionId: session._id,
        chapterId: chapter._id,
        chapterName: chapter.chapterName,
        mode: 'practice',
        currentQuestion: firstQuestion,
        progress: {
          totalQuestions: 0,
          attemptedQuestions: 0,
          correctAnswers: 0
        },
        allowRetry: true,
        showSolutions: true
      }
    });
  } catch (error) {
    logger.error('Start practice session error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to start practice session',
        code: 'START_PRACTICE_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/practice/{sessionId}/answer:
 *   post:
 *     summary: Submit answer in practice mode
 *     tags: [Practice]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practice session ID
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
 *     responses:
 *       200:
 *         description: Answer submitted successfully
 *         content:
 *           application/json:
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
    const { answer, responseTimeMs = 0 } = req.body;
    const studentId = req.user._id;

    // Find practice session
    const session = await AssessmentSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Practice session not found',
          code: 'SESSION_NOT_FOUND'
        }
      });
    }

    // Verify session belongs to student and is practice mode
    if (session.studentId.toString() !== studentId.toString()) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this session',
          code: 'SESSION_ACCESS_DENIED'
        }
      });
    }

    if (session.mode !== 'practice') {
      return res.status(400).json({
        error: {
          message: 'This endpoint is only for practice sessions',
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

    // Update adaptive difficulty tracking
    if (question.topicId) {
      await AdaptiveDifficultyEngine.recordAttempt(studentId, question.topicId, isCorrect, responseTimeMs, question.difficulty);
    }

    // Get next question
    const usedQuestionIds = session.items.map(item => item.questionId);
    let nextQuestion = null;

    if (question.topicId) {
      nextQuestion = await AdaptiveDifficultyEngine.getNextQuestion(studentId, question.topicId, usedQuestionIds);
    }

    if (!nextQuestion) {
      // Get random question from chapter
      const chapterQuestions = await Question.findByCriteria({
        chapterId: session.chapterId,
        isActive: true,
        excludeIds: usedQuestionIds
      });
      
      if (chapterQuestions.length > 0) {
        nextQuestion = chapterQuestions[Math.floor(Math.random() * chapterQuestions.length)];
      }
    }

    if (nextQuestion) {
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
        totalQuestions: session.totalQuestions,
        attemptedQuestions: session.answeredQuestions,
        correctAnswers: session.correctAnswers,
        accuracy: session.answeredQuestions > 0 ? (session.correctAnswers / session.answeredQuestions) : 0
      }
    });
  } catch (error) {
    logger.error('Practice answer submission error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to submit practice answer',
        code: 'SUBMIT_PRACTICE_ANSWER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/practice/{sessionId}/solution:
 *   get:
 *     summary: Get solution for current question in practice mode
 *     tags: [Practice]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practice session ID
 *     responses:
 *       200:
 *         description: Solution retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 solution:
 *                   type: object
 *                 explanation:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session or question not found
 */
router.get('/:sessionId/solution', authenticateToken, validateObjectId('sessionId'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const studentId = req.user._id;

    const session = await AssessmentSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Practice session not found',
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

    const currentItem = session.items.find(item => !item.answeredAt);
    if (!currentItem) {
      return res.status(400).json({
        error: {
          message: 'No current question',
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

    const solution = {
      questionId: question._id,
      questionType: question.questionType,
      correctAnswer: question.correctAnswer || question.choices[question.correctIndex],
      explanation: question.explanation,
      choices: question.choices
    };

    res.json({
      solution,
      explanation: question.explanation || 'This question tests your understanding of the key concepts.'
    });
  } catch (error) {
    logger.error('Get practice solution error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve solution',
        code: 'GET_SOLUTION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/practice/{sessionId}/progress:
 *   get:
 *     summary: Get practice progress for a session
 *     tags: [Practice]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practice session ID
 *     responses:
 *       200:
 *         description: Progress retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 progress:
 *                   $ref: '#/components/schemas/PracticeProgress'
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
          message: 'Practice session not found',
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
      totalQuestions: session.totalQuestions,
      attemptedQuestions: session.answeredQuestions,
      correctAnswers: session.correctAnswers,
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
    logger.error('Get practice progress error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve practice progress',
        code: 'GET_PRACTICE_PROGRESS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/practice/student/{studentId}/progress:
 *   get:
 *     summary: Get overall practice progress for a student
 *     tags: [Practice]
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
 *         description: Student progress retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 progress:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PracticeProgress'
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
      mode: 'practice',
      status: { $in: ['completed', 'active'] }
    };

    if (chapterId) {
      query.chapterId = chapterId;
    }

    const sessions = await AssessmentSession.find(query)
      .populate('chapterId', 'chapterName class subject')
      .sort({ startedAt: -1 });

    const progress = sessions.map(session => {
      const timeSpent = session.finishedAt 
        ? session.finishedAt - session.startedAt
        : Date.now() - session.startedAt;

      return {
        sessionId: session._id,
        chapterId: session.chapterId._id,
        chapterName: session.chapterId.chapterName,
        class: session.chapterId.class,
        subject: session.chapterId.subject,
        totalQuestions: session.totalQuestions,
        attemptedQuestions: session.answeredQuestions,
        correctAnswers: session.correctAnswers,
        accuracy: session.answeredQuestions > 0 ? (session.correctAnswers / session.answeredQuestions) : 0,
        timeSpent: Math.floor(timeSpent / 1000),
        status: session.status,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt
      };
    });

    res.json({
      progress
    });
  } catch (error) {
    logger.error('Get student practice progress error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve student practice progress',
        code: 'GET_STUDENT_PRACTICE_PROGRESS_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/practice/{sessionId}/end:
 *   post:
 *     summary: End practice session
 *     tags: [Practice]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Practice session ID
 *     responses:
 *       200:
 *         description: Practice session ended successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 summary:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session not found
 */
router.post('/:sessionId/end', authenticateToken, validateObjectId('sessionId'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const studentId = req.user._id;

    const session = await AssessmentSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Practice session not found',
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

    if (session.status !== 'active') {
      return res.status(400).json({
        error: {
          message: 'Session is not active',
          code: 'SESSION_NOT_ACTIVE'
        }
      });
    }

    await session.complete();

    const summary = {
      totalQuestions: session.totalQuestions,
      attemptedQuestions: session.answeredQuestions,
      correctAnswers: session.correctAnswers,
      accuracy: session.answeredQuestions > 0 ? (session.correctAnswers / session.answeredQuestions) : 0,
      duration: session.finishedAt - session.startedAt
    };

    logger.info(`Practice session ended: ${sessionId} for student ${studentId}`);

    res.json({
      message: 'Practice session ended successfully',
      summary
    });
  } catch (error) {
    logger.error('End practice session error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to end practice session',
        code: 'END_PRACTICE_SESSION_ERROR'
      }
    });
  }
});

module.exports = router;
