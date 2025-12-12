const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  grade: {
    type: String,
    required: [true, 'Grade is required'],
    enum: ['6', '7', '8', '9'],
    validate: {
      validator(v) {
        return ['6', '7', '8', '9'].includes(v);
      },
      message: 'Grade must be 6, 7, 8, or 9'
    }
  },
  consentFlag: {
    type: Boolean,
    default: false,
    required: true
  },
  parentEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid parent email']
  },
  schoolName: {
    type: String,
    trim: true,
    maxlength: [200, 'School name cannot be more than 200 characters']
  },
  learningPreferences: {
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    topics: [{
      type: String,
      trim: true
    }]
  },
  assessmentHistory: [{
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssessmentSession'
    },
    completedAt: Date,
    score: Number,
    totalQuestions: Number
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
studentProfileSchema.index({ userId: 1 });
studentProfileSchema.index({ grade: 1 });

// Update updatedAt on save
studentProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for assessment count
studentProfileSchema.virtual('assessmentCount').get(function() {
  return this.assessmentHistory.length;
});

// Virtual for average score
studentProfileSchema.virtual('averageScore').get(function() {
  if (this.assessmentHistory.length === 0) return 0;
  const totalScore = this.assessmentHistory.reduce((sum, assessment) => sum + (assessment.score || 0), 0);
  return Math.round((totalScore / this.assessmentHistory.length) * 100) / 100;
});

// Ensure virtual fields are serialized
studentProfileSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
