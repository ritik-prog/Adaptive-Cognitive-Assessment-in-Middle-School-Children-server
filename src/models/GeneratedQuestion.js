const mongoose = require('mongoose');

const generatedQuestionSchema = new mongoose.Schema({
  inputPrompt: {
    type: String,
    required: [true, 'Input prompt is required'],
    trim: true
  },
  outputJSON: {
    type: String,
    required: [true, 'Output JSON is required']
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  modelUsed: {
    type: String,
    required: [true, 'Model used is required'],
    enum: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'mock']
  },
  latencyMs: {
    type: Number,
    required: true,
    min: 0
  },
  parameters: {
    topic: {
      type: String,
      required: true,
      trim: true
    },
    grade: {
      type: String,
      required: true,
      enum: ['6', '7', '8', '9']
    },
    difficulty: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    }
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  },
  isStored: {
    type: Boolean,
    default: false
  },
  validationErrors: [{
    field: String,
    message: String
  }],
  qualityScore: {
    type: Number,
    min: 0,
    max: 1
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
generatedQuestionSchema.index({ generatedAt: -1 });
generatedQuestionSchema.index({ modelUsed: 1 });
generatedQuestionSchema.index({ 'parameters.topic': 1 });
generatedQuestionSchema.index({ 'parameters.grade': 1 });
generatedQuestionSchema.index({ isStored: 1 });

// Virtual for parsed output
generatedQuestionSchema.virtual('parsedOutput').get(function() {
  try {
    return JSON.parse(this.outputJSON);
  } catch (error) {
    return null;
  }
});

// Virtual for generation time in seconds
generatedQuestionSchema.virtual('generationTimeSeconds').get(function() {
  return Math.round(this.latencyMs / 1000 * 100) / 100;
});

// Method to validate the generated question
generatedQuestionSchema.methods.validateQuestion = function() {
  const errors = [];
  let parsedOutput;

  try {
    parsedOutput = JSON.parse(this.outputJSON);
  } catch (error) {
    errors.push({ field: 'outputJSON', message: 'Invalid JSON format' });
    return errors;
  }

  // Validate required fields
  if (!parsedOutput.stem || typeof parsedOutput.stem !== 'string') {
    errors.push({ field: 'stem', message: 'Question stem is required and must be a string' });
  }

  if (!parsedOutput.choices || !Array.isArray(parsedOutput.choices) || parsedOutput.choices.length < 2) {
    errors.push({ field: 'choices', message: 'At least 2 choices are required' });
  }

  if (typeof parsedOutput.correctIndex !== 'number' ||
      parsedOutput.correctIndex < 0 ||
      parsedOutput.correctIndex >= (parsedOutput.choices?.length || 0)) {
    errors.push({ field: 'correctIndex', message: 'Valid correct index is required' });
  }

  if (typeof parsedOutput.difficulty !== 'number' ||
      parsedOutput.difficulty < 0 ||
      parsedOutput.difficulty > 1) {
    errors.push({ field: 'difficulty', message: 'Difficulty must be a number between 0 and 1' });
  }

  if (!parsedOutput.tags || !Array.isArray(parsedOutput.tags)) {
    errors.push({ field: 'tags', message: 'Tags must be an array' });
  }

  this.validationErrors = errors;
  return errors;
};

// Method to calculate quality score
generatedQuestionSchema.methods.calculateQualityScore = function() {
  const parsedOutput = this.parsedOutput;
  if (!parsedOutput) return 0;

  let score = 0;
  let maxScore = 0;

  // Stem quality (30 points)
  maxScore += 30;
  if (parsedOutput.stem && parsedOutput.stem.length >= 20) {
    score += 30;
  } else if (parsedOutput.stem && parsedOutput.stem.length >= 10) {
    score += 20;
  }

  // Choices quality (25 points)
  maxScore += 25;
  if (parsedOutput.choices && parsedOutput.choices.length >= 3) {
    score += 15;
    if (parsedOutput.choices.every(choice => choice.length >= 5)) {
      score += 10;
    }
  }

  // Correct index validity (20 points)
  maxScore += 20;
  if (typeof parsedOutput.correctIndex === 'number' &&
      parsedOutput.correctIndex >= 0 &&
      parsedOutput.correctIndex < (parsedOutput.choices?.length || 0)) {
    score += 20;
  }

  // Difficulty validity (15 points)
  maxScore += 15;
  if (typeof parsedOutput.difficulty === 'number' &&
      parsedOutput.difficulty >= 0 &&
      parsedOutput.difficulty <= 1) {
    score += 15;
  }

  // Tags quality (10 points)
  maxScore += 10;
  if (parsedOutput.tags && Array.isArray(parsedOutput.tags) && parsedOutput.tags.length > 0) {
    score += 10;
  }

  this.qualityScore = maxScore > 0 ? score / maxScore : 0;
  return this.qualityScore;
};

// Method to update usage statistics
generatedQuestionSchema.methods.updateUsageStats = function(isCorrect) {
  this.usageCount += 1;

  const currentSuccesses = this.successRate * (this.usageCount - 1);
  this.successRate = (currentSuccesses + (isCorrect ? 1 : 0)) / this.usageCount;

  return this.save();
};

// Static method to get generation statistics
generatedQuestionSchema.statics.getGenerationStats = function(filters = {}) {
  const matchStage = {};

  if (filters.modelUsed) matchStage.modelUsed = filters.modelUsed;
  if (filters.dateRange) {
    matchStage.generatedAt = {
      $gte: filters.dateRange.start,
      $lte: filters.dateRange.end
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalGenerated: { $sum: 1 },
        averageLatency: { $avg: '$latencyMs' },
        averageQualityScore: { $avg: '$qualityScore' },
        storedCount: {
          $sum: { $cond: ['$isStored', 1, 0] }
        },
        averageUsageCount: { $avg: '$usageCount' },
        averageSuccessRate: { $avg: '$successRate' }
      }
    }
  ]);
};

// Static method to get model performance
generatedQuestionSchema.statics.getModelPerformance = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$modelUsed',
        totalGenerated: { $sum: 1 },
        averageLatency: { $avg: '$latencyMs' },
        averageQualityScore: { $avg: '$qualityScore' },
        storedCount: {
          $sum: { $cond: ['$isStored', 1, 0] }
        },
        averageUsageCount: { $avg: '$usageCount' },
        averageSuccessRate: { $avg: '$successRate' }
      }
    },
    {
      $sort: { averageQualityScore: -1 }
    }
  ]);
};

// Ensure virtual fields are serialized
generatedQuestionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('GeneratedQuestion', generatedQuestionSchema);
