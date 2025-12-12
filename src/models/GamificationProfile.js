const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema(
  {
    badgeId: {
      type: String,
      required: true,
      trim: true
    },
    earnedAt: {
      type: Date,
      default: Date.now
    },
    meta: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['answer', 'session', 'badge', 'streak', 'level'],
      required: true
    },
    delta: {
      type: Number,
      default: 0
    },
    message: {
      type: String,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const streakSchema = new mongoose.Schema(
  {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastActive: { type: Date }
  },
  { _id: false }
);

const gamificationProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  points: {
    type: Number,
    default: 0,
    min: 0
  },
  xp: {
    type: Number,
    default: 0,
    min: 0
  },
  level: {
    type: Number,
    default: 1,
    min: 1
  },
  streak: {
    type: streakSchema,
    default: () => ({})
  },
  badges: {
    type: [badgeSchema],
    default: []
  },
  events: {
    type: [eventSchema],
    default: []
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

gamificationProfileSchema.index({ userId: 1 }, { unique: true });
gamificationProfileSchema.index({ level: -1, points: -1 });
gamificationProfileSchema.index({ 'badges.badgeId': 1 });

gamificationProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

gamificationProfileSchema.methods.addEvent = function(event) {
  // keep a bounded list of the most recent events
  const MAX_EVENTS = 50;
  this.events.unshift(event);
  if (this.events.length > MAX_EVENTS) {
    this.events = this.events.slice(0, MAX_EVENTS);
  }
};

gamificationProfileSchema.methods.hasBadge = function(badgeId) {
  return this.badges.some(badge => badge.badgeId === badgeId);
};

module.exports = mongoose.model('GamificationProfile', gamificationProfileSchema);
