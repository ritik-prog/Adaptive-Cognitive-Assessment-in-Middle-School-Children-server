const express = require('express');
const { authenticateToken } = require('../middlewares/auth');
const { badgeCatalog } = require('../services/badgeCatalog');
const gamificationService = require('../services/gamificationService');

const router = express.Router();

/**
 * @swagger
 * /api/gamification/profile:
 *   get:
 *     summary: Get gamification profile for current user
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gamification profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', authenticateToken, async(req, res) => {
  try {
    const userId = req.user._id;
    const profile = await gamificationService.getProfile(userId);
    const levelProgress = gamificationService.calculateLevel(profile.xp);

    res.json({
      profile: {
        userId: profile.userId,
        points: profile.points,
        xp: profile.xp,
        level: profile.level,
        streak: profile.streak,
        badges: profile.badges,
        events: profile.events,
        levelProgress
      }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        message: 'Failed to fetch gamification profile',
        code: 'GAMIFICATION_PROFILE_ERROR'
      }
    });
  }
});

/**
 * @swagger
 * /api/gamification/badges:
 *   get:
 *     summary: Get badge catalog
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Badge catalog retrieved successfully
 */
router.get('/badges', authenticateToken, (req, res) => {
  res.json({ badges: badgeCatalog });
});

module.exports = router;
