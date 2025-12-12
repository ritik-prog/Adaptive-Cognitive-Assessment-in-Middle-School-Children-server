const { generateQuestion } = require('./llmClient');
const logger = require('../utils/logger');

/**
 * Translation Service for Regional Language Support
 * Supports Hindi, Telugu, Tamil with caching for performance
 */
class TranslationService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    this.supportedLanguages = ['en', 'hi', 'te', 'ta'];
    this.languageNames = {
      'en': 'English',
      'hi': 'Hindi',
      'te': 'Telugu',
      'ta': 'Tamil'
    };
  }

  /**
   * Translate text to target language
   * @param {string} text - Text to translate
   * @param {string} targetLanguage - Target language code
   * @param {string} sourceLanguage - Source language code (default: 'en')
   * @returns {Promise<string>} Translated text
   */
  async translateText(text, targetLanguage, sourceLanguage = 'en') {
    try {
      if (targetLanguage === sourceLanguage) {
        return text;
      }

      if (!this.supportedLanguages.includes(targetLanguage)) {
        throw new Error(`Unsupported target language: ${targetLanguage}`);
      }

      // Check cache first
      const cacheKey = `${sourceLanguage}-${targetLanguage}-${this.hashText(text)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Translate using AI
      const translatedText = await this.performTranslation(text, targetLanguage, sourceLanguage);
      
      // Cache the result
      this.setCache(cacheKey, translatedText);
      
      return translatedText;
    } catch (error) {
      logger.error('Translation error:', error);
      // Return original text if translation fails
      return text;
    }
  }

  /**
   * Translate question object
   * @param {Object} question - Question object
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<Object>} Translated question object
   */
  async translateQuestion(question, targetLanguage) {
    try {
      const translatedQuestion = { ...question };

      // Translate main question text
      translatedQuestion.stem = await this.translateText(question.stem, targetLanguage);

      // Translate choices for MCQ
      if (question.questionType === 'mcq' && question.choices) {
        translatedQuestion.choices = await Promise.all(
          question.choices.map(choice => this.translateText(choice, targetLanguage))
        );
      }

      // Translate correct answer for fill-in-blank and short-answer
      if (question.correctAnswer) {
        translatedQuestion.correctAnswer = await this.translateText(question.correctAnswer, targetLanguage);
      }

      // Translate accepted answers
      if (question.acceptedAnswers && question.acceptedAnswers.length > 0) {
        translatedQuestion.acceptedAnswers = await Promise.all(
          question.acceptedAnswers.map(answer => this.translateText(answer, targetLanguage))
        );
      }

      // Translate explanation
      if (question.explanation) {
        translatedQuestion.explanation = await this.translateText(question.explanation, targetLanguage);
      }

      // Translate passage
      if (question.passage) {
        translatedQuestion.passage = await this.translateText(question.passage, targetLanguage);
      }

      return translatedQuestion;
    } catch (error) {
      logger.error('Question translation error:', error);
      return question; // Return original question if translation fails
    }
  }

  /**
   * Translate chapter information
   * @param {Object} chapter - Chapter object
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<Object>} Translated chapter object
   */
  async translateChapter(chapter, targetLanguage) {
    try {
      const translatedChapter = { ...chapter };

      translatedChapter.chapterName = await this.translateText(chapter.chapterName, targetLanguage);
      
      if (chapter.description) {
        translatedChapter.description = await this.translateText(chapter.description, targetLanguage);
      }

      if (chapter.ncertReference) {
        translatedChapter.ncertReference = await this.translateText(chapter.ncertReference, targetLanguage);
      }

      return translatedChapter;
    } catch (error) {
      logger.error('Chapter translation error:', error);
      return chapter;
    }
  }

  /**
   * Translate topic information
   * @param {Object} topic - Topic object
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<Object>} Translated topic object
   */
  async translateTopic(topic, targetLanguage) {
    try {
      const translatedTopic = { ...topic };

      translatedTopic.topicName = await this.translateText(topic.topicName, targetLanguage);
      
      if (topic.description) {
        translatedTopic.description = await this.translateText(topic.description, targetLanguage);
      }

      if (topic.concepts && topic.concepts.length > 0) {
        translatedTopic.concepts = await Promise.all(
          topic.concepts.map(concept => this.translateText(concept, targetLanguage))
        );
      }

      if (topic.learningObjectives && topic.learningObjectives.length > 0) {
        translatedTopic.learningObjectives = await Promise.all(
          topic.learningObjectives.map(objective => this.translateText(objective, targetLanguage))
        );
      }

      return translatedTopic;
    } catch (error) {
      logger.error('Topic translation error:', error);
      return topic;
    }
  }

  /**
   * Translate recommendation content
   * @param {Object} recommendation - Recommendation object
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<Object>} Translated recommendation object
   */
  async translateRecommendation(recommendation, targetLanguage) {
    try {
      const translatedRecommendation = { ...recommendation };

      translatedRecommendation.content = await this.translateText(recommendation.content, targetLanguage);
      
      if (recommendation.feedback) {
        translatedRecommendation.feedback = await this.translateText(recommendation.feedback, targetLanguage);
      }

      if (recommendation.resources && recommendation.resources.length > 0) {
        translatedRecommendation.resources = await Promise.all(
          recommendation.resources.map(resource => ({
            ...resource,
            title: this.translateText(resource.title, targetLanguage),
            description: this.translateText(resource.description, targetLanguage)
          }))
        );
      }

      return translatedRecommendation;
    } catch (error) {
      logger.error('Recommendation translation error:', error);
      return recommendation;
    }
  }

  /**
   * Translate UI text
   * @param {string} key - UI text key
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<string>} Translated UI text
   */
  async translateUI(key, targetLanguage) {
    try {
      const uiTexts = {
        'en': {
          'start_assessment': 'Start Assessment',
          'practice_mode': 'Practice Mode',
          'revision_mode': 'Revision Mode',
          'next_question': 'Next Question',
          'submit_answer': 'Submit Answer',
          'show_solution': 'Show Solution',
          'retry_question': 'Retry Question',
          'question_number': 'Question',
          'time_remaining': 'Time Remaining',
          'score': 'Score',
          'correct': 'Correct',
          'incorrect': 'Incorrect',
          'explanation': 'Explanation',
          'recommendations': 'Recommendations',
          'weak_topics': 'Weak Topics',
          'strong_topics': 'Strong Topics',
          'mastery_level': 'Mastery Level',
          'attempts': 'Attempts',
          'accuracy': 'Accuracy',
          'progress': 'Progress'
        },
        'hi': {
          'start_assessment': 'मूल्यांकन शुरू करें',
          'practice_mode': 'अभ्यास मोड',
          'revision_mode': 'पुनरावृत्ति मोड',
          'next_question': 'अगला प्रश्न',
          'submit_answer': 'उत्तर जमा करें',
          'show_solution': 'समाधान दिखाएं',
          'retry_question': 'प्रश्न पुनः प्रयास करें',
          'question_number': 'प्रश्न',
          'time_remaining': 'शेष समय',
          'score': 'स्कोर',
          'correct': 'सही',
          'incorrect': 'गलत',
          'explanation': 'व्याख्या',
          'recommendations': 'सुझाव',
          'weak_topics': 'कमजोर विषय',
          'strong_topics': 'मजबूत विषय',
          'mastery_level': 'निपुणता स्तर',
          'attempts': 'प्रयास',
          'accuracy': 'सटीकता',
          'progress': 'प्रगति'
        },
        'te': {
          'start_assessment': 'మూల్యాంకనం ప్రారంభించండి',
          'practice_mode': 'అభ్యాస మోడ్',
          'revision_mode': 'పునరావృత్తి మోడ్',
          'next_question': 'తదుపరి ప్రశ్న',
          'submit_answer': 'సమాధానం సమర్పించండి',
          'show_solution': 'పరిష్కారం చూపించండి',
          'retry_question': 'ప్రశ్నను మళ్లీ ప్రయత్నించండి',
          'question_number': 'ప్రశ్న',
          'time_remaining': 'మిగిలిన సమయం',
          'score': 'స్కోర్',
          'correct': 'సరైనది',
          'incorrect': 'తప్పు',
          'explanation': 'వివరణ',
          'recommendations': 'సిఫార్సులు',
          'weak_topics': 'బలహీన అంశాలు',
          'strong_topics': 'బలమైన అంశాలు',
          'mastery_level': 'నైపుణ్య స్థాయి',
          'attempts': 'ప్రయత్నాలు',
          'accuracy': 'ఖచ్చితత్వం',
          'progress': 'పురోగతి'
        },
        'ta': {
          'start_assessment': 'மதிப்பீட்டைத் தொடங்குங்கள்',
          'practice_mode': 'பயிற்சி பயன்முறை',
          'revision_mode': 'மறுபார்வை பயன்முறை',
          'next_question': 'அடுத்த கேள்வி',
          'submit_answer': 'பதிலை சமர்ப்பிக்கவும்',
          'show_solution': 'தீர்வைக் காட்டு',
          'retry_question': 'கேள்வியை மீண்டும் முயற்சிக்கவும்',
          'question_number': 'கேள்வி',
          'time_remaining': 'மீதமுள்ள நேரம்',
          'score': 'மதிப்பெண்',
          'correct': 'சரி',
          'incorrect': 'தவறு',
          'explanation': 'விளக்கம்',
          'recommendations': 'பரிந்துரைகள்',
          'weak_topics': 'பலவீனமான தலைப்புகள்',
          'strong_topics': 'வலுவான தலைப்புகள்',
          'mastery_level': 'திறன் நிலை',
          'attempts': 'முயற்சிகள்',
          'accuracy': 'துல்லியம்',
          'progress': 'முன்னேற்றம்'
        }
      };

      const languageTexts = uiTexts[targetLanguage] || uiTexts['en'];
      return languageTexts[key] || key;
    } catch (error) {
      logger.error('UI translation error:', error);
      return key;
    }
  }

  /**
   * Perform actual translation using AI
   * @param {string} text - Text to translate
   * @param {string} targetLanguage - Target language code
   * @param {string} sourceLanguage - Source language code
   * @returns {Promise<string>} Translated text
   */
  async performTranslation(text, targetLanguage, sourceLanguage) {
    try {
      const languageNames = {
        'en': 'English',
        'hi': 'Hindi',
        'te': 'Telugu',
        'ta': 'Tamil'
      };

      const prompt = `Translate the following text from ${languageNames[sourceLanguage]} to ${languageNames[targetLanguage]}. 
      Keep the meaning accurate and use appropriate terminology for educational content. 
      If the text contains mathematical expressions or scientific terms, keep them in their original form.
      
      Text to translate: "${text}"
      
      Translation:`;

      // Use AI for translation
      const response = await generateQuestion({
        topic: 'translation',
        grade: '6',
        difficulty: 0.5,
        mock: true // Use mock for now
      });

      // In real implementation, this would be proper AI translation
      return this.getMockTranslation(text, targetLanguage);
    } catch (error) {
      logger.error('AI translation error:', error);
      return text;
    }
  }

  /**
   * Get mock translation for development
   * @param {string} text - Text to translate
   * @param {string} targetLanguage - Target language code
   * @returns {string} Mock translated text
   */
  getMockTranslation(text, targetLanguage) {
    const mockTranslations = {
      'hi': {
        'What is the capital of India?': 'भारत की राजधानी क्या है?',
        'Solve this equation': 'इस समीकरण को हल करें',
        'Choose the correct answer': 'सही उत्तर चुनें',
        'Fill in the blank': 'रिक्त स्थान भरें',
        'Explain your answer': 'अपने उत्तर की व्याख्या करें'
      },
      'te': {
        'What is the capital of India?': 'భారతదేశ రాజధాని ఏమిటి?',
        'Solve this equation': 'ఈ సమీకరణాన్ని పరిష్కరించండి',
        'Choose the correct answer': 'సరైన సమాధానాన్ని ఎంచుకోండి',
        'Fill in the blank': 'ఖాళీని పూరించండి',
        'Explain your answer': 'మీ సమాధానాన్ని వివరించండి'
      },
      'ta': {
        'What is the capital of India?': 'இந்தியாவின் தலைநகரம் என்ன?',
        'Solve this equation': 'இந்த சமன்பாட்டை தீர்க்கவும்',
        'Choose the correct answer': 'சரியான பதிலைத் தேர்ந்தெடுக்கவும்',
        'Fill in the blank': 'வெற்றிடத்தை நிரப்பவும்',
        'Explain your answer': 'உங்கள் பதிலை விளக்குங்கள்'
      }
    };

    return mockTranslations[targetLanguage]?.[text] || text;
  }

  /**
   * Get text from cache
   * @param {string} key - Cache key
   * @returns {string|null} Cached text or null
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.value;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Set text in cache
   * @param {string} key - Cache key
   * @param {string} value - Value to cache
   */
  setCache(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Generate hash for text
   * @param {string} text - Text to hash
   * @returns {string} Hash string
   */
  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      supportedLanguages: this.supportedLanguages,
      languageNames: this.languageNames
    };
  }

  /**
   * Get supported languages
   * @returns {Array} Array of supported language codes
   */
  getSupportedLanguages() {
    return this.supportedLanguages;
  }

  /**
   * Get language name
   * @param {string} languageCode - Language code
   * @returns {string} Language name
   */
  getLanguageName(languageCode) {
    return this.languageNames[languageCode] || languageCode;
  }
}

// Create singleton instance
const translationService = new TranslationService();

module.exports = translationService;
