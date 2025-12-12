const request = require('supertest');
const app = require('../../src/server');
const User = require('../../src/models/User');
const Question = require('../../src/models/Question');
const GeneratedQuestion = require('../../src/models/GeneratedQuestion');
const { generateTokens } = require('../../src/middlewares/auth');

describe('Generate Questions Integration', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    // Create a test teacher user
    testUser = new User({
      name: 'Test Teacher',
      email: 'teacher@example.com',
      passwordHash: 'hashedpassword',
      role: 'teacher'
    });
    await testUser.save();

    // Generate auth token
    const tokens = generateTokens(testUser);
    authToken = tokens.accessToken;
  });

  describe('POST /api/generate/question', () => {
    it('should generate a mock question successfully', async () => {
      const generateData = {
        topic: 'mathematics',
        grade: '6',
        difficulty: 0.5
      };

      const response = await request(app)
        .post('/api/generate/question?mock=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateData)
        .expect(200);

      expect(response.body).toHaveProperty('question');
      expect(response.body).toHaveProperty('generationId');
      expect(response.body).toHaveProperty('modelUsed');
      expect(response.body).toHaveProperty('latencyMs');

      expect(response.body.question).toHaveProperty('id');
      expect(response.body.question).toHaveProperty('stem');
      expect(response.body.question).toHaveProperty('choices');
      expect(response.body.question).toHaveProperty('correctIndex');
      expect(response.body.question).toHaveProperty('difficulty');
      expect(response.body.question).toHaveProperty('tags');

      expect(response.body.modelUsed).toBe('mock');
      expect(response.body.latencyMs).toBeGreaterThan(0);

      // Verify question was stored in database
      const storedQuestion = await Question.findById(response.body.question.id);
      expect(storedQuestion).toBeTruthy();
      expect(storedQuestion.isGenerated).toBe(true);
      expect(storedQuestion.generatedBy).toBe('mock');

      // Verify generation record was created
      const generationRecord = await GeneratedQuestion.findById(response.body.generationId);
      expect(generationRecord).toBeTruthy();
      expect(generationRecord.isStored).toBe(true);
      expect(generationRecord.questionId.toString()).toBe(response.body.question.id);
    });

    it('should generate different questions for different parameters', async () => {
      const params1 = {
        topic: 'mathematics',
        grade: '6',
        difficulty: 0.2
      };

      const params2 = {
        topic: 'science',
        grade: '8',
        difficulty: 0.8
      };

      const response1 = await request(app)
        .post('/api/generate/question?mock=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(params1)
        .expect(200);

      const response2 = await request(app)
        .post('/api/generate/question?mock=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(params2)
        .expect(200);

      // Questions should be different
      expect(response1.body.question.stem).not.toBe(response2.body.question.stem);
      expect(response1.body.question.topic).toBe('mathematics');
      expect(response2.body.question.topic).toBe('science');
    });

    it('should return 503 when OpenAI API key is missing and mock=false', async () => {
      // Temporarily remove API key
      const originalApiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const generateData = {
        topic: 'mathematics',
        grade: '6',
        difficulty: 0.5
      };

      const response = await request(app)
        .post('/api/generate/question')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateData)
        .expect(503);

      expect(response.body.error.code).toBe('AI_SERVICE_UNAVAILABLE');
      expect(response.body.error.message).toContain('AI service is not configured');

      // Restore API key
      if (originalApiKey) {
        process.env.OPENAI_API_KEY = originalApiKey;
      }
    });

    it('should return 401 without authentication', async () => {
      const generateData = {
        topic: 'mathematics',
        grade: '6',
        difficulty: 0.5
      };

      await request(app)
        .post('/api/generate/question?mock=true')
        .send(generateData)
        .expect(401);
    });

    it('should return 403 for student role', async () => {
      // Create a student user
      const student = new User({
        name: 'Test Student',
        email: 'student@example.com',
        passwordHash: 'hashedpassword',
        role: 'student'
      });
      await student.save();

      const tokens = generateTokens(student);
      const studentToken = tokens.accessToken;

      const generateData = {
        topic: 'mathematics',
        grade: '6',
        difficulty: 0.5
      };

      await request(app)
        .post('/api/generate/question?mock=true')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(generateData)
        .expect(403);
    });

    it('should return 400 for invalid generation data', async () => {
      const invalidData = {
        topic: '', // Empty topic
        grade: 'invalid', // Invalid grade
        difficulty: 2 // Out of range
      };

      await request(app)
        .post('/api/generate/question?mock=true')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/generate/stats', () => {
    beforeEach(async () => {
      // Create some generated question records
      const generatedQuestions = [
        {
          inputPrompt: 'Topic: mathematics, Grade: 6, Difficulty: 0.5',
          outputJSON: JSON.stringify({
            stem: 'Test question 1',
            choices: ['A', 'B', 'C', 'D'],
            correctIndex: 0,
            difficulty: 0.5,
            tags: ['math']
          }),
          modelUsed: 'mock',
          latencyMs: 50,
          parameters: {
            topic: 'mathematics',
            grade: '6',
            difficulty: 0.5
          },
          isStored: true,
          qualityScore: 0.9,
          usageCount: 5,
          successRate: 0.8
        },
        {
          inputPrompt: 'Topic: science, Grade: 7, Difficulty: 0.7',
          outputJSON: JSON.stringify({
            stem: 'Test question 2',
            choices: ['A', 'B', 'C', 'D'],
            correctIndex: 1,
            difficulty: 0.7,
            tags: ['science']
          }),
          modelUsed: 'mock',
          latencyMs: 60,
          parameters: {
            topic: 'science',
            grade: '7',
            difficulty: 0.7
          },
          isStored: true,
          qualityScore: 0.85,
          usageCount: 3,
          successRate: 0.75
        }
      ];

      for (const data of generatedQuestions) {
        const generatedQuestion = new GeneratedQuestion(data);
        await generatedQuestion.save();
      }
    });

    it('should get generation statistics successfully', async () => {
      const response = await request(app)
        .get('/api/generate/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalGenerated');
      expect(response.body).toHaveProperty('averageLatency');
      expect(response.body).toHaveProperty('averageQualityScore');
      expect(response.body).toHaveProperty('storedCount');
      expect(response.body).toHaveProperty('averageUsageCount');
      expect(response.body).toHaveProperty('averageSuccessRate');
      expect(response.body).toHaveProperty('modelPerformance');

      expect(response.body.totalGenerated).toBe(2);
      expect(response.body.storedCount).toBe(2);
      expect(response.body.modelPerformance).toHaveLength(1);
      expect(response.body.modelPerformance[0].model).toBe('mock');
    });

    it('should filter statistics by model', async () => {
      const response = await request(app)
        .get('/api/generate/stats?modelUsed=mock')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.totalGenerated).toBe(2);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/generate/stats')
        .expect(401);
    });
  });

  describe('GET /api/generate/questions', () => {
    beforeEach(async () => {
      // Create some generated question records
      const generatedQuestions = [
        {
          inputPrompt: 'Topic: mathematics, Grade: 6, Difficulty: 0.5',
          outputJSON: JSON.stringify({
            stem: 'Test question 1',
            choices: ['A', 'B', 'C', 'D'],
            correctIndex: 0,
            difficulty: 0.5,
            tags: ['math']
          }),
          modelUsed: 'mock',
          latencyMs: 50,
          parameters: {
            topic: 'mathematics',
            grade: '6',
            difficulty: 0.5
          },
          isStored: true
        },
        {
          inputPrompt: 'Topic: science, Grade: 7, Difficulty: 0.7',
          outputJSON: JSON.stringify({
            stem: 'Test question 2',
            choices: ['A', 'B', 'C', 'D'],
            correctIndex: 1,
            difficulty: 0.7,
            tags: ['science']
          }),
          modelUsed: 'mock',
          latencyMs: 60,
          parameters: {
            topic: 'science',
            grade: '7',
            difficulty: 0.7
          },
          isStored: false
        }
      ];

      for (const data of generatedQuestions) {
        const generatedQuestion = new GeneratedQuestion(data);
        await generatedQuestion.save();
      }
    });

    it('should get generated questions successfully', async () => {
      const response = await request(app)
        .get('/api/generate/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('questions');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.questions).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter by storage status', async () => {
      const response = await request(app)
        .get('/api/generate/questions?isStored=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].isStored).toBe(true);
    });

    it('should filter by topic', async () => {
      const response = await request(app)
        .get('/api/generate/questions?topic=mathematics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].parameters.topic).toBe('mathematics');
    });

    it('should filter by grade', async () => {
      const response = await request(app)
        .get('/api/generate/questions?grade=6')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].parameters.grade).toBe('6');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/generate/questions')
        .expect(401);
    });
  });
});
