const GamificationProfile = require('../models/GamificationProfile');
const { badgeCatalog, badgeCatalogById } = require('./badgeCatalog');

// XP curve: xp needed for next level grows sub-linearly to keep pace engaging
const xpForLevel = (level) => Math.floor(100 * Math.pow(level, 1.5));

const ensureProfile = async(userId) => {
  let profile = await GamificationProfile.findOne({ userId });
  if (!profile) {
    profile = await GamificationProfile.create({ userId });
  }
  return profile;
};

const calculateLevel = (xp) => {
  let level = 1;
  let remainingXp = xp;
  while (remainingXp >= xpForLevel(level)) {
    remainingXp -= xpForLevel(level);
    level += 1;
  }
  return { level, xpIntoLevel: remainingXp, xpToNext: xpForLevel(level) - remainingXp };
};

const updateStreak = (profile) => {
  const now = new Date();
  const last = profile.streak.lastActive ? new Date(profile.streak.lastActive) : null;
  if (!last) {
    profile.streak.current = 1;
  } else {
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      // same day: keep streak unchanged
    } else if (diffDays === 1) {
      profile.streak.current += 1;
    } else {
      profile.streak.current = 1;
    }
  }
  profile.streak.longest = Math.max(profile.streak.longest || 0, profile.streak.current);
  profile.streak.lastActive = now;
};

const awardBadges = (profile, context) => {
  const newlyEarned = [];
  badgeCatalog.forEach((badge) => {
    if (profile.hasBadge(badge.id)) return;

    switch (badge.type) {
    case 'session': {
      const sessions = context.completedSessions || 0;
      const accuracy = context.sessionAccuracy;
      if (badge.criteria.completedSessions && sessions >= badge.criteria.completedSessions) {
        newlyEarned.push(badge);
      } else if (badge.criteria.minAccuracy && accuracy !== undefined && accuracy >= badge.criteria.minAccuracy) {
        newlyEarned.push(badge);
      }
      break;
    }
    case 'streak': {
      if (context.streakDays && context.streakDays >= badge.criteria.streakDays) {
        newlyEarned.push(badge);
      }
      break;
    }
    case 'mastery': {
      if (badge.criteria.masteryLevels && context.masteryLevel && badge.criteria.masteryLevels.includes(context.masteryLevel)) {
        newlyEarned.push(badge);
      }
      break;
    }
    case 'level': {
      if (context.level && context.level >= badge.criteria.level) {
        newlyEarned.push(badge);
      }
      break;
    }
    default:
      break;
    }
  });

  newlyEarned.forEach((badge) => {
    profile.badges.push({
      badgeId: badge.id,
      earnedAt: new Date(),
      meta: { name: badge.name, description: badge.description }
    });
    profile.addEvent({
      type: 'badge',
      delta: 0,
      message: `Earned badge: ${badge.name}`
    });
  });

  return newlyEarned;
};

const awardForAnswer = async({ userId, isCorrect, difficulty = 0.5, responseTimeMs }) => {
  const profile = await ensureProfile(userId);
  updateStreak(profile);

  // Base points: correct answers grant more; include difficulty bonus
  const basePoints = isCorrect ? 10 : 2;
  const difficultyBonus = Math.round((difficulty - 0.5) * 10); // +/- based on difficulty
  const speedBonus = responseTimeMs ? Math.max(0, Math.min(5, Math.round((30000 - responseTimeMs) / 6000))) : 0;

  const deltaPoints = Math.max(1, basePoints + difficultyBonus + speedBonus);
  const deltaXp = deltaPoints; // 1:1 mapping for now

  profile.points += deltaPoints;
  profile.xp += deltaXp;
  profile.addEvent({
    type: 'answer',
    delta: deltaPoints,
    message: `Answered a question (${isCorrect ? 'correct' : 'attempted'})`
  });

  const { level: newLevel } = calculateLevel(profile.xp);
  if (newLevel > profile.level) {
    profile.level = newLevel;
    profile.addEvent({
      type: 'level',
      delta: 0,
      message: `Reached level ${newLevel}`
    });
    awardBadges(profile, { level: newLevel });
  }

  // streak-based badges
  awardBadges(profile, { streakDays: profile.streak.current });

  await profile.save();
  return profile;
};

const awardForSession = async({ userId, correctAnswers, answeredQuestions, completedSessions }) => {
  const profile = await ensureProfile(userId);
  updateStreak(profile);

  const accuracy = answeredQuestions > 0 ? correctAnswers / answeredQuestions : 0;
  const completionBonus = 20;
  const accuracyBonus = Math.round(accuracy * 30); // up to 30

  const deltaPoints = completionBonus + accuracyBonus;
  profile.points += deltaPoints;
  profile.xp += deltaPoints;
  profile.addEvent({
    type: 'session',
    delta: deltaPoints,
    message: `Completed a session with ${(accuracy * 100).toFixed(0)}% accuracy`
  });

  const { level: newLevel } = calculateLevel(profile.xp);
  if (newLevel > profile.level) {
    profile.level = newLevel;
    profile.addEvent({
      type: 'level',
      delta: 0,
      message: `Reached level ${newLevel}`
    });
    awardBadges(profile, { level: newLevel });
  }

  awardBadges(profile, {
    completedSessions,
    sessionAccuracy: accuracy,
    streakDays: profile.streak.current
  });

  await profile.save();
  return profile;
};

const awardForMasteryChange = async({ userId, masteryLevel }) => {
  const profile = await ensureProfile(userId);
  const earned = awardBadges(profile, { masteryLevel });
  if (earned.length > 0) {
    await profile.save();
  }
  return profile;
};

const getProfile = async(userId) => ensureProfile(userId);

module.exports = {
  awardForAnswer,
  awardForSession,
  awardForMasteryChange,
  getProfile,
  xpForLevel,
  calculateLevel
};
