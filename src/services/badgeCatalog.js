/**
 * Static badge catalog with criteria for awarding.
 * Criteria will be interpreted by gamificationService.
 */
const badgeCatalog = [
  {
    id: 'first_assessment',
    name: 'First Steps',
    description: 'Complete your first assessment.',
    type: 'session',
    criteria: { completedSessions: 1 }
  },
  {
    id: 'accuracy_90',
    name: 'Sharp Shooter',
    description: 'Finish a session with 90%+ accuracy.',
    type: 'session',
    criteria: { minAccuracy: 0.9 }
  },
  {
    id: 'streak_3',
    name: 'On a Roll',
    description: 'Maintain a 3-day activity streak.',
    type: 'streak',
    criteria: { streakDays: 3 }
  },
  {
    id: 'streak_7',
    name: 'Weekly Warrior',
    description: 'Maintain a 7-day activity streak.',
    type: 'streak',
    criteria: { streakDays: 7 }
  },
  {
    id: 'mastery_topic',
    name: 'Topic Master',
    description: 'Reach proficient or higher in any topic.',
    type: 'mastery',
    criteria: { masteryLevels: ['proficient', 'advanced'] }
  },
  {
    id: 'level_5',
    name: 'Climber',
    description: 'Reach level 5.',
    type: 'level',
    criteria: { level: 5 }
  },
  {
    id: 'level_10',
    name: 'Summit',
    description: 'Reach level 10.',
    type: 'level',
    criteria: { level: 10 }
  }
];

const badgeCatalogById = badgeCatalog.reduce((acc, badge) => {
  acc[badge.id] = badge;
  return acc;
}, {});

module.exports = {
  badgeCatalog,
  badgeCatalogById
};
