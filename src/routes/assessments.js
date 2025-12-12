const express = require('express');
const AssessmentSession = require('../models/AssessmentSession');
const Question = require('../models/Question');
const Response = require('../models/Response');
// const StudentProfile = require('../models/StudentProfile');
const { authenticateToken } = require('../middlewares/auth');
const {
  validateStartAssessment,
  validateSubmitAnswer,
  validateObjectId
} = require('../middlewares/validation');
const logger = require('../utils/logger');
const GamificationProfile = require('../models/GamificationProfile');
const gamificationService = require('../services/gamificationService');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AssessmentSession:
 *       type: object
 *       properties:
 *         studentId:
 *           type: string
 *         startedAt:
 *           type: string
 *           format: date-time
 *         finishedAt:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [active, completed, abandoned, paused]
 *         sessionType:
 *           type: string
 *           enum: [adaptive, fixed]
 *         totalQuestions:
 *           type: number
 *         answeredQuestions:
 *           type: number
 *         correctAnswers:
 *           type: number
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               questionId:
 *                 type: string
 *               questionNumber:
 *                 type: number
 *               presentedAt:
 *                 type: string
 *                 format: date-time
 *               answeredAt:
 *                 type: string
 *                 format: date-time
 *               answerIndex:
 *                 type: number
 *               isCorrect:
 *                 type: boolean
 *               responseTimeMs:
 *                 type: number
 *               difficulty:
 *                 type: number
 *               topic:
 *                 type: string
 *         estimatedAbility:
 *           type: number
 *         completionPercentage:
 *           type: number
 *         accuracyPercentage:
 *           type: number
 *         durationMinutes:
 *           type: number
 *     StartAssessmentRequest:
 *       type: object
 *       required:
 *         - sessionType
 *         - mode
 *         - chapterId
 *       properties:
 *         sessionType:
 *           type: string
 *           enum: [adaptive, fixed]
 *         mode:
 *           type: string
 *           enum: [assessment, practice, revision]
 *         chapterId:
 *           type: string
 *           description: Chapter ID for the assessment
 *         grade:
 *           type: string
 *           enum: [6, 7, 8, 9]
 *         topic:
 *           type: string
 *         maxQuestions:
 *           type: number
 *           minimum: 5
 *           maximum: 50
 *         adaptiveParameters:
 *           type: object
 *           properties:
 *             initialDifficulty:
 *               type: number
 *               minimum: 0
 *               maximum: 1
 *             difficultyStep:
 *               type: number
 *               minimum: 0.05
 *               maximum: 0.3
 *             maxQuestions:
 *               type: number
 *               minimum: 5
 *               maximum: 50
 *             minQuestions:
 *               type: number
 *               minimum: 3
 *               maximum: 20
 *             confidenceThreshold:
 *               type: number
 *               minimum: 0.5
 *               maximum: 0.95
 *     SubmitAnswerRequest:
 *       type: object
 *       required:
 *         - answerIndex
 *         - responseTimeMs
 *       properties:
 *         answerIndex:
 *           type: integer
 *           minimum: 0
 *         responseTimeMs:
 *           type: integer
 *           minimum: 0
 *           maximum: 300000
 */

/**
 * @swagger
 * /api/assessments/start:
 *   post:
 *     summary: Start a new assessment session
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StartAssessmentRequest'
 *     responses:
 *       201:
 *         description: Assessment session started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/AssessmentSession'
 *                 firstQuestion:
 *                   $ref: '#/components/schemas/Question'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Active session already exists
 */
router.post('/start', authenticateToken, validateStartAssessment, async(req, res) => {
  try {
    const { sessionType, mode, chapterId, grade, topic, maxQuestions, adaptiveParameters } = req.body;
    const studentId = req.user._id;

    // Check if student already has an active session
    const existingSession = await AssessmentSession.findActiveByStudent(studentId);
    if (existingSession) {
      // Check if the existing session is older than 2 hours (abandoned)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      if (existingSession.startedAt < twoHoursAgo) {
        // Mark old session as abandoned
        await existingSession.abandon();
        logger.info(`Abandoned old session ${existingSession._id} for student ${studentId}`);
      } else {
        return res.status(409).json({
          error: {
            message: 'Active session already exists',
            code: 'ACTIVE_SESSION_EXISTS',
            sessionId: existingSession._id
          }
        });
      }
    }

    // Get student profile for additional context (if needed for future features)
    // const studentProfile = await StudentProfile.findOne({ userId: studentId });

    // Create new assessment session
    const sessionData = {
      studentId,
      sessionType,
      mode,
      chapterId,
      adaptiveParameters: {
        initialDifficulty: adaptiveParameters?.initialDifficulty || 0.5,
        difficultyStep: adaptiveParameters?.difficultyStep || 0.1,
        maxQuestions: maxQuestions || adaptiveParameters?.maxQuestions || 20,
        minQuestions: adaptiveParameters?.minQuestions || 5,
        confidenceThreshold: adaptiveParameters?.confidenceThreshold || 0.8
      }
    };

    const session = new AssessmentSession(sessionData);

    // Select first question based on session type and mode
    let firstQuestion;
    const AdaptiveDifficultyEngine = require('../services/adaptiveDifficulty');
    
    if (mode === 'revision') {
      // For revision mode, get questions the student got wrong previously
      firstQuestion = await getRevisionQuestion(studentId, chapterId);
    } else if (sessionType === 'adaptive') {
      // Use adaptive difficulty engine for chapter-based questions
      firstQuestion = await AdaptiveDifficultyEngine.getNextQuestion(studentId, null, []);
      if (!firstQuestion) {
        // Fallback to any question in the chapter
        firstQuestion = await getRandomChapterQuestion(chapterId, []);
      }
    } else {
      // Fixed difficulty - get random question from chapter
      firstQuestion = await getRandomChapterQuestion(chapterId, []);
    }

    if (!firstQuestion) {
      return res.status(404).json({
        error: {
          message: 'No questions available for the specified criteria',
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

    logger.info(`Assessment session started: ${session._id} for student ${studentId}`);

    res.status(201).json({
      session,
      firstQuestion: {
        id: firstQuestion._id,
        stem: firstQuestion.stem,
        choices: firstQuestion.choices,
        passage: firstQuestion.passage,
        questionNumber: 1,
        totalQuestions: session.adaptiveParameters.maxQuestions
      }
    });
  } catch (error) {
    logger.error('Start assessment error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to start assessment session',
        code: 'START_ASSESSMENT_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/assessments/{sessionId}/answer:
 *   post:
 *     summary: Submit answer for current question
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitAnswerRequest'
 *     responses:
 *       200:
 *         description: Answer submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/AssessmentSession'
 *                 nextQuestion:
 *                   $ref: '#/components/schemas/Question'
 *                 isComplete:
 *                   type: boolean
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Session not found
 *       409:
 *         description: Session not active
 */
router.post('/:sessionId/answer', authenticateToken, validateObjectId('sessionId'), validateSubmitAnswer, async(req, res) => {
  try {
    const { sessionId } = req.params;
    const { answerIndex, answer, responseTimeMs } = req.body;
    const studentId = req.user._id;

    // Find the session
    const session = await AssessmentSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        }
      });
    }

    // Verify session belongs to the student
    if (session.studentId.toString() !== studentId.toString()) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this session',
          code: 'SESSION_ACCESS_DENIED'
        }
      });
    }

    // Check if session is active
    if (session.status !== 'active') {
      return res.status(409).json({
        error: {
          message: 'Session is not active',
          code: 'SESSION_NOT_ACTIVE'
        }
      });
    }

    // Get current question (last unanswered question)
    const currentItem = session.items[session.items.length - 1];
    if (!currentItem || currentItem.answeredAt) {
      return res.status(400).json({
        error: {
          message: 'No current question to answer',
          code: 'NO_CURRENT_QUESTION'
        }
      });
    }

    // Get the question to check correctness
    const question = await Question.findById(currentItem.questionId);
    if (!question) {
      return res.status(404).json({
        error: {
          message: 'Question not found',
          code: 'QUESTION_NOT_FOUND'
        }
      });
    }

    // Validate answer based on question type
    const AnswerValidator = require('../services/answerValidator');
    const userAnswer = answer !== undefined ? answer : answerIndex;
    const validationResult = AnswerValidator.validateAnswer(question, userAnswer);
    
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
    // Get feedback for the answer
    const feedback = AnswerValidator.getFeedback(question, userAnswer, validationResult);

    // For non-MCQ questions, answerIndex might be undefined, use 0 as default
    // The actual answer is stored in the answer field for validation
    const finalAnswerIndex = answerIndex !== undefined ? answerIndex : (typeof userAnswer === 'number' ? userAnswer : 0);

    // Answer the current question
    await session.answerQuestion(currentItem.questionNumber, finalAnswerIndex, responseTimeMs, isCorrect);

    // Update correct answers count
    if (isCorrect) {
      session.correctAnswers += 1;
    }

    // Create response record
    const response = new Response({
      sessionId: session._id,
      questionId: question._id,
      answerIndex: finalAnswerIndex,
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
      const AdaptiveDifficultyEngine = require('../services/adaptiveDifficulty');
      await AdaptiveDifficultyEngine.recordAttempt(studentId, question.topicId, isCorrect, responseTimeMs, question.difficulty);
    }

    // Gamification: award per-answer points/xp
    await gamificationService.awardForAnswer({
      userId: studentId,
      isCorrect,
      difficulty: question.difficulty ?? 0.5,
      responseTimeMs
    });

    // Check if session should continue
    const shouldContinue = await shouldContinueSession(session, question);
    let nextQuestion = null;
    let isComplete = false;

    if (shouldContinue) {
      // Select next question based on mode and session type
      const usedQuestionIds = session.items.map(item => item.questionId);
      
      if (session.mode === 'revision') {
        nextQuestion = await getRevisionQuestion(studentId, session.chapterId);
      } else if (session.sessionType === 'adaptive') {
        // Use adaptive difficulty engine
        const AdaptiveDifficultyEngine = require('../services/adaptiveDifficulty');
        nextQuestion = await AdaptiveDifficultyEngine.getNextQuestion(studentId, question.topicId, usedQuestionIds);
        if (!nextQuestion) {
          // Fallback to random question from chapter
          nextQuestion = await getRandomChapterQuestion(session.chapterId, usedQuestionIds);
        }
      } else {
        // Fixed difficulty - get random question from chapter
        nextQuestion = await getRandomChapterQuestion(session.chapterId, usedQuestionIds);
      }

      if (nextQuestion) {
        await session.addItem(nextQuestion._id, {
          difficulty: nextQuestion.difficulty,
          topic: nextQuestion.topic
        });
      } else {
        isComplete = true;
      }
    } else {
      isComplete = true;
    }

    // Complete session if needed
    if (isComplete) {
      const completedSessionsBefore = await AssessmentSession.countDocuments({
        studentId,
        status: 'completed'
      });
      await session.complete();
      await gamificationService.awardForSession({
        userId: studentId,
        correctAnswers: session.correctAnswers,
        answeredQuestions: session.answeredQuestions,
        completedSessions: completedSessionsBefore + 1
      });
    }

    await session.save();

    logger.info(`Answer submitted for session ${sessionId}, question ${currentItem.questionNumber}`);

    // Build response with validation result
    const responseData = {
      success: true,
      data: {
        validationResult: {
          isValid: validationResult.isValid,
          isCorrect: validationResult.isCorrect,
          correctAnswer: validationResult.correctAnswer,
          selectedAnswer: validationResult.selectedAnswer || userAnswer,
          feedback: feedback
        },
        session: session,
        sessionStatus: isComplete ? 'completed' : 'active',
        isComplete: isComplete
      }
    };

    if (nextQuestion && !isComplete) {
      responseData.data.nextQuestion = {
        id: nextQuestion._id,
        stem: nextQuestion.stem,
        choices: nextQuestion.choices,
        passage: nextQuestion.passage,
        questionNumber: session.items.length,
        totalQuestions: session.adaptiveParameters?.maxQuestions || session.totalQuestions
      };
    }

    res.json(responseData);
  } catch (error) {
    logger.error('Submit answer error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to submit answer',
        code: 'SUBMIT_ANSWER_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/assessments/active:
 *   get:
 *     summary: Get current active session for student
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active session retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AssessmentSession'
 *       404:
 *         description: No active session found
 */
router.get('/active', authenticateToken, async(req, res) => {
  try {
    const studentId = req.user._id;
    const activeSession = await AssessmentSession.findActiveByStudent(studentId);
    
    if (!activeSession) {
      return res.status(404).json({
        error: {
          message: 'No active session found',
          code: 'NO_ACTIVE_SESSION'
        }
      });
    }

    res.json(activeSession);
  } catch (error) {
    logger.error('Get active session error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get active session',
        code: 'GET_ACTIVE_SESSION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/assessments/{sessionId}:
 *   get:
 *     summary: Get session status and history
 *     tags: [Assessments]
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
 *         description: Session retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AssessmentSession'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Session not found
 */
router.get('/:sessionId', authenticateToken, validateObjectId('sessionId'), async(req, res) => {
  try {
    const { sessionId } = req.params;
    const studentId = req.user._id;

    const session = await AssessmentSession.findById(sessionId)
      .populate('items.questionId', 'stem choices passage topic difficulty questionType correctAnswer acceptedAnswers blanksCount explanation');

    if (!session) {
      return res.status(404).json({
        error: {
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        }
      });
    }

    // Verify session belongs to the student (unless user is teacher/admin)
    if (req.user.role === 'student' && session.studentId.toString() !== studentId.toString()) {
      return res.status(403).json({
        error: {
          message: 'Access denied to this session',
          code: 'SESSION_ACCESS_DENIED'
        }
      });
    }

    // Find the current question (last unanswered question)
    let currentQuestion = null;
    if (session.items && session.items.length > 0) {
      const lastItem = session.items[session.items.length - 1];
      if (lastItem.questionId && !lastItem.answeredAt) {
        currentQuestion = {
          id: lastItem.questionId._id,
          stem: lastItem.questionId.stem,
          choices: lastItem.questionId.choices,
          passage: lastItem.questionId.passage,
          topic: lastItem.questionId.topic,
          difficulty: lastItem.questionId.difficulty,
          questionNumber: lastItem.questionNumber
        };
      }
    }

    const response = {
      ...session.toObject(),
      currentQuestion
    };

    res.json(response);
  } catch (error) {
    logger.error('Get session error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve session',
        code: 'GET_SESSION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/assessments/cleanup:
 *   post:
 *     summary: Clean up old active sessions
 *     tags: [Assessments]
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
 *                 abandonedSessions:
 *                   type: number
 *       401:
 *         description: Unauthorized
 */
router.post('/cleanup', authenticateToken, async(req, res) => {
  try {
    const studentId = req.user._id;
    
    // Find and abandon sessions older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const oldSessions = await AssessmentSession.find({
      studentId,
      status: 'active',
      startedAt: { $lt: twoHoursAgo }
    });

    let abandonedCount = 0;
    for (const session of oldSessions) {
      await session.abandon();
      abandonedCount++;
      logger.info(`Cleaned up old session ${session._id} for student ${studentId}`);
    }

    res.json({
      message: 'Cleanup completed successfully',
      abandonedSessions: abandonedCount
    });
  } catch (error) {
    logger.error('Cleanup error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to cleanup sessions',
        code: 'CLEANUP_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/assessments/abandon:
 *   post:
 *     summary: Abandon current active session
 *     tags: [Assessments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session abandoned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: No active session found
 */
router.post('/abandon', authenticateToken, async(req, res) => {
  try {
    const studentId = req.user._id;
    
    const activeSession = await AssessmentSession.findActiveByStudent(studentId);
    if (!activeSession) {
      return res.status(404).json({
        error: {
          message: 'No active session found',
          code: 'NO_ACTIVE_SESSION'
        }
      });
    }

    await activeSession.abandon();
    logger.info(`Session ${activeSession._id} abandoned by student ${studentId}`);

    res.json({
      message: 'Session abandoned successfully'
    });
  } catch (error) {
    logger.error('Abandon session error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to abandon session',
        code: 'ABANDON_ERROR'
      }
    });
  }
});

// Helper functions

async function selectAdaptiveQuestion(grade, topic, estimatedAbility, excludeQuestionIds = []) {
  const difficulty = Math.max(0.1, Math.min(0.9, estimatedAbility));

  const criteria = {
    grade,
    difficulty: { $gte: difficulty - 0.2, $lte: difficulty + 0.2 },
    isActive: true
  };

  if (topic) {
    criteria.topic = new RegExp(topic, 'i');
  }

  // Exclude questions that have already been used
  if (excludeQuestionIds.length > 0) {
    criteria._id = { $nin: excludeQuestionIds };
  }

  const questions = await Question.findByCriteria(criteria)
    .sort({ usageCount: 1, successRate: -1 })
    .limit(10);

  if (questions.length === 0) {
    // Fallback to any question for the grade
    return await Question.findOne({
      grade,
      isActive: true
    }).sort({ usageCount: 1 });
  }

  // Select question with difficulty closest to estimated ability
  return questions.reduce((closest, current) => {
    const currentDiff = Math.abs(current.difficulty - difficulty);
    const closestDiff = Math.abs(closest.difficulty - difficulty);
    return currentDiff < closestDiff ? current : closest;
  });
}

async function selectFixedQuestion(grade, topic, excludeQuestionIds = []) {
  const criteria = {
    grade,
    isActive: true
  };

  if (topic) {
    criteria.topic = new RegExp(topic, 'i');
  }

  // Exclude questions that have already been used
  if (excludeQuestionIds.length > 0) {
    criteria._id = { $nin: excludeQuestionIds };
  }

  return await Question.findOne(criteria).sort({ usageCount: 1 });
}

async function shouldContinueSession(session, _currentQuestion) {
  const { adaptiveParameters } = session;

  // Check if we've reached minimum questions
  if (session.answeredQuestions < adaptiveParameters.minQuestions) {
    return true;
  }

  // Check if we've reached maximum questions
  if (session.answeredQuestions >= adaptiveParameters.maxQuestions) {
    return false;
  }

  // For adaptive sessions, check confidence threshold
  if (session.sessionType === 'adaptive') {
    const confidence = Math.min(1, session.answeredQuestions / 10);
    return confidence < adaptiveParameters.confidenceThreshold;
  }

  // For fixed sessions, continue until max questions
  return true;
}

// New helper functions for chapter-based question selection

async function getRandomChapterQuestion(chapterId, excludeQuestionIds = []) {
  const criteria = {
    chapterId,
    isActive: true
  };

  if (excludeQuestionIds.length > 0) {
    criteria._id = { $nin: excludeQuestionIds };
  }

  return await Question.findOne(criteria).sort({ usageCount: 1 });
}

async function getRevisionQuestion(studentId, chapterId) {
  // Get questions the student got wrong in previous sessions
  const Response = require('../models/Response');
  const wrongQuestions = await Response.aggregate([
    {
      $match: {
        studentId: require('mongoose').Types.ObjectId(studentId),
        correct: false
      }
    },
    {
      $lookup: {
        from: 'questions',
        localField: 'questionId',
        foreignField: '_id',
        as: 'question'
      }
    },
    {
      $unwind: '$question'
    },
    {
      $match: {
        'question.chapterId': require('mongoose').Types.ObjectId(chapterId),
        'question.isActive': true
      }
    },
    {
      $group: {
        _id: '$questionId',
        wrongCount: { $sum: 1 },
        lastAttempt: { $max: '$createdAt' }
      }
    },
    {
      $sort: { wrongCount: -1, lastAttempt: -1 }
    },
    {
      $limit: 1
    }
  ]);

  if (wrongQuestions.length > 0) {
    return await Question.findById(wrongQuestions[0]._id);
  }

  // Fallback to random question if no wrong questions found
  return await getRandomChapterQuestion(chapterId);
}

module.exports = router;
