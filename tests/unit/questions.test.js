const request = require('supertest');
const app = require('../../src/server');
const Question = require('../../src/models/Question');
const User = require('../../src/models/User');
const { generateTokens } = require('../../src/middlewares/auth');

describe('Questions API', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    // Create a test user with unique email
    const uniqueEmail = `teacher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
    testUser = new User({
      name: 'Test Teacher',
      email: uniqueEmail,
      passwordHash: 'hashedpassword',
      role: 'teacher',
      isActive: true
    });
    await testUser.save();

    // Generate auth token
    const tokens = generateTokens(testUser);
    authToken = tokens.accessToken;
  });

  describe('POST /api/questions', () => {
    it('should create a new question successfully', async () => {
      const questionData = {
        stem: 'What is 2 + 2?',
        choices: ['3', '4', '5', '6'],
        correctIndex: 1,
        difficulty: 0.2,
        tags: ['arithmetic', 'basic'],
        grade: '6',
        topic: 'mathematics'
      };

      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body.stem).toBe(questionData.stem);
      expect(response.body.choices).toEqual(questionData.choices);
      expect(response.body.correctIndex).toBe(questionData.correctIndex);
      expect(response.body.difficulty).toBe(questionData.difficulty);
      expect(response.body.grade).toBe(questionData.grade);
      expect(response.body.topic).toBe(questionData.topic);
      expect(response.body.isGenerated).toBe(false);
      expect(response.body.generatedBy).toBe('manual');
    });

    it('should return 401 without authentication', async () => {
      const questionData = {
        stem: 'What is 2 + 2?',
        choices: ['3', '4', '5', '6'],
        correctIndex: 1,
        difficulty: 0.2,
        grade: '6',
        topic: 'mathematics'
      };

      await request(app)
        .post('/api/questions')
        .send(questionData)
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

      const questionData = {
        stem: 'What is 2 + 2?',
        choices: ['3', '4', '5', '6'],
        correctIndex: 1,
        difficulty: 0.2,
        grade: '6',
        topic: 'mathematics'
      };

      await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(questionData)
        .expect(403);
    });

    it('should return 400 for invalid question data', async () => {
      const invalidData = {
        stem: 'Q', // Too short
        choices: ['A'], // Too few choices
        correctIndex: 5, // Out of range
        difficulty: 2, // Out of range
        grade: 'invalid',
        topic: ''
      };

      await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/questions', () => {
    beforeEach(async () => {
      // Create test questions
      const questions = [
        {
          stem: 'What is 2 + 2?',
          choices: ['3', '4', '5', '6'],
          correctIndex: 1,
          difficulty: 0.2,
          tags: ['arithmetic'],
          grade: '6',
          topic: 'mathematics',
          isActive: true,
          createdBy: testUser._id
        },
        {
          stem: 'What is 3 + 3?',
          choices: ['5', '6', '7', '8'],
          correctIndex: 1,
          difficulty: 0.3,
          tags: ['arithmetic'],
          grade: '6',
          topic: 'mathematics',
          isActive: true,
          createdBy: testUser._id
        }
      ];

      for (const questionData of questions) {
        const question = new Question(questionData);
        await question.save();
      }
    });

    it('should get all questions successfully', async () => {
      const response = await request(app)
        .get('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('questions');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.questions).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('should filter questions by grade', async () => {
      const response = await request(app)
        .get('/api/questions?grade=6')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.questions).toHaveLength(2);
      response.body.questions.forEach(question => {
        expect(question.grade).toBe('6');
      });
    });

    it('should filter questions by difficulty', async () => {
      const response = await request(app)
        .get('/api/questions?difficulty=0.2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
      expect(response.body.questions[0].difficulty).toBe(0.2);
    });

    it('should filter questions by topic', async () => {
      const response = await request(app)
        .get('/api/questions?topic=mathematics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.questions).toHaveLength(2);
      response.body.questions.forEach(question => {
        expect(question.topic).toBe('mathematics');
      });
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/questions')
        .expect(401);
    });
  });

  describe('GET /api/questions/:id', () => {
    let testQuestion;

    beforeEach(async () => {
      testQuestion = new Question({
        stem: 'What is 2 + 2?',
        choices: ['3', '4', '5', '6'],
        correctIndex: 1,
        difficulty: 0.2,
        tags: ['arithmetic'],
        grade: '6',
        topic: 'mathematics',
        isActive: true,
        createdBy: testUser._id
      });
      await testQuestion.save();
    });

    it('should get question by id successfully', async () => {
      const response = await request(app)
        .get(`/api/questions/${testQuestion._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body._id).toBe(testQuestion._id.toString());
      expect(response.body.stem).toBe(testQuestion.stem);
    });

    it('should return 404 for non-existent question', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(`/api/questions/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid id format', async () => {
      await request(app)
        .get('/api/questions/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('PUT /api/questions/:id', () => {
    let testQuestion;

    beforeEach(async () => {
      testQuestion = new Question({
        stem: 'What is 2 + 2?',
        choices: ['3', '4', '5', '6'],
        correctIndex: 1,
        difficulty: 0.2,
        tags: ['arithmetic'],
        grade: '6',
        topic: 'mathematics',
        isActive: true,
        createdBy: testUser._id
      });
      await testQuestion.save();
    });

    it('should update question successfully', async () => {
      const updateData = {
        stem: 'What is 2 + 3?',
        difficulty: 0.3
      };

      const response = await request(app)
        .put(`/api/questions/${testQuestion._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.stem).toBe(updateData.stem);
      expect(response.body.difficulty).toBe(updateData.difficulty);
    });

    it('should return 404 for non-existent question', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .put(`/api/questions/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stem: 'Updated question' })
        .expect(404);
    });
  });

  describe('DELETE /api/questions/:id', () => {
    let testQuestion;

    beforeEach(async () => {
      testQuestion = new Question({
        stem: 'What is 2 + 2?',
        choices: ['3', '4', '5', '6'],
        correctIndex: 1,
        difficulty: 0.2,
        tags: ['arithmetic'],
        grade: '6',
        topic: 'mathematics',
        isActive: true,
        createdBy: testUser._id
      });
      await testQuestion.save();
    });

    it('should delete question successfully (admin only)', async () => {
      // Create admin user
      const admin = new User({
        name: 'Test Admin',
        email: 'admin@example.com',
        passwordHash: 'hashedpassword',
        role: 'admin'
      });
      await admin.save();

      const tokens = generateTokens(admin);
      const adminToken = tokens.accessToken;

      const response = await request(app)
        .delete(`/api/questions/${testQuestion._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Question deleted successfully');

      // Verify question is soft deleted
      const deletedQuestion = await Question.findById(testQuestion._id);
      expect(deletedQuestion.isActive).toBe(false);
    });

    it('should return 403 for non-admin users', async () => {
      await request(app)
        .delete(`/api/questions/${testQuestion._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });
});
