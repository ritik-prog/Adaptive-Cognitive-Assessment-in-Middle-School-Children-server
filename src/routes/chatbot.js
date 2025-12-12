const express = require('express');
const { generateQuestion } = require('../services/llmClient');
const Question = require('../models/Question');
const Chapter = require('../models/Chapter');
const Topic = require('../models/Topic');
const { authenticateToken } = require('../middlewares/auth');
const { validateObjectId } = require('../middlewares/validation');
const logger = require('../utils/logger');
const OpenAI = require('openai');

// Initialize OpenAI client
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
} else {
  logger.warn('OpenAI API key not configured. Chatbot will use fallback responses.');
}

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatbotRequest:
 *       type: object
 *       required:
 *         - message
 *       properties:
 *         message:
 *           type: string
 *           description: User's message to the chatbot
 *         context:
 *           type: object
 *           properties:
 *             page:
 *               type: string
 *               description: Current page the user is on
 *             questionId:
 *               type: string
 *               description: Current question ID if applicable
 *             chapterId:
 *               type: string
 *               description: Current chapter ID if applicable
 *             topicId:
 *               type: string
 *               description: Current topic ID if applicable
 *     ChatbotResponse:
 *       type: object
 *       properties:
 *         response:
 *           type: string
 *           description: Bot's response message
 *         suggestions:
 *           type: array
 *           items:
 *             type: string
 *           description: Suggested follow-up questions or actions
 *         context:
 *           type: object
 *           description: Additional context or resources
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/chatbot/ask:
 *   post:
 *     summary: Ask AI assistant for help
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatbotRequest'
 *     responses:
 *       200:
 *         description: Bot response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatbotResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/ask', authenticateToken, async (req, res) => {
  try {
    // Support both 'message' and 'question' field names for compatibility
    const { message, question, context = {} } = req.body;
    const userMessage = message || question;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!userMessage || userMessage.trim().length === 0) {
      return res.status(400).json({
        error: {
          message: 'Message or question is required',
          code: 'MISSING_MESSAGE'
        }
      });
    }

    // Build context information for the AI
    let contextInfo = '';
    if (context.questionId) {
      const question = await Question.findById(context.questionId).populate('topicId chapterId');
      if (question) {
        contextInfo += `\nCurrent Question Context:\n- Topic: ${question.topicId?.topicName || question.topic}\n- Chapter: ${question.chapterId?.chapterName || 'N/A'}\n- Difficulty: ${question.difficulty}\n`;
      }
    }
    if (context.chapterId) {
      const chapter = await Chapter.findById(context.chapterId);
      if (chapter) {
        contextInfo += `\nCurrent Chapter: ${chapter.chapterName}\n`;
      }
    }
    if (context.topicId) {
      const topic = await Topic.findById(context.topicId);
      if (topic) {
        contextInfo += `\nCurrent Topic: ${topic.topicName}\n`;
      }
    }

    // Generate response using OpenAI if available, otherwise use fallback
    let aiResponse;
    if (openai) {
      try {
        const systemPrompt = `You are a helpful AI learning assistant for middle school students (grades 6-9). Your role is to:
- Explain concepts clearly and age-appropriately
- Help students understand questions and problems
- Provide study tips and learning strategies
- Guide students through the learning platform
- Be encouraging and supportive

User Role: ${userRole}
${contextInfo}

Keep responses concise (2-3 sentences), friendly, and focused on helping the student learn.`;

        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          max_tokens: 300,
          temperature: 0.7
        });

        aiResponse = completion.choices[0].message.content.trim();
      } catch (openaiError) {
        logger.error('OpenAI API error:', openaiError);
        // Fall back to rule-based response if OpenAI fails
        const fallbackResponse = await generateContextualResponse(userMessage, context, userRole, userId);
        aiResponse = fallbackResponse.message;
      }
    } else {
      // Use rule-based fallback if OpenAI is not configured
      const fallbackResponse = await generateContextualResponse(userMessage, context, userRole, userId);
      aiResponse = fallbackResponse.message;
    }

    // Generate suggestions based on the response
    const suggestions = generateSuggestions(userMessage, context, userRole);

    logger.info(`Chatbot response generated for user ${userId}`);

    res.json({
      success: true,
      data: {
        response: aiResponse,
        suggestions: suggestions,
        context: context,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Chatbot ask error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to generate bot response',
        code: 'CHATBOT_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * @swagger
 * /api/chatbot/explain/{questionId}:
 *   post:
 *     summary: Get explanation for a specific question
 *     tags: [Chatbot]
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               specificAspect:
 *                 type: string
 *                 description: Specific aspect to explain (e.g., "solution method", "concept")
 *     responses:
 *       200:
 *         description: Question explanation generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatbotResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Question not found
 */
router.post('/explain/:questionId', authenticateToken, validateObjectId('questionId'), async (req, res) => {
  try {
    const { questionId } = req.params;
    const { specificAspect } = req.body;
    const userId = req.user._id;

    const question = await Question.findById(questionId)
      .populate('topicId', 'topicName description')
      .populate('chapterId', 'chapterName class subject');

    if (!question) {
      return res.status(404).json({
        error: {
          message: 'Question not found',
          code: 'QUESTION_NOT_FOUND'
        }
      });
    }

    const explanation = await generateQuestionExplanation(question, specificAspect);

    res.json({
      response: explanation.message,
      suggestions: explanation.suggestions,
      context: {
        questionId: question._id,
        topic: question.topicId?.topicName || question.topic,
        chapter: question.chapterId?.chapterName,
        difficulty: question.difficultyLevel
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Chatbot explain error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to generate question explanation',
        code: 'EXPLAIN_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/chatbot/help/{topic}:
 *   post:
 *     summary: Get topic-specific help
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: topic
 *         required: true
 *         schema:
 *           type: string
 *         description: Topic name or ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               helpType:
 *                 type: string
 *                 enum: [concepts, examples, practice, resources]
 *                 description: Type of help needed
 *     responses:
 *       200:
 *         description: Topic help generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatbotResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Topic not found
 */
router.post('/help/:topic', authenticateToken, async (req, res) => {
  try {
    const { topic } = req.params;
    const { helpType = 'concepts' } = req.body;
    const userId = req.user._id;

    // Try to find topic by ID first, then by name
    let topicData = await Topic.findById(topic);
    if (!topicData) {
      topicData = await Topic.findOne({ topicName: new RegExp(topic, 'i') });
    }

    if (!topicData) {
      return res.status(404).json({
        error: {
          message: 'Topic not found',
          code: 'TOPIC_NOT_FOUND'
        }
      });
    }

    const help = await generateTopicHelp(topicData, helpType, userId);

    res.json({
      response: help.message,
      suggestions: help.suggestions,
      context: {
        topicId: topicData._id,
        topicName: topicData.topicName,
        difficulty: topicData.difficultyLevel,
        concepts: topicData.concepts
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Chatbot help error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to generate topic help',
        code: 'HELP_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/chatbot/navigation:
 *   post:
 *     summary: Get navigation help
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPage:
 *                 type: string
 *                 description: Current page the user is on
 *               goal:
 *                 type: string
 *                 description: What the user wants to do
 *     responses:
 *       200:
 *         description: Navigation help generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatbotResponse'
 *       401:
 *         description: Unauthorized
 */
router.post('/navigation', authenticateToken, async (req, res) => {
  try {
    const { currentPage, goal } = req.body;
    const userRole = req.user.role;

    const navigationHelp = await generateNavigationHelp(currentPage, goal, userRole);

    res.json({
      response: navigationHelp.message,
      suggestions: navigationHelp.suggestions,
      context: {
        currentPage,
        goal,
        userRole
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Chatbot navigation error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to generate navigation help',
        code: 'NAVIGATION_ERROR'
      }
    });
  }
});

// Helper functions

/**
 * Generate contextual response based on user message and context
 */
async function generateContextualResponse(message, context, userRole, userId) {
  try {
    const lowerMessage = message.toLowerCase();

    // Handle different types of requests
    if (lowerMessage.includes('explain') || lowerMessage.includes('how') || lowerMessage.includes('what')) {
      return await handleExplanationRequest(message, context, userRole);
    } else if (lowerMessage.includes('help') || lowerMessage.includes('stuck') || lowerMessage.includes('confused')) {
      return await handleHelpRequest(message, context, userRole);
    } else if (lowerMessage.includes('practice') || lowerMessage.includes('exercise') || lowerMessage.includes('question')) {
      return await handlePracticeRequest(message, context, userRole);
    } else if (lowerMessage.includes('navigate') || lowerMessage.includes('where') || lowerMessage.includes('go to')) {
      return await handleNavigationRequest(message, context, userRole);
    } else {
      return await handleGeneralRequest(message, context, userRole);
    }
  } catch (error) {
    logger.error('Error generating contextual response:', error);
    return {
      message: "I'm sorry, I'm having trouble understanding your request. Could you please rephrase it or ask me something more specific?",
      suggestions: [
        "Ask me to explain a concept",
        "Request help with a specific topic",
        "Ask for practice questions",
        "Get navigation help"
      ],
      context: {}
    };
  }
}

/**
 * Handle explanation requests
 */
async function handleExplanationRequest(message, context, userRole) {
  if (context.questionId) {
    const question = await Question.findById(context.questionId).populate('topicId chapterId');
    if (question) {
      return {
        message: `Let me explain this question about ${question.topicId?.topicName || question.topic}:\n\n${question.explanation || 'This question tests your understanding of the key concepts. Make sure you understand the fundamental principles before attempting to solve it.'}`,
        suggestions: [
          "Show me step-by-step solution",
          "Explain the underlying concept",
          "Give me similar practice questions",
          "What should I focus on?"
        ],
        context: {
          questionId: question._id,
          topic: question.topicId?.topicName || question.topic
        }
      };
    }
  }

  return {
    message: "I'd be happy to explain! Could you please specify what you'd like me to explain? For example:\n• A specific question\n• A particular concept\n• A topic you're studying",
    suggestions: [
      "Explain a specific question",
      "Help with a concept",
      "Clarify a topic",
      "Show me examples"
    ],
    context: {}
  };
}

/**
 * Handle help requests
 */
async function handleHelpRequest(message, context, userRole) {
  if (context.topicId) {
    const topic = await Topic.findById(context.topicId).populate('chapterId');
    if (topic) {
      return {
        message: `I can help you with ${topic.topicName}! Here are some ways I can assist:\n\n• Explain the key concepts\n• Provide practice questions\n• Share learning resources\n• Give study tips`,
        suggestions: [
          "Explain the concepts",
          "Show me practice questions",
          "Give me study tips",
          "Share learning resources"
        ],
        context: {
          topicId: topic._id,
          topicName: topic.topicName,
          chapter: topic.chapterId?.chapterName
        }
      };
    }
  }

  return {
    message: "I'm here to help! What specific topic or concept are you struggling with? I can:\n\n• Explain difficult concepts\n• Provide practice questions\n• Share study strategies\n• Help with navigation",
    suggestions: [
      "Help with a specific topic",
      "Explain a concept",
      "Get practice questions",
      "Learn study strategies"
    ],
    context: {}
  };
}

/**
 * Handle practice requests
 */
async function handlePracticeRequest(message, context, userRole) {
  if (context.chapterId) {
    const chapter = await Chapter.findById(context.chapterId).populate('topics');
    if (chapter) {
      return {
        message: `Great! I can help you practice ${chapter.chapterName}. Here are some options:\n\n• Start a practice session\n• Try specific question types\n• Focus on weak areas\n• Get adaptive questions`,
        suggestions: [
          "Start practice session",
          "Try MCQ questions",
          "Practice fill-in-blank",
          "Work on short answers"
        ],
        context: {
          chapterId: chapter._id,
          chapterName: chapter.chapterName,
          topics: chapter.topics.map(t => t.topicName)
        }
      };
    }
  }

  return {
    message: "I'd love to help you practice! What would you like to practice?\n\n• A specific chapter\n• A particular topic\n• Different question types\n• Your weak areas",
    suggestions: [
      "Practice a chapter",
      "Work on a topic",
      "Try different question types",
      "Focus on weak areas"
    ],
    context: {}
  };
}

/**
 * Handle navigation requests
 */
async function handleNavigationRequest(message, context, userRole) {
  const roleBasedNavigation = {
    student: [
      "Go to Dashboard",
      "Start Assessment",
      "Practice Mode",
      "View Progress",
      "Check Recommendations"
    ],
    teacher: [
      "Go to Dashboard",
      "Manage Chapters",
      "Create Questions",
      "View Analytics",
      "Student Reports"
    ],
    admin: [
      "Go to Dashboard",
      "User Management",
      "System Settings",
      "Analytics Overview",
      "Content Management"
    ]
  };

  const suggestions = roleBasedNavigation[userRole] || roleBasedNavigation.student;

  return {
    message: `I can help you navigate the system! Based on your role (${userRole}), here are some common destinations:\n\n${suggestions.map(s => `• ${s}`).join('\n')}`,
    suggestions: suggestions,
    context: {
      userRole,
      currentPage: context.page
    }
  };
}

/**
 * Handle general requests
 */
async function handleGeneralRequest(message, context, userRole) {
  return {
    message: "Hello! I'm your AI learning assistant. I can help you with:\n\n• Explaining concepts and questions\n• Providing practice materials\n• Offering study strategies\n• Helping with navigation\n\nWhat would you like to know?",
    suggestions: [
      "Explain a concept",
      "Help with a question",
      "Get practice questions",
      "Learn study tips",
      "Navigation help"
    ],
    context: {}
  };
}

/**
 * Generate question explanation
 */
async function generateQuestionExplanation(question, specificAspect) {
  const explanation = question.explanation || 'This question tests your understanding of the key concepts.';
  
  let message = `Here's an explanation for this question:\n\n${explanation}`;
  
  if (specificAspect === 'solution method') {
    message += `\n\n**Solution Method:**\n1. Read the question carefully\n2. Identify what's being asked\n3. Apply the appropriate method\n4. Check your answer`;
  } else if (specificAspect === 'concept') {
    message += `\n\n**Key Concept:** This question is testing your understanding of ${question.topicId?.topicName || question.topic}.`;
  }

  return {
    message,
    suggestions: [
      "Show step-by-step solution",
      "Explain the concept further",
      "Give me similar questions",
      "What should I practice?"
    ]
  };
}

/**
 * Generate topic help
 */
async function generateTopicHelp(topic, helpType, userId) {
  let message = `I can help you with ${topic.topicName}! `;
  
  switch (helpType) {
    case 'concepts':
      message += `Here are the key concepts:\n\n${topic.concepts.map(c => `• ${c}`).join('\n')}`;
      break;
    case 'examples':
      message += `Let me show you some examples related to this topic.`;
      break;
    case 'practice':
      message += `I can provide practice questions for this topic.`;
      break;
    case 'resources':
      message += `Here are some helpful resources for learning this topic.`;
      break;
    default:
      message += `What specific help do you need with this topic?`;
  }

  return {
    message,
    suggestions: [
      "Explain the concepts",
      "Show me examples",
      "Give me practice questions",
      "Share learning resources"
    ]
  };
}

/**
 * Generate navigation help
 */
async function generateNavigationHelp(currentPage, goal, userRole) {
  let message = "I can help you navigate! ";
  
  if (goal) {
    message += `To ${goal}, you can:`;
  } else {
    message += "Here are some common navigation options:";
  }

  const roleBasedOptions = {
    student: [
      "Dashboard - View your progress and start assessments",
      "Practice - Work on specific topics without pressure",
      "Assessments - Take formal tests and track performance",
      "Recommendations - See personalized learning suggestions"
    ],
    teacher: [
      "Dashboard - Overview of your classes and students",
      "Chapters - Manage course content and structure",
      "Questions - Create and manage question bank",
      "Analytics - View student performance and insights"
    ],
    admin: [
      "Dashboard - System overview and management",
      "Users - Manage students, teachers, and administrators",
      "Content - Oversee all educational content",
      "Analytics - System-wide performance metrics"
    ]
  };

  const options = roleBasedOptions[userRole] || roleBasedOptions.student;
  message += `\n\n${options.map(opt => `• ${opt}`).join('\n')}`;

  return {
    message,
    suggestions: [
      "Go to Dashboard",
      "Start an Assessment",
      "Practice a Topic",
      "View Progress"
    ]
  };
}

/**
 * Generate contextual suggestions based on user message and context
 */
function generateSuggestions(message, context, userRole) {
  const lowerMessage = message.toLowerCase();
  const suggestions = [];

  if (lowerMessage.includes('explain') || lowerMessage.includes('how') || lowerMessage.includes('what')) {
    suggestions.push('Show me step-by-step solution', 'Explain the underlying concept', 'Give me similar practice questions');
  } else if (lowerMessage.includes('help') || lowerMessage.includes('stuck') || lowerMessage.includes('confused')) {
    suggestions.push('Help with a specific topic', 'Explain a concept', 'Get practice questions', 'Learn study strategies');
  } else if (lowerMessage.includes('practice') || lowerMessage.includes('exercise') || lowerMessage.includes('question')) {
    suggestions.push('Start practice session', 'Try MCQ questions', 'Practice fill-in-blank', 'Work on short answers');
  } else if (lowerMessage.includes('navigate') || lowerMessage.includes('where') || lowerMessage.includes('go to')) {
    if (userRole === 'student') {
      suggestions.push('Go to Dashboard', 'Start Assessment', 'Practice Mode', 'View Progress');
    } else if (userRole === 'teacher') {
      suggestions.push('Go to Dashboard', 'Manage Chapters', 'Create Questions', 'View Analytics');
    } else {
      suggestions.push('Go to Dashboard', 'User Management', 'System Settings', 'Analytics Overview');
    }
  } else {
    suggestions.push('Explain a concept', 'Help with a question', 'Get practice questions', 'Learn study tips');
  }

  return suggestions.slice(0, 4); // Return max 4 suggestions
}

module.exports = router;
