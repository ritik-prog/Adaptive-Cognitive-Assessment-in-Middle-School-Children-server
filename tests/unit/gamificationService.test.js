const gamificationService = require('../../src/services/gamificationService');
const GamificationProfile = require('../../src/models/GamificationProfile');
const User = require('../../src/models/User');

describe('gamificationService', () => {
  let user;

  beforeEach(async() => {
    await GamificationProfile.deleteMany({});
    await User.deleteMany({});
    user = await global.testUtils.createTestUser({ email: `student-${Date.now()}@example.com` });
  });

  it('awards points and streak for a correct answer', async() => {
    const profile = await gamificationService.awardForAnswer({
      userId: user._id,
      isCorrect: true,
      difficulty: 0.7,
      responseTimeMs: 5000
    });

    expect(profile.points).toBeGreaterThan(0);
    expect(profile.streak.current).toBeGreaterThanOrEqual(1);
    expect(profile.level).toBeGreaterThanOrEqual(1);
  });

  it('awards session bonuses and badges on completion', async() => {
    const profile = await gamificationService.awardForSession({
      userId: user._id,
      correctAnswers: 5,
      answeredQuestions: 5,
      completedSessions: 1
    });

    const badgeIds = profile.badges.map(b => b.badgeId);
    expect(profile.points).toBeGreaterThanOrEqual(50);
    expect(badgeIds).toEqual(expect.arrayContaining(['first_assessment', 'accuracy_90']));
  });
});
