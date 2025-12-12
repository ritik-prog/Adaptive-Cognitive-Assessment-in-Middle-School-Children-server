const Recommendation = require('../models/Recommendation');
const TopicPerformance = require('../models/TopicPerformance');
const Question = require('../models/Question');
const { generateQuestion } = require('./llmClient');
const logger = require('../utils/logger');

/**
 * Recommendation Engine Service
 * Generates personalized learning recommendations based on student performance
 */
class RecommendationEngine {
  /**
   * Generate recommendations for incorrect answers
   * @param {string} studentId - Student ID
   * @param {string} sessionId - Session ID
   * @param {string} questionId - Question ID
   * @param {string} incorrectAnswer - Student's incorrect answer
   * @returns {Promise<Object>} Generated recommendations
   */
  static async generateRecommendationsForIncorrectAnswer(studentId, sessionId, questionId, incorrectAnswer) {
    try {
      const question = await Question.findById(questionId).populate('topicId chapterId');
      if (!question) {
        throw new Error('Question not found');
      }

      // Analyze the incorrect answer and generate recommendations
      const analysis = await this.analyzeIncorrectAnswer(question, incorrectAnswer);
      
      // Generate different types of recommendations
      const recommendations = [];

      // 1. Concept explanation recommendation
      if (analysis.missingConcepts.length > 0) {
        const conceptExplanation = await this.generateConceptExplanation(question, analysis.missingConcepts);
        recommendations.push({
          type: 'concept_explanation',
          content: conceptExplanation,
          priority: 'high',
          relatedTopics: [question.topicId._id]
        });
      }

      // 2. Step-by-step solution recommendation
      const stepByStepSolution = await this.generateStepByStepSolution(question, incorrectAnswer);
      recommendations.push({
        type: 'step_by_step_solution',
        content: stepByStepSolution,
        priority: 'high',
        relatedTopics: [question.topicId._id]
      });

      // 3. Practice questions recommendation
      const practiceQuestions = await this.generatePracticeQuestions(question, analysis.weakAreas);
      recommendations.push({
        type: 'practice_questions',
        content: practiceQuestions,
        priority: 'medium',
        relatedTopics: [question.topicId._id]
      });

      // 4. Learning resources recommendation
      const learningResources = await this.generateLearningResources(question, analysis.missingConcepts);
      recommendations.push({
        type: 'learning_resources',
        content: learningResources,
        priority: 'medium',
        relatedTopics: [question.topicId._id]
      });

      // 5. Study tips recommendation
      const studyTips = await this.generateStudyTips(question, analysis.errorType);
      recommendations.push({
        type: 'study_tips',
        content: studyTips,
        priority: 'low',
        relatedTopics: [question.topicId._id]
      });

      // Save recommendations to database
      const savedRecommendations = [];
      for (const rec of recommendations) {
        const recommendation = new Recommendation({
          studentId,
          sessionId,
          questionId,
          incorrectAnswer,
          recommendationType: rec.type,
          content: rec.content,
          priority: rec.priority,
          relatedTopics: rec.relatedTopics,
          generatedBy: 'ai',
          confidence: 0.8
        });

        await recommendation.save();
        savedRecommendations.push(recommendation);
      }

      logger.info(`Generated ${savedRecommendations.length} recommendations for student ${studentId}`);

      return {
        recommendations: savedRecommendations,
        analysis
      };
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      throw error;
    }
  }

  /**
   * Analyze incorrect answer to identify learning gaps
   * @param {Object} question - Question object
   * @param {string} incorrectAnswer - Student's incorrect answer
   * @returns {Promise<Object>} Analysis result
   */
  static async analyzeIncorrectAnswer(question, incorrectAnswer) {
    try {
      // Use AI to analyze the incorrect answer
      const prompt = `
        Analyze this incorrect answer and identify learning gaps:
        
        Question: ${question.stem}
        Correct Answer: ${question.correctAnswer || question.choices[question.correctIndex]}
        Student's Answer: ${incorrectAnswer}
        Question Type: ${question.questionType}
        Topic: ${question.topicId?.topicName || question.topic}
        
        Provide analysis in JSON format:
        {
          "errorType": "conceptual|calculation|misunderstanding|careless",
          "missingConcepts": ["concept1", "concept2"],
          "weakAreas": ["area1", "area2"],
          "suggestedFocus": "What the student should focus on",
          "difficultyLevel": "easy|medium|hard"
        }
      `;

      const analysis = await generateQuestion({
        topic: 'answer_analysis',
        grade: question.grade,
        difficulty: 0.5,
        mock: true // Use mock for now
      });

      // Parse the analysis (in real implementation, this would be proper JSON parsing)
      return {
        errorType: 'conceptual',
        missingConcepts: ['basic_concept', 'application'],
        weakAreas: ['problem_solving', 'concept_application'],
        suggestedFocus: 'Focus on understanding the fundamental concepts before applying them',
        difficultyLevel: 'medium'
      };
    } catch (error) {
      logger.error('Error analyzing incorrect answer:', error);
      return {
        errorType: 'unknown',
        missingConcepts: [],
        weakAreas: [],
        suggestedFocus: 'Review the topic and practice similar questions',
        difficultyLevel: 'medium'
      };
    }
  }

  /**
   * Generate concept explanation recommendation
   * @param {Object} question - Question object
   * @param {Array} missingConcepts - Missing concepts
   * @returns {Promise<string>} Concept explanation
   */
  static async generateConceptExplanation(question, missingConcepts) {
    try {
      const prompt = `
        Explain these concepts clearly for a ${question.grade}th grade student:
        Concepts: ${missingConcepts.join(', ')}
        Topic: ${question.topicId?.topicName || question.topic}
        
        Provide a clear, step-by-step explanation with examples.
      `;

      // In real implementation, this would call the LLM
      return `Let me explain the key concepts you need to understand:

1. **${missingConcepts[0] || 'Main Concept'}**: This is the fundamental idea behind this type of problem. Think of it as the foundation that everything else builds upon.

2. **${missingConcepts[1] || 'Application'}**: Once you understand the concept, you need to know how to apply it to solve problems.

3. **Practice**: The best way to master these concepts is through practice. Try solving similar problems step by step.

Remember: Don't rush through the explanation. Take your time to understand each concept before moving to the next one.`;
    } catch (error) {
      logger.error('Error generating concept explanation:', error);
      return 'Please review the fundamental concepts for this topic and practice similar problems.';
    }
  }

  /**
   * Generate step-by-step solution recommendation
   * @param {Object} question - Question object
   * @param {string} incorrectAnswer - Student's incorrect answer
   * @returns {Promise<string>} Step-by-step solution
   */
  static async generateStepByStepSolution(question, incorrectAnswer) {
    try {
      const correctAnswer = question.correctAnswer || question.choices[question.correctIndex];
      
      return `Here's how to solve this problem step by step:

**Step 1: Understand the question**
- Read the question carefully
- Identify what is being asked
- Note down the given information

**Step 2: Identify the approach**
- What method or formula should you use?
- What are the key concepts involved?

**Step 3: Solve step by step**
- Show your work clearly
- Check each step as you go
- Don't skip any important steps

**Step 4: Verify your answer**
- Does your answer make sense?
- Can you check it using a different method?

**Correct Answer**: ${correctAnswer}

**Your Answer**: ${incorrectAnswer}

**What went wrong**: Try to identify where your solution diverged from the correct approach.`;
    } catch (error) {
      logger.error('Error generating step-by-step solution:', error);
      return 'Please review the solution method and try solving similar problems step by step.';
    }
  }

  /**
   * Generate practice questions recommendation
   * @param {Object} question - Question object
   * @param {Array} weakAreas - Weak areas identified
   * @returns {Promise<string>} Practice questions recommendation
   */
  static async generatePracticeQuestions(question, weakAreas) {
    try {
      return `I recommend practicing these types of questions to improve:

**Focus Areas:**
${weakAreas.map(area => `- ${area}`).join('\n')}

**Practice Strategy:**
1. Start with easier problems on the same topic
2. Gradually increase difficulty
3. Focus on the areas where you made mistakes
4. Practice regularly for better retention

**Suggested Practice Questions:**
- Similar problems with different numbers
- Word problems involving the same concepts
- Problems that test your understanding step by step

**Tip**: Don't just solve problems - understand why each step is necessary. This will help you avoid similar mistakes in the future.`;
    } catch (error) {
      logger.error('Error generating practice questions:', error);
      return 'Practice similar problems focusing on the concepts you found difficult.';
    }
  }

  /**
   * Generate learning resources recommendation
   * @param {Object} question - Question object
   * @param {Array} missingConcepts - Missing concepts
   * @returns {Promise<string>} Learning resources recommendation
   */
  static async generateLearningResources(question, missingConcepts) {
    try {
      return `Here are some resources to help you understand these concepts better:

**Video Resources:**
- Khan Academy: Search for "${question.topicId?.topicName || question.topic}"
- YouTube: Look for "${missingConcepts[0] || 'basic concepts'} explained"

**Reading Materials:**
- Your textbook chapter on "${question.topicId?.topicName || question.topic}"
- Online articles about the fundamental concepts

**Interactive Resources:**
- Practice problems with instant feedback
- Concept explanation videos with examples
- Step-by-step solution guides

**Study Tips:**
- Take notes while watching videos
- Try to explain concepts to someone else
- Create your own examples to test understanding

**Remember**: Different people learn in different ways. Try different resources to find what works best for you.`;
    } catch (error) {
      logger.error('Error generating learning resources:', error);
      return 'Look for additional resources on this topic to strengthen your understanding.';
    }
  }

  /**
   * Generate study tips recommendation
   * @param {Object} question - Question object
   * @param {string} errorType - Type of error made
   * @returns {Promise<string>} Study tips
   */
  static async generateStudyTips(question, errorType) {
    try {
      const tips = {
        conceptual: [
          'Focus on understanding the "why" behind each concept',
          'Create concept maps to visualize relationships',
          'Practice explaining concepts in your own words',
          'Use analogies to relate new concepts to familiar ones'
        ],
        calculation: [
          'Show all your work step by step',
          'Double-check calculations',
          'Use estimation to verify answers',
          'Practice mental math for common calculations'
        ],
        misunderstanding: [
          'Read questions carefully and identify key words',
          'Break down complex problems into smaller parts',
          'Ask yourself what the question is really asking',
          'Practice with different wordings of the same concept'
        ],
        careless: [
          'Take your time and don\'t rush',
          'Read each question twice before answering',
          'Check your work before submitting',
          'Use a systematic approach for each problem'
        ]
      };

      const relevantTips = tips[errorType] || tips.conceptual;

      return `Here are some study tips based on the type of mistake you made:

**Study Tips for ${errorType} errors:**
${relevantTips.map(tip => `• ${tip}`).join('\n')}

**General Study Strategies:**
• Review your mistakes and understand why they happened
• Practice regularly with a variety of problems
• Don't be afraid to ask for help when you're stuck
• Celebrate small improvements and stay motivated

**Remember**: Making mistakes is part of learning. The important thing is to learn from them and improve.`;
    } catch (error) {
      logger.error('Error generating study tips:', error);
      return 'Focus on understanding the concepts and practice regularly to improve your performance.';
    }
  }

  /**
   * Get recommendations for a student
   * @param {string} studentId - Student ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of recommendations
   */
  static async getRecommendationsForStudent(studentId, options = {}) {
    try {
      return await Recommendation.findByStudent(studentId, options);
    } catch (error) {
      logger.error('Error getting recommendations for student:', error);
      throw error;
    }
  }

  /**
   * Get recommendations for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} Array of recommendations
   */
  static async getRecommendationsForSession(sessionId) {
    try {
      return await Recommendation.find({ sessionId }).populate('questionId', 'stem topic');
    } catch (error) {
      logger.error('Error getting recommendations for session:', error);
      throw error;
    }
  }

  /**
   * Mark recommendation as helpful
   * @param {string} recommendationId - Recommendation ID
   * @param {boolean} isHelpful - Whether the recommendation was helpful
   * @param {string} feedback - Optional feedback
   * @returns {Promise<Object>} Updated recommendation
   */
  static async markRecommendationAsHelpful(recommendationId, isHelpful, feedback = '') {
    try {
      const recommendation = await Recommendation.findById(recommendationId);
      if (!recommendation) {
        throw new Error('Recommendation not found');
      }

      await recommendation.markAsHelpful(isHelpful, feedback);
      return recommendation;
    } catch (error) {
      logger.error('Error marking recommendation as helpful:', error);
      throw error;
    }
  }

  /**
   * Get recommendation statistics for a student
   * @param {string} studentId - Student ID
   * @returns {Promise<Object>} Recommendation statistics
   */
  static async getRecommendationStatistics(studentId) {
    try {
      const stats = await Recommendation.getStatistics(studentId);
      return stats.length > 0 ? stats[0] : {
        totalRecommendations: 0,
        readRecommendations: 0,
        helpfulRecommendations: 0,
        unhelpfulRecommendations: 0,
        averageConfidence: 0
      };
    } catch (error) {
      logger.error('Error getting recommendation statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up expired recommendations
   * @returns {Promise<number>} Number of recommendations cleaned up
   */
  static async cleanupExpiredRecommendations() {
    try {
      const result = await Recommendation.cleanupExpired();
      logger.info(`Cleaned up ${result.deletedCount} expired recommendations`);
      return result.deletedCount;
    } catch (error) {
      logger.error('Error cleaning up expired recommendations:', error);
      throw error;
    }
  }
}

module.exports = RecommendationEngine;
