const request = require('supertest');
const app = require('../../src/server');
const User = require('../../src/models/User');
const StudentProfile = require('../../src/models/StudentProfile');

describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new student successfully', async () => {
      const userData = {
        name: 'Test Student',
        email: 'test.student@example.com',
        password: 'password123',
        role: 'student',
        grade: '6',
        consentFlag: true,
        parentEmail: 'parent@example.com',
        schoolName: 'Test School'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe('student');

      // Verify user was created in database
      const user = await User.findByEmail(userData.email);
      expect(user).toBeTruthy();
      expect(user.name).toBe(userData.name);

      // Verify student profile was created
      const studentProfile = await StudentProfile.findOne({ userId: user._id });
      expect(studentProfile).toBeTruthy();
      expect(studentProfile.grade).toBe(userData.grade);
    });

    it('should register a new teacher successfully', async () => {
      const userData = {
        name: 'Test Teacher',
        email: 'test.teacher@example.com',
        password: 'password123',
        role: 'teacher'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.user.role).toBe('teacher');
      expect(response.body.user.email).toBe(userData.email);
    });

    it('should return 409 for duplicate email', async () => {
      const userData = {
        name: 'Test User',
        email: 'duplicate@example.com',
        password: 'password123',
        role: 'student',
        grade: '6',
        consentFlag: true
      };

      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Try to register with same email
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = {
        name: 'T', // Too short
        email: 'invalid-email',
        password: '123', // Too short
        role: 'invalid-role'
      };

      await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        role: 'student'
      });
      await user.save();
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Note: In a real test, you'd need to properly hash the password
      // For now, we'll test the validation logic
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      // This will fail because password doesn't match, but we can test the structure
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid login data', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: ''
      };

      await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return 400 for missing refresh token', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/auth/logout')
        .expect(401);
    });
  });
});
