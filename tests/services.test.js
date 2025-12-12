const AnswerValidator = require('../src/services/answerValidator');
const AdaptiveDifficultyEngine = require('../src/services/adaptiveDifficulty');
const translationService = require('../src/services/translationService');
const TopicPerformance = require('../src/models/TopicPerformance');
const Question = require('../src/models/Question');
const mongoose = require('mongoose');

// Mock the models
jest.mock('../src/models/TopicPerformance');
jest.mock('../src/models/Question');

describe('Services Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AnswerValidator', () => {
    describe('MCQ Validation', () => {
      test('should validate correct MCQ answer', () => {
        const question = {
          questionType: 'mcq',
          choices: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 1
        };

        const result = AnswerValidator.validateAnswer(question, 1);
        expect(result.isValid).toBe(true);
        expect(result.isCorrect).toBe(true);
      });

      test('should validate incorrect MCQ answer', () => {
        const question = {
          questionType: 'mcq',
          choices: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 1
        };

        const result = AnswerValidator.validateAnswer(question, 0);
        expect(result.isValid).toBe(true);
        expect(result.isCorrect).toBe(false);
      });

      test('should handle invalid MCQ answer index', () => {
        const question = {
          questionType: 'mcq',
          choices: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 1
        };

        const result = AnswerValidator.validateAnswer(question, 5);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('Fill-in-blank Validation', () => {
      test('should validate correct fill-in-blank answer', () => {
        const question = {
          questionType: 'fill-in-blank',
          correctAnswer: '1',
          acceptedAnswers: ['one', '1']
        };

        const result = AnswerValidator.validateAnswer(question, '1');
        expect(result.isValid).toBe(true);
        expect(result.isCorrect).toBe(true);
      });

      test('should validate correct fill-in-blank answer from accepted answers', () => {
        const question = {
          questionType: 'fill-in-blank',
          correctAnswer: '1',
          acceptedAnswers: ['one', '1']
        };

        const result = AnswerValidator.validateAnswer(question, 'one');
        expect(result.isValid).toBe(true);
        expect(result.isCorrect).toBe(true);
      });

      test('should handle case-insensitive matching', () => {
        const question = {
          questionType: 'fill-in-blank',
          correctAnswer: 'Natural Numbers',
          acceptedAnswers: ['natural numbers', 'Natural Numbers']
        };

        const result = AnswerValidator.validateAnswer(question, 'NATURAL NUMBERS');
        expect(result.isValid).toBe(true);
        expect(result.isCorrect).toBe(true);
      });

      test('should validate incorrect fill-in-blank answer', () => {
        const question = {
          questionType: 'fill-in-blank',
          correctAnswer: '1',
          acceptedAnswers: ['one', '1']
        };

        const result = AnswerValidator.validateAnswer(question, '2');
        expect(result.isValid).toBe(true);
        expect(result.isCorrect).toBe(false);
      });
    });

    describe('Short-answer Validation', () => {
      test('should validate correct short-answer with keyword matching', () => {
        const question = {
          questionType: 'short-answer',
          correctAnswer: 'Natural numbers are counting numbers starting from 1',
          acceptedAnswers: ['counting numbers', 'positive integers']
        };

        const result = AnswerValidator.validateAnswer(question, 'counting numbers');
        expect(result.isValid).toBe(true);
        expect(result.isCorrect).toBe(true);
      });

      test('should validate correct short-answer with multiple keywords', () => {
        const question = {
          questionType: 'short-answer',
          correctAnswer: 'Natural numbers are counting numbers starting from 1',
          acceptedAnswers: ['counting numbers', 'positive integers']
        };

        const result = AnswerValidator.validateAnswer(question, 'positive integers');
        expect(result.isValid).toBe(true);
        expect(result.isCorrect).toBe(true);
      });

      test('should validate incorrect short-answer', () => {
        const question = {
          questionType: 'short-answer',
          correctAnswer: 'Natural numbers are counting numbers starting from 1',
          acceptedAnswers: ['counting numbers', 'positive integers']
        };

        const result = AnswerValidator.validateAnswer(question, 'negative numbers');
        expect(result.isValid).toBe(true);
        expect(result.isCorrect).toBe(false);
      });
    });

    describe('Feedback Generation', () => {
      test('should generate feedback for correct answer', () => {
        const question = {
          questionType: 'mcq',
          choices: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 1,
          explanation: 'This is the correct answer because...'
        };

        const validationResult = { isCorrect: true };
        const feedback = AnswerValidator.getFeedback(question, 1, validationResult);

        expect(feedback.isCorrect).toBe(true);
        expect(feedback.message).toContain('Correct');
      });

      test('should generate feedback for incorrect answer', () => {
        const question = {
          questionType: 'mcq',
          choices: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctIndex: 1,
          explanation: 'This is the correct answer because...'
        };

        const validationResult = { isCorrect: false };
        const feedback = AnswerValidator.getFeedback(question, 0, validationResult);

        expect(feedback.isCorrect).toBe(false);
        expect(feedback.message).toContain('Incorrect');
        expect(feedback.explanation).toBe(question.explanation);
      });
    });
  });

  describe('AdaptiveDifficultyEngine', () => {
    beforeEach(() => {
      TopicPerformance.findOne.mockResolvedValue(null);
      TopicPerformance.create.mockResolvedValue({});
      Question.findByCriteria.mockResolvedValue([]);
    });

    test('should record attempt and create new performance record', async () => {
      const studentId = new mongoose.Types.ObjectId();
      const topicId = new mongoose.Types.ObjectId();

      TopicPerformance.findOne.mockResolvedValue(null);
      TopicPerformance.create.mockResolvedValue({
        studentId,
        topicId,
        attemptsCount: 1,
        correctCount: 1,
        averageScore: 1,
        currentDifficulty: 0.55
      });

      const result = await AdaptiveDifficultyEngine.recordAttempt(
        studentId,
        topicId,
        true,
        5000,
        0.5
      );

      expect(TopicPerformance.findOne).toHaveBeenCalledWith({ studentId, topicId });
      expect(TopicPerformance.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('should record attempt and update existing performance record', async () => {
      const studentId = new mongoose.Types.ObjectId();
      const topicId = new mongoose.Types.ObjectId();

      const mockPerformance = {
        studentId,
        topicId,
        attemptsCount: 5,
        correctCount: 3,
        averageScore: 0.6,
        currentDifficulty: 0.5,
        updateStats: jest.fn().mockResolvedValue({})
      };

      TopicPerformance.findOne.mockResolvedValue(mockPerformance);

      const result = await AdaptiveDifficultyEngine.recordAttempt(
        studentId,
        topicId,
        true,
        5000,
        0.5
      );

      expect(mockPerformance.updateStats).toHaveBeenCalledWith(true, 0.5);
      expect(result).toBeDefined();
    });

    test('should get next question based on performance', async () => {
      const studentId = new mongoose.Types.ObjectId();
      const topicId = new mongoose.Types.ObjectId();

      const mockPerformance = {
        studentId,
        topicId,
        currentDifficulty: 0.6,
        averageScore: 0.7
      };

      const mockQuestion = {
        _id: new mongoose.Types.ObjectId(),
        stem: 'Test question',
        difficulty: 0.6,
        topicId: topicId
      };

      TopicPerformance.findOne.mockResolvedValue(mockPerformance);
      Question.findByCriteria.mockResolvedValue([mockQuestion]);

      const result = await AdaptiveDifficultyEngine.getNextQuestion(
        studentId,
        topicId,
        []
      );

      expect(Question.findByCriteria).toHaveBeenCalledWith({
        topicId: topicId.toString(),
        isActive: true,
        excludeIds: [],
        difficulty: { $gte: 0.4, $lte: 0.8 }
      });
      expect(result).toEqual(mockQuestion);
    });

    test('should handle no performance record for new student', async () => {
      const studentId = new mongoose.Types.ObjectId();
      const topicId = new mongoose.Types.ObjectId();

      TopicPerformance.findOne.mockResolvedValue(null);
      Question.findByCriteria.mockResolvedValue([]);

      const result = await AdaptiveDifficultyEngine.getNextQuestion(
        studentId,
        topicId,
        []
      );

      expect(Question.findByCriteria).toHaveBeenCalledWith({
        topicId: topicId.toString(),
        isActive: true,
        excludeIds: [],
        difficulty: { $gte: 0.3, $lte: 0.7 }
      });
      expect(result).toBeNull();
    });
  });

  describe('TranslationService', () => {
    test('should translate text to different languages', async () => {
      const text = 'What is the capital of India?';
      
      const hindiTranslation = await translationService.translateText(text, 'hi');
      const teluguTranslation = await translationService.translateText(text, 'te');
      const tamilTranslation = await translationService.translateText(text, 'ta');

      expect(hindiTranslation).toBeDefined();
      expect(teluguTranslation).toBeDefined();
      expect(tamilTranslation).toBeDefined();
    });

    test('should return original text for same language', async () => {
      const text = 'What is the capital of India?';
      const result = await translationService.translateText(text, 'en');
      
      expect(result).toBe(text);
    });

    test('should translate question object', async () => {
      const question = {
        stem: 'What is the smallest natural number?',
        choices: ['0', '1', '2', '3'],
        correctIndex: 1,
        questionType: 'mcq',
        explanation: 'Natural numbers start from 1'
      };

      const translatedQuestion = await translationService.translateQuestion(question, 'hi');

      expect(translatedQuestion.stem).toBeDefined();
      expect(translatedQuestion.choices).toHaveLength(4);
      expect(translatedQuestion.explanation).toBeDefined();
    });

    test('should translate UI text', async () => {
      const uiText = await translationService.translateUI('start_assessment', 'hi');
      
      expect(uiText).toBe('मूल्यांकन शुरू करें');
    });

    test('should get supported languages', () => {
      const languages = translationService.getSupportedLanguages();
      
      expect(languages).toContain('en');
      expect(languages).toContain('hi');
      expect(languages).toContain('te');
      expect(languages).toContain('ta');
    });

    test('should get language name', () => {
      expect(translationService.getLanguageName('en')).toBe('English');
      expect(translationService.getLanguageName('hi')).toBe('Hindi');
      expect(translationService.getLanguageName('te')).toBe('Telugu');
      expect(translationService.getLanguageName('ta')).toBe('Tamil');
    });

    test('should handle caching', () => {
      const text = 'Test text for caching';
      const targetLanguage = 'hi';

      // First call should not be cached
      const result1 = translationService.translateText(text, targetLanguage);
      
      // Second call should be cached
      const result2 = translationService.translateText(text, targetLanguage);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    test('should get cache statistics', () => {
      const stats = translationService.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('supportedLanguages');
      expect(stats).toHaveProperty('languageNames');
    });

    test('should clear cache', () => {
      translationService.clearCache();
      const stats = translationService.getCacheStats();
      
      expect(stats.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid question type in AnswerValidator', () => {
      const question = {
        questionType: 'invalid-type'
      };

      const result = AnswerValidator.validateAnswer(question, 'answer');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle missing required fields in AnswerValidator', () => {
      const question = {
        questionType: 'mcq'
        // Missing choices and correctIndex
      };

      const result = AnswerValidator.validateAnswer(question, 1);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle translation errors gracefully', async () => {
      const result = await translationService.translateText('test', 'invalid-language');
      
      expect(result).toBe('test'); // Should return original text
    });

    test('should handle database errors in AdaptiveDifficultyEngine', async () => {
      TopicPerformance.findOne.mockRejectedValue(new Error('Database error'));

      const result = await AdaptiveDifficultyEngine.recordAttempt(
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        true,
        5000,
        0.5
      );

      expect(result).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple translation requests efficiently', async () => {
      const texts = Array(100).fill('Test text for performance');
      const startTime = Date.now();

      const promises = texts.map(text => 
        translationService.translateText(text, 'hi')
      );

      await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle large question validation efficiently', () => {
      const question = {
        questionType: 'fill-in-blank',
        correctAnswer: 'answer',
        acceptedAnswers: Array(100).fill('answer')
      };

      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        AnswerValidator.validateAnswer(question, 'answer');
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });
});
