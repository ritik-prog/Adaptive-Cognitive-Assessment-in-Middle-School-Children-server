const logger = require('../utils/logger');

/**
 * Answer validation service for different question types
 */
class AnswerValidator {
  /**
   * Validate MCQ answer
   * @param {Object} question - Question object
   * @param {number} answerIndex - Selected answer index
   * @returns {Object} Validation result
   */
  static validateMCQ(question, answerIndex) {
    try {
      // Check if answer index is valid
      if (answerIndex < 0 || answerIndex >= question.choices.length) {
        return {
          isValid: false,
          isCorrect: false,
          error: 'Invalid answer index'
        };
      }

      // Check if answer is correct
      const isCorrect = answerIndex === question.correctIndex;

      return {
        isValid: true,
        isCorrect,
        correctAnswer: question.choices[question.correctIndex],
        selectedAnswer: question.choices[answerIndex]
      };
    } catch (error) {
      logger.error('MCQ validation error:', error);
      return {
        isValid: false,
        isCorrect: false,
        error: 'Validation failed'
      };
    }
  }

  /**
   * Validate fill-in-blank answer
   * @param {Object} question - Question object
   * @param {string|Array} userAnswer - User's answer(s)
   * @returns {Object} Validation result
   */
  static validateFillInBlank(question, userAnswer) {
    try {
      // Normalize user answer
      let normalizedUserAnswer;
      if (Array.isArray(userAnswer)) {
        normalizedUserAnswer = userAnswer.map(answer => this.normalizeAnswer(answer));
      } else {
        normalizedUserAnswer = this.normalizeAnswer(userAnswer);
      }

      // Get correct answers
      const correctAnswers = [question.correctAnswer, ...(question.acceptedAnswers || [])]
        .map(answer => this.normalizeAnswer(answer));

      // Check if answer matches any correct answer
      let isCorrect = false;
      let matchedAnswer = null;

      if (Array.isArray(normalizedUserAnswer)) {
        // Multiple blanks - check each answer
        if (normalizedUserAnswer.length !== question.blanksCount) {
          return {
            isValid: false,
            isCorrect: false,
            error: `Expected ${question.blanksCount} answers, got ${normalizedUserAnswer.length}`
          };
        }

        // For multiple blanks, we need to check against multiple correct answers
        // This is a simplified version - in practice, you might need more complex matching
        isCorrect = normalizedUserAnswer.every(answer => 
          correctAnswers.some(correct => this.fuzzyMatch(answer, correct))
        );
      } else {
        // Single blank
        isCorrect = correctAnswers.some(correct => this.fuzzyMatch(normalizedUserAnswer, correct));
        if (isCorrect) {
          matchedAnswer = correctAnswers.find(correct => this.fuzzyMatch(normalizedUserAnswer, correct));
        }
      }

      return {
        isValid: true,
        isCorrect,
        correctAnswer: question.correctAnswer,
        selectedAnswer: userAnswer,
        matchedAnswer
      };
    } catch (error) {
      logger.error('Fill-in-blank validation error:', error);
      return {
        isValid: false,
        isCorrect: false,
        error: 'Validation failed'
      };
    }
  }

  /**
   * Validate short-answer question
   * @param {Object} question - Question object
   * @param {string} userAnswer - User's answer
   * @returns {Object} Validation result
   */
  static validateShortAnswer(question, userAnswer) {
    try {
      const normalizedUserAnswer = this.normalizeAnswer(userAnswer);
      const correctAnswers = [question.correctAnswer, ...(question.acceptedAnswers || [])]
        .map(answer => this.normalizeAnswer(answer));

      // Check for exact match first
      let isCorrect = correctAnswers.some(correct => 
        normalizedUserAnswer === correct
      );

      // If no exact match, try fuzzy matching
      if (!isCorrect) {
        isCorrect = correctAnswers.some(correct => 
          this.fuzzyMatch(normalizedUserAnswer, correct)
        );
      }

      // If still no match, try keyword matching
      if (!isCorrect) {
        isCorrect = this.keywordMatch(normalizedUserAnswer, correctAnswers);
      }

      return {
        isValid: true,
        isCorrect,
        correctAnswer: question.correctAnswer,
        selectedAnswer: userAnswer,
        confidence: this.calculateConfidence(normalizedUserAnswer, correctAnswers)
      };
    } catch (error) {
      logger.error('Short-answer validation error:', error);
      return {
        isValid: false,
        isCorrect: false,
        error: 'Validation failed'
      };
    }
  }

  /**
   * Validate answer based on question type
   * @param {Object} question - Question object
   * @param {*} userAnswer - User's answer
   * @returns {Object} Validation result
   */
  static validateAnswer(question, userAnswer) {
    switch (question.questionType) {
      case 'mcq':
        return this.validateMCQ(question, userAnswer);
      case 'fill-in-blank':
        return this.validateFillInBlank(question, userAnswer);
      case 'short-answer':
        return this.validateShortAnswer(question, userAnswer);
      default:
        return {
          isValid: false,
          isCorrect: false,
          error: 'Unknown question type'
        };
    }
  }

  /**
   * Normalize answer for comparison
   * @param {string} answer - Answer to normalize
   * @returns {string} Normalized answer
   */
  static normalizeAnswer(answer) {
    if (typeof answer !== 'string') {
      return String(answer);
    }

    return answer
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Fuzzy string matching
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {boolean} Whether strings match
   */
  static fuzzyMatch(str1, str2, threshold = 0.8) {
    if (str1 === str2) return true;

    const similarity = this.calculateSimilarity(str1, str2);
    return similarity >= threshold;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  static calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= len2; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,      // deletion
          matrix[j - 1][i] + 1,      // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return 1 - (distance / maxLen);
  }

  /**
   * Keyword-based matching for short answers
   * @param {string} userAnswer - User's answer
   * @param {Array} correctAnswers - Array of correct answers
   * @param {number} minKeywords - Minimum number of keywords to match
   * @returns {boolean} Whether answer matches
   */
  static keywordMatch(userAnswer, correctAnswers, minKeywords = 2) {
    const userKeywords = this.extractKeywords(userAnswer);
    
    for (const correctAnswer of correctAnswers) {
      const correctKeywords = this.extractKeywords(correctAnswer);
      const matchingKeywords = userKeywords.filter(keyword => 
        correctKeywords.some(correct => 
          this.fuzzyMatch(keyword, correct, 0.7)
        )
      );

      if (matchingKeywords.length >= minKeywords) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract keywords from text
   * @param {string} text - Text to extract keywords from
   * @returns {Array} Array of keywords
   */
  static extractKeywords(text) {
    // Simple keyword extraction - remove common words and extract meaningful terms
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall'
    ]);

    return text
      .split(/\s+/)
      .map(word => word.toLowerCase().replace(/[^\w]/g, ''))
      .filter(word => word.length > 2 && !commonWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
  }

  /**
   * Calculate confidence score for answer matching
   * @param {string} userAnswer - User's answer
   * @param {Array} correctAnswers - Array of correct answers
   * @returns {number} Confidence score (0-1)
   */
  static calculateConfidence(userAnswer, correctAnswers) {
    let maxSimilarity = 0;

    for (const correctAnswer of correctAnswers) {
      const similarity = this.calculateSimilarity(userAnswer, correctAnswer);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  /**
   * Get validation feedback for incorrect answers
   * @param {Object} question - Question object
   * @param {*} userAnswer - User's answer
   * @param {Object} validationResult - Validation result
   * @returns {Object} Feedback object
   */
  static getFeedback(question, userAnswer, validationResult) {
    if (validationResult.isCorrect) {
      return {
        type: 'success',
        message: 'Correct!',
        explanation: question.explanation || 'Well done!'
      };
    }

    let feedback = {
      type: 'error',
      message: 'Incorrect answer',
      explanation: question.explanation || 'Please try again'
    };

    // Add specific feedback based on question type
    switch (question.questionType) {
      case 'mcq':
        feedback.hint = `The correct answer is: ${validationResult.correctAnswer}`;
        break;
      case 'fill-in-blank':
        feedback.hint = `Expected answer: ${validationResult.correctAnswer}`;
        if (question.acceptedAnswers && question.acceptedAnswers.length > 0) {
          feedback.alternatives = question.acceptedAnswers;
        }
        break;
      case 'short-answer':
        feedback.hint = `The correct answer is: ${validationResult.correctAnswer}`;
        feedback.confidence = validationResult.confidence;
        if (validationResult.confidence > 0.5) {
          feedback.message = 'Close! Try to be more specific.';
        }
        break;
    }

    return feedback;
  }
}

module.exports = AnswerValidator;
