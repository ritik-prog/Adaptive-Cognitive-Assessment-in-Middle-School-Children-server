const mongoose = require('mongoose');

const assessmentSessionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  finishedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned', 'paused'],
    default: 'active'
  },
  sessionType: {
    type: String,
    enum: ['adaptive', 'fixed'],
    required: true
  },
  mode: {
    type: String,
    enum: ['assessment', 'practice', 'revision'],
    required: true,
    default: 'assessment'
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter',
    required: true
  },
  allowRetry: {
    type: Boolean,
    default: function() {
      return ['practice', 'revision'].includes(this.mode);
    }
  },
  showSolutions: {
    type: Boolean,
    default: function() {
      return ['practice', 'revision'].includes(this.mode);
    }
  },
  totalQuestions: {
    type: Number,
    default: 0
  },
  answeredQuestions: {
    type: Number,
    default: 0
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  items: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    questionNumber: {
      type: Number,
      required: true
    },
    presentedAt: {
      type: Date,
      default: Date.now
    },
    answeredAt: {
      type: Date
    },
    answerIndex: {
      type: Number
    },
    isCorrect: {
      type: Boolean
    },
    responseTimeMs: {
      type: Number
    },
    difficulty: {
      type: Number
    },
    topic: {
      type: String
    }
  }],
  estimatedAbility: {
    type: Number,
    default: 0.5 // Initial ability estimate (0-1 scale)
  },
  abilityHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    ability: {
      type: Number
    },
    confidence: {
      type: Number
    }
  }],
  adaptiveParameters: {
    initialDifficulty: {
      type: Number,
      default: 0.5
    },
    difficultyStep: {
      type: Number,
      default: 0.1
    },
    maxQuestions: {
      type: Number,
      default: 20
    },
    minQuestions: {
      type: Number,
      default: 5
    },
    confidenceThreshold: {
      type: Number,
      default: 0.8
    }
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    deviceType: String,
    browser: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
assessmentSessionSchema.index({ studentId: 1, status: 1 });
assessmentSessionSchema.index({ startedAt: -1 });
assessmentSessionSchema.index({ status: 1 });
assessmentSessionSchema.index({ mode: 1 });
assessmentSessionSchema.index({ chapterId: 1 });
assessmentSessionSchema.index({ studentId: 1, mode: 1 });
assessmentSessionSchema.index({ studentId: 1, chapterId: 1 });

// Update updatedAt on save
assessmentSessionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for completion percentage
assessmentSessionSchema.virtual('completionPercentage').get(function() {
  if (this.totalQuestions === 0) return 0;
  return Math.round((this.answeredQuestions / this.totalQuestions) * 100);
});

// Virtual for accuracy percentage
assessmentSessionSchema.virtual('accuracyPercentage').get(function() {
  if (this.answeredQuestions === 0) return 0;
  return Math.round((this.correctAnswers / this.answeredQuestions) * 100);
});

// Virtual for duration in minutes
assessmentSessionSchema.virtual('durationMinutes').get(function() {
  if (!this.finishedAt) return null;
  return Math.round((this.finishedAt - this.startedAt) / (1000 * 60));
});

// Method to add a new item to the session
assessmentSessionSchema.methods.addItem = function(questionId, questionData) {
  const item = {
    questionId,
    questionNumber: this.items.length + 1,
    presentedAt: new Date(),
    difficulty: questionData.difficulty,
    topic: questionData.topic
  };

  this.items.push(item);
  this.totalQuestions = this.items.length;

  return this.save();
};

// Method to answer a question
assessmentSessionSchema.methods.answerQuestion = function(questionNumber, answerIndex, responseTimeMs, isCorrect = false) {
  const item = this.items.find(item => item.questionNumber === questionNumber);
  if (!item) {
    throw new Error('Question not found in session');
  }

  item.answeredAt = new Date();
  item.answerIndex = answerIndex;
  item.responseTimeMs = responseTimeMs;
  item.isCorrect = isCorrect;

  this.answeredQuestions += 1;

  // Update ability estimate (simplified version)
  this.updateAbilityEstimate();

  return this.save();
};

// Method to update ability estimate (simplified adaptive algorithm)
assessmentSessionSchema.methods.updateAbilityEstimate = function() {
  if (this.answeredQuestions === 0) return;

  const correctRate = this.correctAnswers / this.answeredQuestions;
  const averageDifficulty = this.items
    .filter(item => item.answeredAt)
    .reduce((sum, item) => sum + item.difficulty, 0) / this.answeredQuestions;

  // Simple ability estimation based on performance vs difficulty
  this.estimatedAbility = Math.max(0, Math.min(1, correctRate + (averageDifficulty - 0.5) * 0.2));

  // Record ability history
  this.abilityHistory.push({
    timestamp: new Date(),
    ability: this.estimatedAbility,
    confidence: Math.min(1, this.answeredQuestions / 10) // Confidence increases with more questions
  });
};

// Method to complete the session
assessmentSessionSchema.methods.complete = function() {
  this.finishedAt = new Date();
  this.status = 'completed';
  return this.save();
};

// Method to abandon the session
assessmentSessionSchema.methods.abandon = function() {
  this.finishedAt = new Date();
  this.status = 'abandoned';
  return this.save();
};

// Static method to find active sessions for a student
assessmentSessionSchema.statics.findActiveByStudent = function(studentId) {
  return this.findOne({ studentId, status: 'active' });
};

// Static method to get session statistics
assessmentSessionSchema.statics.getStatistics = function(studentId, dateRange) {
  const query = { studentId };
  if (dateRange) {
    query.startedAt = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }

  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        completedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        averageAccuracy: { $avg: '$accuracyPercentage' },
        averageDuration: { $avg: '$durationMinutes' },
        totalQuestions: { $sum: '$answeredQuestions' }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
assessmentSessionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('AssessmentSession', assessmentSessionSchema);
