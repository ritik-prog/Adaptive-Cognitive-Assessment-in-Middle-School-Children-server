const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student ID is required']
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AssessmentSession'
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: [true, 'Question ID is required']
  },
  incorrectAnswer: {
    type: String,
    required: [true, 'Incorrect answer is required'],
    trim: true,
    maxlength: [1000, 'Incorrect answer cannot be more than 1000 characters']
  },
  recommendationType: {
    type: String,
    required: [true, 'Recommendation type is required'],
    enum: [
      'concept_explanation',
      'practice_questions',
      'learning_resources',
      'study_tips',
      'common_mistakes',
      'step_by_step_solution',
      'related_topics',
      'difficulty_adjustment'
    ]
  },
  content: {
    type: String,
    required: [true, 'Recommendation content is required'],
    trim: true,
    maxlength: [2000, 'Recommendation content cannot be more than 2000 characters']
  },
  resources: [{
    type: {
      type: String,
      enum: ['video', 'article', 'practice_question', 'tutorial', 'example'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Resource title cannot be more than 200 characters']
    },
    url: {
      type: String,
      trim: true,
      maxlength: [500, 'Resource URL cannot be more than 500 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Resource description cannot be more than 500 characters']
    }
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isHelpful: {
    type: Boolean
  },
  feedback: {
    type: String,
    trim: true,
    maxlength: [500, 'Feedback cannot be more than 500 characters']
  },
  relatedTopics: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic'
  }],
  generatedBy: {
    type: String,
    enum: ['ai', 'teacher', 'system'],
    default: 'ai'
  },
  confidence: {
    type: Number,
    min: [0, 'Confidence must be at least 0'],
    max: [1, 'Confidence must be at most 1'],
    default: 0.8
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }
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
recommendationSchema.index({ studentId: 1, createdAt: -1 });
recommendationSchema.index({ studentId: 1, isRead: 1 });
recommendationSchema.index({ studentId: 1, priority: 1 });
recommendationSchema.index({ questionId: 1 });
recommendationSchema.index({ recommendationType: 1 });
recommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Update updatedAt on save
recommendationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for age in days
recommendationSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for is expired
recommendationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Method to mark as read
recommendationSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

// Method to mark as helpful
recommendationSchema.methods.markAsHelpful = function(isHelpful, feedback = '') {
  this.isHelpful = isHelpful;
  if (feedback) {
    this.feedback = feedback;
  }
  return this.save();
};

// Method to add resource
recommendationSchema.methods.addResource = function(resource) {
  this.resources.push(resource);
  return this.save();
};

// Method to remove resource
recommendationSchema.methods.removeResource = function(resourceIndex) {
  if (resourceIndex >= 0 && resourceIndex < this.resources.length) {
    this.resources.splice(resourceIndex, 1);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to add related topic
recommendationSchema.methods.addRelatedTopic = function(topicId) {
  if (!this.relatedTopics.includes(topicId)) {
    this.relatedTopics.push(topicId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove related topic
recommendationSchema.methods.removeRelatedTopic = function(topicId) {
  this.relatedTopics = this.relatedTopics.filter(id => !id.equals(topicId));
  return this.save();
};

// Static method to find recommendations for student
recommendationSchema.statics.findByStudent = function(studentId, options = {}) {
  const query = { studentId };
  
  if (options.isRead !== undefined) query.isRead = options.isRead;
  if (options.priority) query.priority = options.priority;
  if (options.recommendationType) query.recommendationType = options.recommendationType;
  if (options.limit) query.limit = options.limit;

  return this.find(query)
    .populate('questionId', 'stem topic difficulty')
    .populate('relatedTopics', 'topicName description')
    .sort({ priority: 1, createdAt: -1 });
};

// Static method to get recommendation statistics
recommendationSchema.statics.getStatistics = function(studentId) {
  return this.aggregate([
    { $match: { studentId: mongoose.Types.ObjectId(studentId) } },
    {
      $group: {
        _id: null,
        totalRecommendations: { $sum: 1 },
        readRecommendations: {
          $sum: { $cond: ['$isRead', 1, 0] }
        },
        helpfulRecommendations: {
          $sum: { $cond: [{ $eq: ['$isHelpful', true] }, 1, 0] }
        },
        unhelpfulRecommendations: {
          $sum: { $cond: [{ $eq: ['$isHelpful', false] }, 1, 0] }
        },
        averageConfidence: { $avg: '$confidence' },
        recommendationsByType: {
          $push: {
            type: '$recommendationType',
            priority: '$priority'
          }
        }
      }
    }
  ]);
};

// Static method to get unread recommendations count
recommendationSchema.statics.getUnreadCount = function(studentId) {
  return this.countDocuments({ studentId, isRead: false });
};

// Static method to clean up expired recommendations
recommendationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Static method to find similar recommendations
recommendationSchema.statics.findSimilar = function(questionId, recommendationType, limit = 5) {
  return this.find({
    questionId,
    recommendationType,
    isHelpful: { $ne: false }
  })
  .sort({ confidence: -1, createdAt: -1 })
  .limit(limit);
};

// Ensure virtual fields are serialized
recommendationSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Recommendation', recommendationSchema);
