const TopicPerformance = require('../models/TopicPerformance');
const Question = require('../models/Question');
const logger = require('../utils/logger');

/**
 * Adaptive Difficulty Engine Service
 * Manages topic-level performance tracking and difficulty adjustment
 */
class AdaptiveDifficultyEngine {
  /**
   * Record a student's attempt on a topic
   * @param {string} studentId - Student ID
   * @param {string} topicId - Topic ID
   * @param {boolean} isCorrect - Whether the answer was correct
   * @param {number} responseTimeMs - Response time in milliseconds
   * @param {number} questionDifficulty - Difficulty of the question attempted
   * @returns {Promise<Object>} Updated performance data
   */
  static async recordAttempt(studentId, topicId, isCorrect, responseTimeMs = 0, questionDifficulty = 0.5) {
    try {
      // Get or create topic performance record
      let performance = await TopicPerformance.findByStudentAndTopic(studentId, topicId);
      
      if (!performance) {
        performance = new TopicPerformance({
          studentId,
          topicId,
          currentDifficulty: questionDifficulty
        });
      }

      // Record the attempt
      await performance.recordAttempt(isCorrect, responseTimeMs);

      logger.info(`Recorded attempt for student ${studentId} on topic ${topicId}: ${isCorrect ? 'correct' : 'incorrect'}`);

      return {
        topicId,
        currentDifficulty: performance.currentDifficulty,
        masteryLevel: performance.masteryLevel,
        successRate: performance.successRate,
        attemptsCount: performance.attemptsCount,
        consecutiveFailures: performance.consecutiveFailures,
        consecutiveSuccesses: performance.consecutiveSuccesses
      };
    } catch (error) {
      logger.error('Error recording attempt:', error);
      throw error;
    }
  }

  /**
   * Get next question difficulty for a student on a topic
   * @param {string} studentId - Student ID
   * @param {string} topicId - Topic ID
   * @param {Array} excludeQuestionIds - Questions to exclude
   * @returns {Promise<Object>} Next question with adjusted difficulty
   */
  static async getNextQuestion(studentId, topicId, excludeQuestionIds = []) {
    try {
      // Get student's performance on this topic
      const performance = await TopicPerformance.findByStudentAndTopic(studentId, topicId);
      
      let targetDifficulty = 0.5; // Default difficulty
      
      if (performance) {
        targetDifficulty = performance.currentDifficulty;
        
        // Adjust difficulty based on recent performance
        if (performance.consecutiveFailures >= 3) {
          // Student struggling - reduce difficulty
          targetDifficulty = Math.max(0.1, targetDifficulty - 0.2);
        } else if (performance.consecutiveSuccesses >= 3) {
          // Student doing well - increase difficulty
          targetDifficulty = Math.min(0.9, targetDifficulty + 0.2);
        }
      }

      // Find questions with difficulty close to target
      const criteria = {
        topicId,
        difficulty: {
          $gte: Math.max(0.1, targetDifficulty - 0.2),
          $lte: Math.min(0.9, targetDifficulty + 0.2)
        },
        isActive: true
      };

      if (excludeQuestionIds.length > 0) {
        criteria._id = { $nin: excludeQuestionIds };
      }

      const questions = await Question.findByCriteria(criteria)
        .sort({ usageCount: 1, successRate: -1 })
        .limit(10);

      if (questions.length === 0) {
        // Fallback to any question in the topic
        const fallbackCriteria = {
          topicId,
          isActive: true
        };
        if (excludeQuestionIds.length > 0) {
          fallbackCriteria._id = { $nin: excludeQuestionIds };
        }
        
        const fallbackQuestions = await Question.findByCriteria(fallbackCriteria)
          .sort({ usageCount: 1 })
          .limit(5);

        if (fallbackQuestions.length === 0) {
          return null;
        }

        return fallbackQuestions[0];
      }

      // Select question with difficulty closest to target
      const selectedQuestion = questions.reduce((closest, current) => {
        const currentDiff = Math.abs(current.difficulty - targetDifficulty);
        const closestDiff = Math.abs(closest.difficulty - targetDifficulty);
        return currentDiff < closestDiff ? current : closest;
      });

      return selectedQuestion;
    } catch (error) {
      logger.error('Error getting next question:', error);
      throw error;
    }
  }

  /**
   * Get adaptive questions for a chapter
   * @param {string} studentId - Student ID
   * @param {string} chapterId - Chapter ID
   * @param {number} count - Number of questions needed
   * @param {Array} excludeQuestionIds - Questions to exclude
   * @returns {Promise<Array>} Array of adaptive questions
   */
  static async getAdaptiveQuestionsForChapter(studentId, chapterId, count = 10, excludeQuestionIds = []) {
    try {
      // Get all topics in the chapter
      const Chapter = require('../models/Chapter');
      const chapter = await Chapter.findById(chapterId).populate('topics');
      
      if (!chapter || !chapter.topics || chapter.topics.length === 0) {
        return [];
      }

      const questions = [];
      const questionsPerTopic = Math.ceil(count / chapter.topics.length);

      for (const topic of chapter.topics) {
        const topicQuestions = await this.getAdaptiveQuestionsForTopic(
          studentId, 
          topic._id, 
          questionsPerTopic, 
          excludeQuestionIds
        );
        questions.push(...topicQuestions);
      }

      // Shuffle and limit to requested count
      const shuffled = this.shuffleArray(questions);
      return shuffled.slice(0, count);
    } catch (error) {
      logger.error('Error getting adaptive questions for chapter:', error);
      throw error;
    }
  }

  /**
   * Get adaptive questions for a specific topic
   * @param {string} studentId - Student ID
   * @param {string} topicId - Topic ID
   * @param {number} count - Number of questions needed
   * @param {Array} excludeQuestionIds - Questions to exclude
   * @returns {Promise<Array>} Array of adaptive questions
   */
  static async getAdaptiveQuestionsForTopic(studentId, topicId, count = 5, excludeQuestionIds = []) {
    try {
      const questions = [];
      const usedQuestionIds = [...excludeQuestionIds];

      for (let i = 0; i < count; i++) {
        const question = await this.getNextQuestion(studentId, topicId, usedQuestionIds);
        
        if (!question) {
          break; // No more questions available
        }

        questions.push(question);
        usedQuestionIds.push(question._id);
      }

      return questions;
    } catch (error) {
      logger.error('Error getting adaptive questions for topic:', error);
      throw error;
    }
  }

  /**
   * Get student's performance summary for a chapter
   * @param {string} studentId - Student ID
   * @param {string} chapterId - Chapter ID
   * @returns {Promise<Object>} Performance summary
   */
  static async getChapterPerformanceSummary(studentId, chapterId) {
    try {
      const Chapter = require('../models/Chapter');
      const chapter = await Chapter.findById(chapterId).populate('topics');
      
      if (!chapter || !chapter.topics) {
        return {
          chapterId,
          totalTopics: 0,
          completedTopics: 0,
          averageMastery: 0,
          strugglingTopics: [],
          strongTopics: []
        };
      }

      const topicIds = chapter.topics.map(topic => topic._id);
      const performances = await TopicPerformance.find({
        studentId,
        topicId: { $in: topicIds }
      }).populate('topicId', 'topicName description');

      const summary = {
        chapterId,
        totalTopics: chapter.topics.length,
        completedTopics: performances.length,
        averageMastery: 0,
        strugglingTopics: [],
        strongTopics: [],
        topicPerformances: []
      };

      if (performances.length > 0) {
        // Calculate average mastery
        const masteryScores = performances.map(p => {
          switch (p.masteryLevel) {
            case 'beginner': return 0.25;
            case 'developing': return 0.5;
            case 'proficient': return 0.75;
            case 'advanced': return 1.0;
            default: return 0;
          }
        });
        summary.averageMastery = masteryScores.reduce((sum, score) => sum + score, 0) / masteryScores.length;

        // Categorize topics
        performances.forEach(performance => {
          const topicData = {
            topicId: performance.topicId._id,
            topicName: performance.topicId.topicName,
            masteryLevel: performance.masteryLevel,
            successRate: performance.successRate,
            attemptsCount: performance.attemptsCount,
            currentDifficulty: performance.currentDifficulty
          };

          summary.topicPerformances.push(topicData);

          if (performance.successRate < 0.4 && performance.attemptsCount >= 2) {
            summary.strugglingTopics.push(topicData);
          } else if (performance.successRate >= 0.8 && performance.attemptsCount >= 3) {
            summary.strongTopics.push(topicData);
          }
        });
      }

      return summary;
    } catch (error) {
      logger.error('Error getting chapter performance summary:', error);
      throw error;
    }
  }

  /**
   * Get struggling topics for a student
   * @param {string} studentId - Student ID
   * @param {number} threshold - Success rate threshold (default: 0.4)
   * @returns {Promise<Array>} Array of struggling topics
   */
  static async getStrugglingTopics(studentId, threshold = 0.4) {
    try {
      return await TopicPerformance.getStrugglingTopics(studentId, threshold);
    } catch (error) {
      logger.error('Error getting struggling topics:', error);
      throw error;
    }
  }

  /**
   * Get top performing topics for a student
   * @param {string} studentId - Student ID
   * @param {number} limit - Maximum number of topics to return
   * @returns {Promise<Array>} Array of top performing topics
   */
  static async getTopPerformingTopics(studentId, limit = 5) {
    try {
      return await TopicPerformance.getTopPerformingTopics(studentId, limit);
    } catch (error) {
      logger.error('Error getting top performing topics:', error);
      throw error;
    }
  }

  /**
   * Reset student's performance on a topic
   * @param {string} studentId - Student ID
   * @param {string} topicId - Topic ID
   * @returns {Promise<boolean>} Success status
   */
  static async resetTopicPerformance(studentId, topicId) {
    try {
      await TopicPerformance.findOneAndDelete({ studentId, topicId });
      logger.info(`Reset performance for student ${studentId} on topic ${topicId}`);
      return true;
    } catch (error) {
      logger.error('Error resetting topic performance:', error);
      throw error;
    }
  }

  /**
   * Get difficulty progression for a student
   * @param {string} studentId - Student ID
   * @param {string} topicId - Topic ID
   * @returns {Promise<Array>} Array of difficulty progression data
   */
  static async getDifficultyProgression(studentId, topicId) {
    try {
      const performance = await TopicPerformance.findByStudentAndTopic(studentId, topicId);
      
      if (!performance) {
        return [];
      }

      // This would require storing difficulty history in the TopicPerformance model
      // For now, return current difficulty
      return [{
        timestamp: performance.lastUpdated,
        difficulty: performance.currentDifficulty,
        masteryLevel: performance.masteryLevel,
        successRate: performance.successRate
      }];
    } catch (error) {
      logger.error('Error getting difficulty progression:', error);
      throw error;
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Calculate recommended study time for a topic
   * @param {string} studentId - Student ID
   * @param {string} topicId - Topic ID
   * @returns {Promise<number>} Recommended study time in minutes
   */
  static async getRecommendedStudyTime(studentId, topicId) {
    try {
      const performance = await TopicPerformance.findByStudentAndTopic(studentId, topicId);
      
      if (!performance) {
        return 30; // Default 30 minutes for new topics
      }

      // Base study time on performance
      let studyTime = 30; // Base time

      if (performance.successRate < 0.3) {
        studyTime = 60; // Struggling - more time needed
      } else if (performance.successRate < 0.6) {
        studyTime = 45; // Needs improvement
      } else if (performance.successRate >= 0.8) {
        studyTime = 15; // Doing well - less time needed
      }

      // Adjust based on attempts count
      if (performance.attemptsCount < 3) {
        studyTime += 15; // New topic - more time needed
      }

      return studyTime;
    } catch (error) {
      logger.error('Error calculating recommended study time:', error);
      return 30; // Default fallback
    }
  }
}

module.exports = AdaptiveDifficultyEngine;
