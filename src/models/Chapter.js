const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  class: {
    type: String,
    required: [true, 'Class is required'],
    enum: ['6', '7'],
    validate: {
      validator(v) {
        return ['6', '7'].includes(v);
      },
      message: 'Class must be 6 or 7'
    }
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    enum: ['Math', 'Science', 'Social Science'],
    trim: true
  },
  chapterNumber: {
    type: Number,
    required: [true, 'Chapter number is required'],
    min: [1, 'Chapter number must be at least 1'],
    max: [20, 'Chapter number cannot exceed 20']
  },
  chapterName: {
    type: String,
    required: [true, 'Chapter name is required'],
    trim: true,
    maxlength: [200, 'Chapter name cannot be more than 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  topics: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic'
  }],
  ncertReference: {
    type: String,
    trim: true,
    maxlength: [100, 'NCERT reference cannot be more than 100 characters']
  },
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
chapterSchema.index({ class: 1, subject: 1 });
chapterSchema.index({ class: 1, subject: 1, chapterNumber: 1 });
chapterSchema.index({ isActive: 1 });
chapterSchema.index({ createdBy: 1 });

// Update updatedAt on save
chapterSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for total topics count
chapterSchema.virtual('topicsCount').get(function() {
  return Array.isArray(this.topics) ? this.topics.length : 0;
});

// Virtual for chapter identifier
chapterSchema.virtual('chapterId').get(function() {
  return `Class ${this.class} ${this.subject} Ch${this.chapterNumber}`;
});

// Method to add topic to chapter
chapterSchema.methods.addTopic = function(topicId) {
  if (!this.topics.includes(topicId)) {
    this.topics.push(topicId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove topic from chapter
chapterSchema.methods.removeTopic = function(topicId) {
  this.topics = this.topics.filter(id => !id.equals(topicId));
  return this.save();
};

// Static method to find chapters by criteria
chapterSchema.statics.findByCriteria = function(criteria) {
  const query = { isActive: true };

  if (criteria.class) query.class = criteria.class;
  if (criteria.subject) query.subject = criteria.subject;
  if (criteria.chapterNumber) query.chapterNumber = criteria.chapterNumber;

  return this.find(query).populate('topics', 'topicName description difficulty');
};

// Static method to get chapter statistics
chapterSchema.statics.getStatistics = function(classId, subject) {
  const query = { isActive: true };
  if (classId) query.class = classId;
  if (subject) query.subject = subject;

  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalChapters: { $sum: 1 },
        averageTopicsPerChapter: { $avg: { $size: '$topics' } },
        subjects: { $addToSet: '$subject' },
        classes: { $addToSet: '$class' }
      }
    }
  ]);
};

// Ensure virtual fields are serialized
chapterSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Chapter', chapterSchema);
