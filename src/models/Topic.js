const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter',
    required: [true, 'Chapter ID is required']
  },
  topicName: {
    type: String,
    required: [true, 'Topic name is required'],
    trim: true,
    maxlength: [200, 'Topic name cannot be more than 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  difficulty: {
    type: Number,
    required: [true, 'Difficulty baseline is required'],
    min: [0, 'Difficulty must be at least 0'],
    max: [1, 'Difficulty must be at most 1'],
    default: 0.5
  },
  concepts: [{
    type: String,
    trim: true,
    maxlength: [100, 'Each concept cannot be more than 100 characters']
  }],
  learningObjectives: [{
    type: String,
    trim: true,
    maxlength: [500, 'Each learning objective cannot be more than 500 characters']
  }],
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
topicSchema.index({ chapterId: 1 });
topicSchema.index({ topicName: 1 });
topicSchema.index({ difficulty: 1 });
topicSchema.index({ isActive: 1 });
topicSchema.index({ createdBy: 1 });

// Update updatedAt on save
topicSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for difficulty level description
topicSchema.virtual('difficultyLevel').get(function() {
  if (this.difficulty <= 0.3) return 'Easy';
  if (this.difficulty <= 0.7) return 'Medium';
  return 'Hard';
});

// Virtual for concepts count
topicSchema.virtual('conceptsCount').get(function() {
  return this.concepts && Array.isArray(this.concepts) ? this.concepts.length : 0;
});

// Virtual for learning objectives count
topicSchema.virtual('objectivesCount').get(function() {
  return this.learningObjectives && Array.isArray(this.learningObjectives) ? this.learningObjectives.length : 0;
});

// Method to add concept to topic
topicSchema.methods.addConcept = function(concept) {
  if (!this.concepts.includes(concept)) {
    this.concepts.push(concept);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove concept from topic
topicSchema.methods.removeConcept = function(concept) {
  this.concepts = this.concepts.filter(c => c !== concept);
  return this.save();
};

// Method to add learning objective
topicSchema.methods.addLearningObjective = function(objective) {
  if (!this.learningObjectives.includes(objective)) {
    this.learningObjectives.push(objective);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove learning objective
topicSchema.methods.removeLearningObjective = function(objective) {
  this.learningObjectives = this.learningObjectives.filter(obj => obj !== objective);
  return this.save();
};

// Static method to find topics by criteria
topicSchema.statics.findByCriteria = function(criteria) {
  const query = { isActive: true };

  if (criteria.chapterId) query.chapterId = criteria.chapterId;
  if (criteria.difficulty) {
    if (typeof criteria.difficulty === 'object') {
      query.difficulty = criteria.difficulty;
    } else {
      query.difficulty = { $gte: criteria.difficulty - 0.1, $lte: criteria.difficulty + 0.1 };
    }
  }
  if (criteria.topicName) query.topicName = new RegExp(criteria.topicName, 'i');

  return this.find(query).populate('chapterId', 'chapterName class subject');
};

// Static method to get topic statistics
topicSchema.statics.getStatistics = function(chapterId) {
  const query = { isActive: true };
  if (chapterId) query.chapterId = chapterId;

  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalTopics: { $sum: 1 },
        averageDifficulty: { $avg: '$difficulty' },
        averageConceptsPerTopic: { $avg: { $size: '$concepts' } },
        averageObjectivesPerTopic: { $avg: { $size: '$learningObjectives' } }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
topicSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Topic', topicSchema);
