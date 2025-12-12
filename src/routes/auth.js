const express = require('express');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const { generateTokens, authenticateToken, authenticateRefreshToken } = require('../middlewares/auth');
const { validateRegister, validateLogin, validateRefreshToken } = require('../middlewares/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *         - role
 *       properties:
 *         name:
 *           type: string
 *           description: User's full name
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         password:
 *           type: string
 *           minLength: 6
 *           description: User's password
 *         role:
 *           type: string
 *           enum: [student, teacher, admin]
 *           description: User's role
 *         grade:
 *           type: string
 *           enum: [6, 7, 8, 9]
 *           description: Student's grade level (required for students)
 *         consentFlag:
 *           type: boolean
 *           description: Parental consent flag (required for students)
 *         parentEmail:
 *           type: string
 *           format: email
 *           description: Parent's email address (optional for students)
 *         schoolName:
 *           type: string
 *           description: School name (optional)
 *     AuthResponse:
 *       type: object
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/User'
 *         accessToken:
 *           type: string
 *           description: JWT access token
 *         refreshToken:
 *           type: string
 *           description: JWT refresh token
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *             code:
 *               type: string
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', validateRegister, async(req, res) => {
  try {
    const { name, email, password, role, grade, consentFlag, parentEmail, schoolName } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: {
          message: 'User already exists with this email',
          code: 'USER_EXISTS'
        }
      });
    }

    // Create user
    const user = new User({
      name,
      email,
      passwordHash: password, // Will be hashed by pre-save middleware
      role
    });

    await user.save();

    // Create student profile if role is student
    if (role === 'student') {
      const studentProfile = new StudentProfile({
        userId: user._id,
        grade,
        consentFlag,
        parentEmail,
        schoolName
      });
      await studentProfile.save();
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    logger.info(`User registered: ${email} (${role})`);

    res.status(201).json({
      user: user.getPublicProfile(),
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: {
        message: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', validateLogin, async(req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        error: {
          message: 'Account is deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        }
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Get user profile with grade if student
    let userProfile = user.getPublicProfile();
    if (user.role === 'student') {
      const studentProfile = await StudentProfile.findOne({ userId: user._id });
      if (studentProfile) {
        userProfile.grade = studentProfile.grade;
      }
    }

    logger.info(`User logged in: ${email}`);

    res.json({
      user: userProfile,
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: {
        message: 'Login failed',
        code: 'LOGIN_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/refresh', validateRefreshToken, authenticateRefreshToken, async(req, res) => {
  try {
    // Generate new tokens
    const { accessToken, refreshToken } = generateTokens(req.user);

    logger.info(`Token refreshed for user: ${req.user.email}`);

    res.json({
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: {
        message: 'Token refresh failed',
        code: 'REFRESH_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user (invalidate refresh token)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/logout', authenticateToken, async(req, res) => {
  try {
    // In a real implementation, you would add the refresh token to a blacklist
    // For now, we'll just return success
    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: {
        message: 'Logout failed',
        code: 'LOGOUT_ERROR'
      }
    });
  }
});

module.exports = router;
