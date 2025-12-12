const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssessmentSession',
    required: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  answerIndex: {
    type: Number,
    required: [true, 'Answer index is required'],
    min: [0, 'Answer index must be at least 0']
  },
  correct: {
    type: Boolean,
    required: true
  },
  responseTimeMs: {
    type: Number,
    required: [true, 'Response time is required'],
    min: [0, 'Response time must be positive']
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  questionNumber: {
    type: Number,
    required: true
  },
  difficulty: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  studentAbility: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  metadata: {
    deviceType: String,
    browser: String,
    userAgent: String,
    ipAddress: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
responseSchema.index({ sessionId: 1, questionNumber: 1 });
responseSchema.index({ questionId: 1 });
responseSchema.index({ timestamp: -1 });
responseSchema.index({ correct: 1 });
responseSchema.index({ topic: 1 });

// Virtual for response time in seconds
responseSchema.virtual('responseTimeSeconds').get(function() {
  return Math.round(this.responseTimeMs / 1000 * 100) / 100;
});

// Virtual for difficulty level
responseSchema.virtual('difficultyLevel').get(function() {
  if (this.difficulty <= 0.3) return 'Easy';
  if (this.difficulty <= 0.7) return 'Medium';
  return 'Hard';
});

// Method to calculate performance score
responseSchema.methods.getPerformanceScore = function() {
  const timeScore = Math.max(0, 1 - (this.responseTimeMs / 30000)); // 30 seconds max for full time score
  const correctnessScore = this.correct ? 1 : 0;
  const difficultyBonus = this.correct ? this.difficulty * 0.2 : 0;

  return Math.min(1, timeScore * 0.3 + correctnessScore * 0.7 + difficultyBonus);
};

// Static method to get response statistics
responseSchema.statics.getStatistics = function(filters = {}) {
  const matchStage = {};

  if (filters.sessionId) matchStage.sessionId = mongoose.Types.ObjectId(filters.sessionId);
  if (filters.questionId) matchStage.questionId = mongoose.Types.ObjectId(filters.questionId);
  if (filters.topic) matchStage.topic = new RegExp(filters.topic, 'i');
  if (filters.dateRange) {
    matchStage.timestamp = {
      $gte: filters.dateRange.start,
      $lte: filters.dateRange.end
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalResponses: { $sum: 1 },
        correctResponses: {
          $sum: { $cond: ['$correct', 1, 0] }
        },
        averageResponseTime: { $avg: '$responseTimeMs' },
        averageDifficulty: { $avg: '$difficulty' },
        averageStudentAbility: { $avg: '$studentAbility' },
        accuracyRate: {
          $avg: { $cond: ['$correct', 1, 0] }
        }
      }
    }
  ]);
};

// Static method to get topic performance
responseSchema.statics.getTopicPerformance = function(filters = {}) {
  const matchStage = {};

  if (filters.sessionId) matchStage.sessionId = mongoose.Types.ObjectId(filters.sessionId);
  if (filters.dateRange) {
    matchStage.timestamp = {
      $gte: filters.dateRange.start,
      $lte: filters.dateRange.end
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$topic',
        totalResponses: { $sum: 1 },
        correctResponses: {
          $sum: { $cond: ['$correct', 1, 0] }
        },
        averageResponseTime: { $avg: '$responseTimeMs' },
        averageDifficulty: { $avg: '$difficulty' },
        accuracyRate: {
          $avg: { $cond: ['$correct', 1, 0] }
        }
      }
    },
    {
      $sort: { accuracyRate: -1 }
    }
  ]);
};

// Static method to get difficulty performance
responseSchema.statics.getDifficultyPerformance = function(filters = {}) {
  const matchStage = {};

  if (filters.sessionId) matchStage.sessionId = mongoose.Types.ObjectId(filters.sessionId);
  if (filters.dateRange) {
    matchStage.timestamp = {
      $gte: filters.dateRange.start,
      $lte: filters.dateRange.end
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $bucket: {
        groupBy: '$difficulty',
        boundaries: [0, 0.3, 0.7, 1.0],
        default: 'Other',
        output: {
          totalResponses: { $sum: 1 },
          correctResponses: {
            $sum: { $cond: ['$correct', 1, 0] }
          },
          averageResponseTime: { $avg: '$responseTimeMs' },
          accuracyRate: {
            $avg: { $cond: ['$correct', 1, 0] }
          }
        }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
responseSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Response', responseSchema);
