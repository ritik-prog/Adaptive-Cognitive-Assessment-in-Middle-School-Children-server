const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  stem: {
    type: String,
    required: [true, 'Question stem is required'],
    trim: true,
    maxlength: [2000, 'Question stem cannot be more than 2000 characters']
  },
  choices: [{
    type: String,
    required: function() {
      return this.questionType === 'mcq';
    },
    trim: true,
    maxlength: [500, 'Each choice cannot be more than 500 characters']
  }],
  correctIndex: {
    type: Number,
    required: function() {
      return this.questionType === 'mcq';
    },
    min: [0, 'Correct index must be at least 0'],
    validate: {
      validator(v) {
        if (this.questionType === 'mcq') {
          return v >= 0 && v < this.choices.length;
        }
        return true;
      },
      message: 'Correct index must be within the range of available choices'
    }
  },
  questionType: {
    type: String,
    required: [true, 'Question type is required'],
    enum: ['mcq', 'fill-in-blank', 'short-answer'],
    default: 'mcq'
  },
  correctAnswer: {
    type: String,
    required: function() {
      return ['fill-in-blank', 'short-answer'].includes(this.questionType);
    },
    trim: true,
    maxlength: [1000, 'Correct answer cannot be more than 1000 characters']
  },
  acceptedAnswers: [{
    type: String,
    trim: true,
    maxlength: [1000, 'Each accepted answer cannot be more than 1000 characters']
  }],
  blanksCount: {
    type: Number,
    min: [1, 'Blanks count must be at least 1'],
    max: [10, 'Blanks count cannot exceed 10'],
    default: function() {
      return this.questionType === 'fill-in-blank' ? 1 : undefined;
    }
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter',
    required: [true, 'Chapter ID is required']
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: [true, 'Topic ID is required']
  },
  difficulty: {
    type: Number,
    required: [true, 'Difficulty level is required'],
    min: [0, 'Difficulty must be at least 0'],
    max: [1, 'Difficulty must be at most 1']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  grade: {
    type: String,
    required: [true, 'Grade level is required'],
    enum: ['6', '7', '8', '9']
  },
  topic: {
    type: String,
    required: [true, 'Topic is required'],
    trim: true,
    maxlength: [100, 'Topic cannot be more than 100 characters']
  },
  passage: {
    type: String,
    trim: true,
    maxlength: [5000, 'Passage cannot be more than 5000 characters']
  },
  explanation: {
    type: String,
    trim: true,
    maxlength: [1000, 'Explanation cannot be more than 1000 characters']
  },
  isGenerated: {
    type: Boolean,
    default: false
  },
  generatedBy: {
    type: String,
    enum: ['openai', 'manual', 'seed', 'mock'],
    default: 'manual'
  },
  usageCount: {
    type: Number,
    default: 0
  },
  successRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  averageResponseTime: {
    type: Number,
    default: 0 // in milliseconds
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
questionSchema.index({ grade: 1, difficulty: 1 });
questionSchema.index({ topic: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ isActive: 1 });
questionSchema.index({ isGenerated: 1 });
questionSchema.index({ questionType: 1 });
questionSchema.index({ chapterId: 1 });
questionSchema.index({ topicId: 1 });
questionSchema.index({ chapterId: 1, topicId: 1 });
questionSchema.index({ chapterId: 1, difficulty: 1 });
questionSchema.index({ questionType: 1, difficulty: 1 });

// Update updatedAt on save
questionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for difficulty level description
questionSchema.virtual('difficultyLevel').get(function() {
  if (this.difficulty <= 0.3) return 'Easy';
  if (this.difficulty <= 0.7) return 'Medium';
  return 'Hard';
});

// Virtual for choice count
questionSchema.virtual('choiceCount').get(function() {
  return this.choices.length;
});

// Method to update usage statistics
questionSchema.methods.updateUsageStats = function(isCorrect, responseTime) {
  this.usageCount += 1;

  // Update success rate
  const currentSuccesses = this.successRate * (this.usageCount - 1);
  this.successRate = (currentSuccesses + (isCorrect ? 1 : 0)) / this.usageCount;

  // Update average response time
  const currentTotalTime = this.averageResponseTime * (this.usageCount - 1);
  this.averageResponseTime = (currentTotalTime + responseTime) / this.usageCount;

  return this.save();
};

// Static method to find questions by criteria
questionSchema.statics.findByCriteria = function(criteria) {
  const query = { isActive: true };

  if (criteria.grade) query.grade = criteria.grade;
  if (criteria.difficulty) {
    if (typeof criteria.difficulty === 'object') {
      query.difficulty = criteria.difficulty;
    } else {
      query.difficulty = { $gte: criteria.difficulty - 0.1, $lte: criteria.difficulty + 0.1 };
    }
  }
  if (criteria.topic) query.topic = new RegExp(criteria.topic, 'i');
  if (criteria.tags && criteria.tags.length > 0) {
    query.tags = { $in: criteria.tags };
  }
  if (criteria.questionType) query.questionType = criteria.questionType;
  if (criteria.chapterId) query.chapterId = criteria.chapterId;
  if (criteria.topicId) query.topicId = criteria.topicId;
  if (criteria.excludeIds && criteria.excludeIds.length > 0) {
    query._id = { $nin: criteria.excludeIds };
  }

  return this.find(query);
};

// Ensure virtual fields are serialized
questionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Question', questionSchema);
