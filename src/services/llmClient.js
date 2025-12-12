const OpenAI = require('openai');
const GeneratedQuestion = require('../models/GeneratedQuestion');
const logger = require('../utils/logger');

// Initialize OpenAI client
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// Mock question templates for different topics and difficulties
const mockQuestions = {
  mathematics: {
    6: {
      0.2: {
        stem: 'Sarah has 15 apples. She gives 7 apples to her friend. How many apples does Sarah have left?',
        choices: ['6 apples', '7 apples', '8 apples', '9 apples'],
        correctIndex: 2,
        difficulty: 0.2,
        tags: ['arithmetic', 'subtraction', 'word-problem']
      },
      0.5: {
        stem: 'A rectangle has a length of 8 cm and a width of 5 cm. What is the area of the rectangle?',
        choices: ['13 cm²', '26 cm²', '40 cm²', '45 cm²'],
        correctIndex: 2,
        difficulty: 0.5,
        tags: ['geometry', 'area', 'multiplication']
      },
      0.8: {
        stem: 'If 3x + 7 = 22, what is the value of x?',
        choices: ['x = 3', 'x = 4', 'x = 5', 'x = 6'],
        correctIndex: 2,
        difficulty: 0.8,
        tags: ['algebra', 'equations', 'solving']
      }
    },
    7: {
      0.2: {
        stem: 'What is 3/4 of 24?',
        choices: ['16', '18', '20', '22'],
        correctIndex: 1,
        difficulty: 0.2,
        tags: ['fractions', 'multiplication', 'basic']
      },
      0.5: {
        stem: 'A triangle has angles measuring 45°, 60°, and x°. What is the value of x?',
        choices: ['65°', '75°', '85°', '95°'],
        correctIndex: 1,
        difficulty: 0.5,
        tags: ['geometry', 'triangles', 'angles']
      },
      0.8: {
        stem: 'Solve for y: 2y - 5 = 3y + 1',
        choices: ['y = -6', 'y = -4', 'y = 4', 'y = 6'],
        correctIndex: 0,
        difficulty: 0.8,
        tags: ['algebra', 'equations', 'variables']
      }
    },
    8: {
      0.2: {
        stem: 'What is the square root of 64?',
        choices: ['6', '7', '8', '9'],
        correctIndex: 2,
        difficulty: 0.2,
        tags: ['square-roots', 'basic', 'arithmetic']
      },
      0.5: {
        stem: 'If a circle has a radius of 6 cm, what is its circumference? (Use π ≈ 3.14)',
        choices: ['18.84 cm', '37.68 cm', '113.04 cm', '226.08 cm'],
        correctIndex: 1,
        difficulty: 0.5,
        tags: ['geometry', 'circles', 'circumference']
      },
      0.8: {
        stem: 'A quadratic equation x² - 5x + 6 = 0 has solutions at x = 2 and x = 3. What is the vertex of this parabola?',
        choices: ['(2.5, -0.25)', '(2.5, 0.25)', '(2, 0)', '(3, 0)'],
        correctIndex: 0,
        difficulty: 0.8,
        tags: ['quadratics', 'parabolas', 'vertex']
      }
    },
    9: {
      0.2: {
        stem: 'What is 2³ × 2²?',
        choices: ['2⁵', '2⁶', '4⁵', '4⁶'],
        correctIndex: 0,
        difficulty: 0.2,
        tags: ['exponents', 'multiplication', 'basic']
      },
      0.5: {
        stem: 'In a right triangle with legs of length 3 and 4, what is the length of the hypotenuse?',
        choices: ['5', '6', '7', '8'],
        correctIndex: 0,
        difficulty: 0.5,
        tags: ['geometry', 'pythagorean-theorem', 'triangles']
      },
      0.8: {
        stem: 'If log₂(x) = 3, what is the value of x?',
        choices: ['6', '8', '9', '12'],
        correctIndex: 1,
        difficulty: 0.8,
        tags: ['logarithms', 'exponents', 'advanced']
      }
    }
  },
  science: {
    6: {
      0.2: {
        stem: 'What is the process by which plants make their own food?',
        choices: ['Respiration', 'Photosynthesis', 'Digestion', 'Fermentation'],
        correctIndex: 1,
        difficulty: 0.2,
        tags: ['biology', 'plants', 'photosynthesis']
      },
      0.5: {
        stem: 'Which of the following is NOT a state of matter?',
        choices: ['Solid', 'Liquid', 'Gas', 'Energy'],
        correctIndex: 3,
        difficulty: 0.5,
        tags: ['chemistry', 'states-of-matter', 'basic']
      },
      0.8: {
        stem: 'What happens to the volume of a gas when its temperature increases and pressure remains constant?',
        choices: ['Volume decreases', 'Volume increases', 'Volume stays the same', 'Volume becomes zero'],
        correctIndex: 1,
        difficulty: 0.8,
        tags: ['chemistry', 'gas-laws', 'temperature']
      }
    }
  },
  'reading-comprehension': {
    6: {
      0.2: {
        stem: 'Based on the passage: "The cat sat on the mat." What did the cat do?',
        choices: ['The cat ran', 'The cat sat on the mat', 'The cat slept', 'The cat played'],
        correctIndex: 1,
        difficulty: 0.2,
        tags: ['reading', 'comprehension', 'basic']
      },
      0.5: {
        stem: 'In the story, why did the main character decide to help the old woman?',
        choices: ['Because she offered money', 'Because it was the right thing to do', 'Because his friends told him to', 'Because he had nothing else to do'],
        correctIndex: 1,
        difficulty: 0.5,
        tags: ['reading', 'inference', 'character-motivation']
      },
      0.8: {
        stem: 'What can you infer about the author\'s attitude toward technology based on the passage?',
        choices: ['The author is enthusiastic about technology', 'The author is cautious about technology', 'The author is indifferent to technology', 'The author is opposed to technology'],
        correctIndex: 1,
        difficulty: 0.8,
        tags: ['reading', 'inference', 'author-attitude']
      }
    }
  }
};

// Generate a deterministic mock question based on topic, grade, and difficulty
function generateMockQuestion(topic, grade, difficulty) {
  const topicData = mockQuestions[topic.toLowerCase()];
  if (!topicData) {
    // Fallback to mathematics if topic not found
    return generateMockQuestion('mathematics', grade, difficulty);
  }

  const gradeData = topicData[grade];
  if (!gradeData) {
    // Fallback to grade 6 if grade not found
    return generateMockQuestion(topic, '6', difficulty);
  }

  // Find the closest difficulty level
  const difficultyLevels = Object.keys(gradeData).map(Number).sort((a, b) => a - b);
  const closestDifficulty = difficultyLevels.reduce((prev, curr) =>
    Math.abs(curr - difficulty) < Math.abs(prev - difficulty) ? curr : prev
  );

  const question = gradeData[closestDifficulty.toString()];
  if (!question) {
    // Fallback to first available difficulty
    const firstDifficulty = difficultyLevels[0].toString();
    return gradeData[firstDifficulty];
  }

  return {
    ...question,
    difficulty // Use the requested difficulty, not the template difficulty
  };
}

// Generate question using OpenAI API
async function generateQuestionWithOpenAI(topic, grade, difficulty) {
  const startTime = Date.now();

  try {
    const prompt = `Generate a multiple-choice question for ${grade}th grade students on the topic of "${topic}" with a difficulty level of ${difficulty} (0=easy, 1=hard).

Requirements:
- Create an age-appropriate question that tests inferential reasoning
- Include 3-4 multiple choice options
- Provide a clear, unambiguous correct answer
- Use appropriate vocabulary for ${grade}th grade level
- Include relevant tags for categorization

Return ONLY a valid JSON object with this exact structure:
{
  "stem": "The question text here",
  "choices": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "difficulty": ${difficulty},
  "tags": ["tag1", "tag2", "tag3"]
}

Do not include any other text, explanations, or formatting.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content creator specializing in creating age-appropriate multiple-choice questions for middle school students. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const responseText = completion.choices[0].message.content.trim();
    const latencyMs = Date.now() - startTime;

    // Try to parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate the response structure
    if (!parsedResponse.stem || !parsedResponse.choices ||
        typeof parsedResponse.correctIndex !== 'number' ||
        !Array.isArray(parsedResponse.tags)) {
      throw new Error('Invalid question structure from OpenAI');
    }

    return {
      question: parsedResponse,
      latencyMs,
      modelUsed: 'gpt-3.5-turbo'
    };
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw new Error(`Failed to generate question: ${error.message}`);
  }
}

// Main function to generate questions
async function generateQuestion({ topic, grade, difficulty, opts = {} }) {
  const isMock = process.env.LLM_MOCK === 'true' || opts.mock === true;

  try {
    let result;

    if (isMock) {
      // Generate mock question
      const question = generateMockQuestion(topic, grade, difficulty);
      result = {
        question,
        latencyMs: 50, // Simulated latency
        modelUsed: 'mock'
      };
    } else {
      // Check if OpenAI API key is available
      if (!openai) {
        throw new Error('OpenAI API key not configured');
      }

      // Generate question using OpenAI
      result = await generateQuestionWithOpenAI(topic, grade, difficulty);
    }

    // Store the generation record
    const generatedQuestion = new GeneratedQuestion({
      inputPrompt: `Topic: ${topic}, Grade: ${grade}, Difficulty: ${difficulty}`,
      outputJSON: JSON.stringify(result.question),
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
      parameters: {
        topic,
        grade,
        difficulty
      }
    });

    // Validate the generated question
    const validationErrors = generatedQuestion.validateQuestion();
    if (validationErrors.length > 0) {
      logger.warn('Generated question validation errors:', validationErrors);
    }

    // Calculate quality score
    generatedQuestion.calculateQualityScore();

    // Save to database
    await generatedQuestion.save();

    logger.info(`Generated question using ${result.modelUsed} in ${result.latencyMs}ms`);

    return {
      question: {
        id: generatedQuestion._id,
        stem: result.question.stem,
        choices: result.question.choices,
        correctIndex: result.question.correctIndex,
        difficulty: result.question.difficulty,
        tags: result.question.tags
      },
      generationId: generatedQuestion._id,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs
    };
  } catch (error) {
    logger.error('Question generation error:', error);
    throw error;
  }
}

module.exports = {
  generateQuestion
};
