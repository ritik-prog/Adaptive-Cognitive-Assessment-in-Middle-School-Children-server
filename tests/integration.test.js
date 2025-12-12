const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/server');
const User = require('../src/models/User');
const Question = require('../src/models/Question');
const Chapter = require('../src/models/Chapter');
const Topic = require('../src/models/Topic');
const AssessmentSession = require('../src/models/AssessmentSession');
const TopicPerformance = require('../src/models/TopicPerformance');
const AnswerValidator = require('../src/services/answerValidator');
const AdaptiveDifficultyEngine = require('../src/services/adaptiveDifficulty');
const translationService = require('../src/services/translationService');

describe('NCERT Chapter-wise Adaptive Assessment System - Integration Tests', () => {
  let authToken;
  let studentId;
  let teacherId;
  let chapterId;
  let topicId;
  let questionId;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test_assessment_system');
    
    // Clean up existing data
    await User.deleteMany({});
    await Question.deleteMany({});
    await Chapter.deleteMany({});
    await Topic.deleteMany({});
    await AssessmentSession.deleteMany({});
    await TopicPerformance.deleteMany({});
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Question.deleteMany({});
    await Chapter.deleteMany({});
    await Topic.deleteMany({});
    await AssessmentSession.deleteMany({});
    await TopicPerformance.deleteMany({});
    
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create test users
    const student = new User({
      name: 'Test Student',
      email: 'student@test.com',
      password: 'password123',
      role: 'student',
      grade: '6'
    });
    await student.save();
    studentId = student._id;

    const teacher = new User({
      name: 'Test Teacher',
      email: 'teacher@test.com',
      password: 'password123',
      role: 'teacher'
    });
    await teacher.save();
    teacherId = teacher._id;

    // Login and get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'student@test.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.token;

    // Create test chapter
    const chapter = new Chapter({
      class: '6',
      subject: 'Math',
      chapterNumber: 1,
      chapterName: 'Knowing Numbers',
      description: 'Introduction to numbers and number system',
      ncertReference: 'NCERT Class 6 Math Chapter 1'
    });
    await chapter.save();
    chapterId = chapter._id;

    // Create test topic
    const topic = new Topic({
      chapterId: chapterId,
      topicName: 'Natural Numbers',
      description: 'Understanding natural numbers and their properties',
      difficultyBaseline: 0.3,
      concepts: ['counting', 'ordering', 'comparison']
    });
    await topic.save();
    topicId = topic._id;

    // Update chapter with topic
    chapter.topics.push(topicId);
    await chapter.save();
  });

  describe('Chapter Management', () => {
    test('should create a new chapter', async () => {
      const chapterData = {
        class: '6',
        subject: 'Science',
        chapterNumber: 2,
        chapterName: 'Components of Food',
        description: 'Understanding different components of food',
        ncertReference: 'NCERT Class 6 Science Chapter 2'
      };

      const response = await request(app)
        .post('/api/chapters')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chapterData);

      expect(response.status).toBe(201);
      expect(response.body.chapter.chapterName).toBe(chapterData.chapterName);
    });

    test('should get chapters with filters', async () => {
      const response = await request(app)
        .get('/api/chapters?class=6&subject=Math')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.chapters).toHaveLength(1);
      expect(response.body.chapters[0].chapterName).toBe('Knowing Numbers');
    });
  });

  describe('Question Types and Answer Validation', () => {
    test('should create MCQ question', async () => {
      const questionData = {
        stem: 'What is the smallest natural number?',
        choices: ['0', '1', '2', '3'],
        correctIndex: 1,
        questionType: 'mcq',
        difficulty: 0.3,
        grade: '6',
        topic: 'Natural Numbers',
        chapterId: chapterId,
        topicId: topicId
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData);

      expect(response.status).toBe(201);
      expect(response.body.question.questionType).toBe('mcq');
      questionId = response.body.question._id;
    });

    test('should create fill-in-blank question', async () => {
      const questionData = {
        stem: 'The smallest natural number is ___',
        correctAnswer: '1',
        acceptedAnswers: ['one', '1'],
        questionType: 'fill-in-blank',
        blanksCount: 1,
        difficulty: 0.2,
        grade: '6',
        topic: 'Natural Numbers',
        chapterId: chapterId,
        topicId: topicId
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData);

      expect(response.status).toBe(201);
      expect(response.body.question.questionType).toBe('fill-in-blank');
    });

    test('should create short-answer question', async () => {
      const questionData = {
        stem: 'Explain what natural numbers are',
        correctAnswer: 'Natural numbers are counting numbers starting from 1',
        acceptedAnswers: ['counting numbers', 'positive integers', 'numbers 1,2,3...'],
        questionType: 'short-answer',
        difficulty: 0.5,
        grade: '6',
        topic: 'Natural Numbers',
        chapterId: chapterId,
        topicId: topicId
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData);

      expect(response.status).toBe(201);
      expect(response.body.question.questionType).toBe('short-answer');
    });

    test('should validate MCQ answer correctly', () => {
      const question = {
        questionType: 'mcq',
        choices: ['0', '1', '2', '3'],
        correctIndex: 1
      };

      const correctResult = AnswerValidator.validateAnswer(question, 1);
      expect(correctResult.isCorrect).toBe(true);

      const incorrectResult = AnswerValidator.validateAnswer(question, 0);
      expect(incorrectResult.isCorrect).toBe(false);
    });

    test('should validate fill-in-blank answer with fuzzy matching', () => {
      const question = {
        questionType: 'fill-in-blank',
        correctAnswer: '1',
        acceptedAnswers: ['one', '1']
      };

      const correctResult = AnswerValidator.validateAnswer(question, '1');
      expect(correctResult.isCorrect).toBe(true);

      const correctResult2 = AnswerValidator.validateAnswer(question, 'one');
      expect(correctResult2.isCorrect).toBe(true);

      const incorrectResult = AnswerValidator.validateAnswer(question, '2');
      expect(incorrectResult.isCorrect).toBe(false);
    });

    test('should validate short-answer with keyword matching', () => {
      const question = {
        questionType: 'short-answer',
        correctAnswer: 'Natural numbers are counting numbers starting from 1',
        acceptedAnswers: ['counting numbers', 'positive integers']
      };

      const correctResult = AnswerValidator.validateAnswer(question, 'counting numbers');
      expect(correctResult.isCorrect).toBe(true);

      const correctResult2 = AnswerValidator.validateAnswer(question, 'positive integers');
      expect(correctResult2.isCorrect).toBe(true);

      const incorrectResult = AnswerValidator.validateAnswer(question, 'negative numbers');
      expect(incorrectResult.isCorrect).toBe(false);
    });
  });

  describe('Assessment Modes', () => {
    test('should start assessment mode', async () => {
      const assessmentData = {
        sessionType: 'adaptive',
        mode: 'assessment',
        chapterId: chapterId,
        grade: '6',
        topic: 'Natural Numbers',
        maxQuestions: 5
      };

      const response = await request(app)
        .post('/api/assessments/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(assessmentData);

      expect(response.status).toBe(201);
      expect(response.body.session.mode).toBe('assessment');
    });

    test('should start practice mode', async () => {
      const practiceData = {
        chapterId: chapterId,
        topicId: topicId
      };

      const response = await request(app)
        .post('/api/practice/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(practiceData);

      expect(response.status).toBe(201);
      expect(response.body.session.mode).toBe('practice');
      expect(response.body.session.allowRetry).toBe(true);
    });

    test('should start revision mode', async () => {
      // First create some incorrect responses for revision
      const question = await Question.findOne({ chapterId });
      if (question) {
        const response = new Response({
          sessionId: new mongoose.Types.ObjectId(),
          questionId: question._id,
          answerIndex: 0, // Wrong answer
          correct: false,
          responseTimeMs: 5000,
          questionNumber: 1,
          difficulty: question.difficulty,
          topic: question.topic,
          studentAbility: 0.5
        });
        await response.save();
      }

      const revisionData = {
        chapterId: chapterId
      };

      const response = await request(app)
        .post('/api/revision/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(revisionData);

      expect(response.status).toBe(201);
      expect(response.body.session.mode).toBe('revision');
    });
  });

  describe('Adaptive Difficulty Engine', () => {
    test('should record attempt and update difficulty', async () => {
      const result = await AdaptiveDifficultyEngine.recordAttempt(
        studentId,
        topicId,
        true, // correct
        5000, // response time
        0.5 // difficulty
      );

      expect(result).toBeDefined();

      // Check if topic performance was created/updated
      const performance = await TopicPerformance.findOne({
        studentId,
        topicId
      });

      expect(performance).toBeDefined();
      expect(performance.attemptsCount).toBe(1);
      expect(performance.correctCount).toBe(1);
    });

    test('should get next question based on performance', async () => {
      // Create some questions
      const question1 = new Question({
        stem: 'Test question 1',
        choices: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        questionType: 'mcq',
        difficulty: 0.3,
        grade: '6',
        topic: 'Natural Numbers',
        chapterId: chapterId,
        topicId: topicId
      });
      await question1.save();

      const question2 = new Question({
        stem: 'Test question 2',
        choices: ['A', 'B', 'C', 'D'],
        correctIndex: 1,
        questionType: 'mcq',
        difficulty: 0.7,
        grade: '6',
        topic: 'Natural Numbers',
        chapterId: chapterId,
        topicId: topicId
      });
      await question2.save();

      const nextQuestion = await AdaptiveDifficultyEngine.getNextQuestion(
        studentId,
        topicId,
        []
      );

      expect(nextQuestion).toBeDefined();
      expect(nextQuestion.topicId.toString()).toBe(topicId.toString());
    });
  });

  describe('Translation Service', () => {
    test('should translate text to Hindi', async () => {
      const translatedText = await translationService.translateText(
        'What is the capital of India?',
        'hi'
      );

      expect(translatedText).toBeDefined();
      expect(typeof translatedText).toBe('string');
    });

    test('should translate question object', async () => {
      const question = {
        stem: 'What is the smallest natural number?',
        choices: ['0', '1', '2', '3'],
        correctIndex: 1,
        questionType: 'mcq'
      };

      const translatedQuestion = await translationService.translateQuestion(
        question,
        'hi'
      );

      expect(translatedQuestion.stem).toBeDefined();
      expect(translatedQuestion.choices).toHaveLength(4);
    });

    test('should translate UI text', async () => {
      const translatedText = await translationService.translateUI(
        'start_assessment',
        'hi'
      );

      expect(translatedText).toBeDefined();
      expect(translatedText).toBe('मूल्यांकन शुरू करें');
    });

    test('should get supported languages', () => {
      const languages = translationService.getSupportedLanguages();
      expect(languages).toContain('en');
      expect(languages).toContain('hi');
      expect(languages).toContain('te');
      expect(languages).toContain('ta');
    });
  });

  describe('Recommendation Engine', () => {
    test('should generate recommendation for incorrect answer', async () => {
      const question = await Question.findOne({ chapterId });
      if (question) {
        const response = await request(app)
          .post('/api/recommendations/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            studentId: studentId,
            sessionId: new mongoose.Types.ObjectId(),
            questionId: question._id,
            incorrectAnswer: 'wrong answer'
          });

        expect(response.status).toBe(201);
        expect(response.body.recommendation).toBeDefined();
      }
    });
  });

  describe('AI Chatbot', () => {
    test('should handle general question', async () => {
      const response = await request(app)
        .post('/api/chatbot/ask')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          question: 'How do I start an assessment?',
          context: 'navigation'
        });

      expect(response.status).toBe(200);
      expect(response.body.response).toBeDefined();
    });

    test('should explain a question', async () => {
      const question = await Question.findOne({ chapterId });
      if (question) {
        const response = await request(app)
          .post(`/api/chatbot/explain/${question._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            question: 'Can you explain this question?'
          });

        expect(response.status).toBe(200);
        expect(response.body.explanation).toBeDefined();
      }
    });
  });

  describe('Analytics', () => {
    test('should get chapter analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/chapters?class=6&subject=Math')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.analytics).toBeDefined();
    });

    test('should get student analytics', async () => {
      const response = await request(app)
        .get(`/api/analytics/student/${studentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.analytics).toBeDefined();
    });

    test('should get topic analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/topics?chapterId=' + chapterId)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.analytics).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid question type', async () => {
      const questionData = {
        stem: 'Test question',
        questionType: 'invalid-type',
        difficulty: 0.5,
        grade: '6',
        chapterId: chapterId,
        topicId: topicId
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData);

      expect(response.status).toBe(400);
    });

    test('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/assessments/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    test('should handle unauthorized access', async () => {
      const response = await request(app)
        .get('/api/analytics/chapters');

      expect(response.status).toBe(401);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent requests', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .get('/api/chapters')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should handle large question sets', async () => {
      // Create multiple questions
      const questions = [];
      for (let i = 0; i < 50; i++) {
        questions.push({
          stem: `Test question ${i}`,
          choices: ['A', 'B', 'C', 'D'],
          correctIndex: 0,
          questionType: 'mcq',
          difficulty: Math.random(),
          grade: '6',
          topic: 'Natural Numbers',
          chapterId: chapterId,
          topicId: topicId
        });
      }

      const response = await request(app)
        .get(`/api/questions?chapterId=${chapterId}&limit=50`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });
});
