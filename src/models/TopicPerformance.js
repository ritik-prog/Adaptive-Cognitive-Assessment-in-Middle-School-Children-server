const mongoose = require('mongoose');

const topicPerformanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student ID is required']
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: [true, 'Topic ID is required']
  },
  attemptsCount: {
    type: Number,
    default: 0,
    min: [0, 'Attempts count cannot be negative']
  },
  correctCount: {
    type: Number,
    default: 0,
    min: [0, 'Correct count cannot be negative']
  },
  averageScore: {
    type: Number,
    default: 0,
    min: [0, 'Average score cannot be negative'],
    max: [1, 'Average score cannot exceed 1']
  },
  currentDifficulty: {
    type: Number,
    default: 0.5,
    min: [0, 'Current difficulty must be at least 0'],
    max: [1, 'Current difficulty must be at most 1']
  },
  lastAttemptDate: {
    type: Date
  },
  strugglingConcepts: [{
    type: String,
    trim: true
  }],
  masteryLevel: {
    type: String,
    enum: ['beginner', 'developing', 'proficient', 'advanced'],
    default: 'beginner'
  },
  consecutiveFailures: {
    type: Number,
    default: 0,
    min: [0, 'Consecutive failures cannot be negative']
  },
  consecutiveSuccesses: {
    type: Number,
    default: 0,
    min: [0, 'Consecutive successes cannot be negative']
  },
  totalTimeSpent: {
    type: Number,
    default: 0, // in milliseconds
    min: [0, 'Total time spent cannot be negative']
  },
  averageResponseTime: {
    type: Number,
    default: 0, // in milliseconds
    min: [0, 'Average response time cannot be negative']
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
topicPerformanceSchema.index({ studentId: 1, topicId: 1 }, { unique: true });
topicPerformanceSchema.index({ studentId: 1, masteryLevel: 1 });
topicPerformanceSchema.index({ topicId: 1, averageScore: 1 });
topicPerformanceSchema.index({ lastAttemptDate: -1 });

// Update lastUpdated on save
topicPerformanceSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

// Virtual for success rate
topicPerformanceSchema.virtual('successRate').get(function() {
  if (this.attemptsCount === 0) return 0;
  return Math.round((this.correctCount / this.attemptsCount) * 100) / 100;
});

// Virtual for difficulty level description
topicPerformanceSchema.virtual('difficultyLevel').get(function() {
  if (this.currentDifficulty <= 0.3) return 'Easy';
  if (this.currentDifficulty <= 0.7) return 'Medium';
  return 'Hard';
});

// Virtual for performance status
topicPerformanceSchema.virtual('performanceStatus').get(function() {
  if (this.attemptsCount === 0) return 'not_attempted';
  if (this.successRate >= 0.8) return 'excellent';
  if (this.successRate >= 0.6) return 'good';
  if (this.successRate >= 0.4) return 'needs_improvement';
  return 'struggling';
});

// Method to record an attempt
topicPerformanceSchema.methods.recordAttempt = function(isCorrect, responseTimeMs = 0) {
  this.attemptsCount += 1;
  this.lastAttemptDate = new Date();
  this.totalTimeSpent += responseTimeMs;
  this.averageResponseTime = this.totalTimeSpent / this.attemptsCount;

  if (isCorrect) {
    this.correctCount += 1;
    this.consecutiveSuccesses += 1;
    this.consecutiveFailures = 0;
  } else {
    this.consecutiveFailures += 1;
    this.consecutiveSuccesses = 0;
  }

  // Update average score
  this.averageScore = this.correctCount / this.attemptsCount;

  // Update mastery level based on performance
  this.updateMasteryLevel();

  // Update difficulty based on consecutive performance
  this.updateDifficulty();

  return this.save();
};

// Method to update mastery level
topicPerformanceSchema.methods.updateMasteryLevel = function() {
  if (this.attemptsCount < 3) {
    this.masteryLevel = 'beginner';
  } else if (this.successRate >= 0.9 && this.attemptsCount >= 5) {
    this.masteryLevel = 'advanced';
  } else if (this.successRate >= 0.7 && this.attemptsCount >= 4) {
    this.masteryLevel = 'proficient';
  } else if (this.successRate >= 0.5 && this.attemptsCount >= 3) {
    this.masteryLevel = 'developing';
  } else {
    this.masteryLevel = 'beginner';
  }
};

// Method to update difficulty based on consecutive performance
topicPerformanceSchema.methods.updateDifficulty = function() {
  const difficultyStep = 0.1;
  
  // If student fails 3+ consecutive times, reduce difficulty
  if (this.consecutiveFailures >= 3) {
    this.currentDifficulty = Math.max(0.1, this.currentDifficulty - difficultyStep);
  }
  
  // If student succeeds 3+ consecutive times, increase difficulty
  if (this.consecutiveSuccesses >= 3) {
    this.currentDifficulty = Math.min(0.9, this.currentDifficulty + difficultyStep);
  }
};

// Method to add struggling concept
topicPerformanceSchema.methods.addStrugglingConcept = function(concept) {
  if (!this.strugglingConcepts.includes(concept)) {
    this.strugglingConcepts.push(concept);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove struggling concept
topicPerformanceSchema.methods.removeStrugglingConcept = function(concept) {
  this.strugglingConcepts = this.strugglingConcepts.filter(c => c !== concept);
  return this.save();
};

// Static method to find performance by student and topic
topicPerformanceSchema.statics.findByStudentAndTopic = function(studentId, topicId) {
  return this.findOne({ studentId, topicId });
};

// Static method to get struggling topics for a student
topicPerformanceSchema.statics.getStrugglingTopics = function(studentId, threshold = 0.4) {
  return this.find({
    studentId,
    averageScore: { $lt: threshold },
    attemptsCount: { $gte: 2 }
  }).populate('topicId', 'topicName description chapterId');
};

// Static method to get top performing topics for a student
topicPerformanceSchema.statics.getTopPerformingTopics = function(studentId, limit = 5) {
  return this.find({
    studentId,
    attemptsCount: { $gte: 3 }
  })
  .sort({ averageScore: -1 })
  .limit(limit)
  .populate('topicId', 'topicName description chapterId');
};

// Static method to get class performance for a topic
topicPerformanceSchema.statics.getClassPerformance = function(topicId) {
  return this.aggregate([
    { $match: { topicId: mongoose.Types.ObjectId(topicId) } },
    {
      $group: {
        _id: null,
        totalStudents: { $sum: 1 },
        averageScore: { $avg: '$averageScore' },
        averageAttempts: { $avg: '$attemptsCount' },
        strugglingCount: {
          $sum: {
            $cond: [{ $lt: ['$averageScore', 0.4] }, 1, 0]
          }
        }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
topicPerformanceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('TopicPerformance', topicPerformanceSchema);
