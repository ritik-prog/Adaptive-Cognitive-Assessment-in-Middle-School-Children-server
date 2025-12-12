const mongoose = require('mongoose');
require('dotenv').config();

const Chapter = require('../models/Chapter');
const Topic = require('../models/Topic');
const Question = require('../models/Question');
const User = require('../models/User');
const logger = require('../utils/logger');

// NCERT Chapter data for Classes 6 and 7
const ncertChapters = {
  '6': {
    'Math': [
      { number: 1, name: 'Knowing Our Numbers', description: 'Understanding large numbers, place value, and number operations' },
      { number: 2, name: 'Whole Numbers', description: 'Properties of whole numbers, number line, and operations' },
      { number: 3, name: 'Playing with Numbers', description: 'Factors, multiples, prime and composite numbers' },
      { number: 4, name: 'Basic Geometrical Ideas', description: 'Points, lines, angles, and basic shapes' },
      { number: 5, name: 'Understanding Elementary Shapes', description: 'Types of angles, triangles, quadrilaterals, and circles' },
      { number: 6, name: 'Integers', description: 'Positive and negative numbers, number line, and operations' },
      { number: 7, name: 'Fractions', description: 'Understanding fractions, equivalent fractions, and operations' },
      { number: 8, name: 'Decimals', description: 'Decimal numbers, place value, and operations' },
      { number: 9, name: 'Data Handling', description: 'Collection, organization, and representation of data' },
      { number: 10, name: 'Mensuration', description: 'Perimeter and area of basic shapes' },
      { number: 11, name: 'Algebra', description: 'Introduction to variables and simple equations' },
      { number: 12, name: 'Ratio and Proportion', description: 'Understanding ratios and proportions' },
      { number: 13, name: 'Symmetry', description: 'Line symmetry and rotational symmetry' },
      { number: 14, name: 'Practical Geometry', description: 'Construction of basic geometric shapes' }
    ],
    'Science': [
      { number: 1, name: 'Food: Where Does It Come From?', description: 'Sources of food, plant and animal products' },
      { number: 2, name: 'Components of Food', description: 'Nutrients, balanced diet, and deficiency diseases' },
      { number: 3, name: 'Fibre to Fabric', description: 'Natural and synthetic fibres, processing of fibres' },
      { number: 4, name: 'Sorting Materials into Groups', description: 'Properties of materials, classification' },
      { number: 5, name: 'Separation of Substances', description: 'Methods of separation, filtration, evaporation' },
      { number: 6, name: 'Changes Around Us', description: 'Physical and chemical changes' },
      { number: 7, name: 'Getting to Know Plants', description: 'Parts of plants, types of plants, photosynthesis' },
      { number: 8, name: 'Body Movements', description: 'Human skeleton, joints, and movement' },
      { number: 9, name: 'The Living Organisms and Their Surroundings', description: 'Adaptation, habitat, and characteristics of living things' },
      { number: 10, name: 'Motion and Measurement of Distances', description: 'Types of motion, measurement, and units' },
      { number: 11, name: 'Light, Shadows and Reflections', description: 'Properties of light, shadows, and reflections' },
      { number: 12, name: 'Electricity and Circuits', description: 'Electric current, circuits, and electrical safety' },
      { number: 13, name: 'Fun with Magnets', description: 'Properties of magnets, magnetic and non-magnetic materials' },
      { number: 14, name: 'Water', description: 'Water cycle, conservation, and importance of water' },
      { number: 15, name: 'Air Around Us', description: 'Composition of air, importance of air' },
      { number: 16, name: 'Garbage In, Garbage Out', description: 'Waste management, recycling, and composting' }
    ],
    'Social Science': [
      { number: 1, name: 'Understanding Diversity', description: 'Unity in diversity, different cultures and traditions' },
      { number: 2, name: 'Diversity and Discrimination', description: 'Prejudice, stereotypes, and equality' },
      { number: 3, name: 'What is Government?', description: 'Types of government, democracy, and voting' },
      { number: 4, name: 'Key Elements of a Democratic Government', description: 'Participation, resolution of conflict, and equality' },
      { number: 5, name: 'Panchayati Raj', description: 'Local self-government, panchayats, and their functions' },
      { number: 6, name: 'Rural Administration', description: 'Land records, police, and patwari' },
      { number: 7, name: 'Urban Administration', description: 'Municipal corporation, municipal council, and their functions' },
      { number: 8, name: 'Rural Livelihoods', description: 'Different types of work in rural areas' },
      { number: 9, name: 'Urban Livelihoods', description: 'Different types of work in urban areas' }
    ]
  },
  '7': {
    'Math': [
      { number: 1, name: 'Integers', description: 'Properties of integers, addition, subtraction, multiplication, and division' },
      { number: 2, name: 'Fractions and Decimals', description: 'Operations with fractions and decimals' },
      { number: 3, name: 'Data Handling', description: 'Mean, median, mode, and probability' },
      { number: 4, name: 'Simple Equations', description: 'Solving linear equations in one variable' },
      { number: 5, name: 'Lines and Angles', description: 'Types of angles, parallel lines, and transversals' },
      { number: 6, name: 'The Triangle and Its Properties', description: 'Properties of triangles, Pythagoras theorem' },
      { number: 7, name: 'Congruence of Triangles', description: 'Criteria for congruence of triangles' },
      { number: 8, name: 'Comparing Quantities', description: 'Percentage, profit and loss, simple interest' },
      { number: 9, name: 'Rational Numbers', description: 'Properties of rational numbers and operations' },
      { number: 10, name: 'Practical Geometry', description: 'Construction of triangles and quadrilaterals' },
      { number: 11, name: 'Perimeter and Area', description: 'Area of rectangles, squares, triangles, and circles' },
      { number: 12, name: 'Algebraic Expressions', description: 'Terms, factors, coefficients, and operations' },
      { number: 13, name: 'Exponents and Powers', description: 'Laws of exponents and applications' },
      { number: 14, name: 'Symmetry', description: 'Line symmetry and rotational symmetry' },
      { number: 15, name: 'Visualising Solid Shapes', description: '3D shapes, nets, and different views' }
    ],
    'Science': [
      { number: 1, name: 'Nutrition in Plants', description: 'Photosynthesis, modes of nutrition in plants' },
      { number: 2, name: 'Nutrition in Animals', description: 'Human digestive system, nutrition in different animals' },
      { number: 3, name: 'Fibre to Fabric', description: 'Animal fibres, processing of wool and silk' },
      { number: 4, name: 'Heat', description: 'Temperature, thermometers, and heat transfer' },
      { number: 5, name: 'Acids, Bases and Salts', description: 'Properties of acids and bases, indicators' },
      { number: 6, name: 'Physical and Chemical Changes', description: 'Types of changes, rusting, and crystallization' },
      { number: 7, name: 'Weather, Climate and Adaptations of Animals to Climate', description: 'Weather, climate, and adaptations' },
      { number: 8, name: 'Winds, Storms and Cyclones', description: 'Air pressure, wind patterns, and cyclones' },
      { number: 9, name: 'Soil', description: 'Types of soil, soil profile, and soil conservation' },
      { number: 10, name: 'Respiration in Organisms', description: 'Aerobic and anaerobic respiration' },
      { number: 11, name: 'Transportation in Animals and Plants', description: 'Circulatory system, transportation in plants' },
      { number: 12, name: 'Reproduction in Plants', description: 'Asexual and sexual reproduction in plants' },
      { number: 13, name: 'Motion and Time', description: 'Speed, distance, time, and graphs' },
      { number: 14, name: 'Electric Current and Its Effects', description: 'Electric current, heating effect, magnetic effect' },
      { number: 15, name: 'Light', description: 'Reflection of light, mirrors, and lenses' },
      { number: 16, name: 'Water: A Precious Resource', description: 'Water cycle, groundwater, and water conservation' },
      { number: 17, name: 'Forests: Our Lifeline', description: 'Importance of forests, food chains, and food webs' },
      { number: 18, name: 'Wastewater Story', description: 'Sewage treatment, sanitation, and water pollution' }
    ],
    'Social Science': [
      { number: 1, name: 'On Equality', description: 'Equality in democracy, dignity, and freedom' },
      { number: 2, name: 'Role of the Government in Health', description: 'Public health, healthcare services, and government role' },
      { number: 3, name: 'How the State Government Works', description: 'State government structure and functions' },
      { number: 4, name: 'Growing up as Boys and Girls', description: 'Gender roles, stereotypes, and equality' },
      { number: 5, name: 'Women Change the World', description: 'Women\'s movements, education, and empowerment' },
      { number: 6, name: 'Understanding Media', description: 'Media and democracy, advertising, and social issues' },
      { number: 7, name: 'Understanding Advertising', description: 'Advertising and its impact on society' },
      { number: 8, name: 'Markets Around Us', description: 'Types of markets, buying and selling' },
      { number: 9, name: 'A Shirt in the Market', description: 'Production process, supply chain, and market dynamics' }
    ]
  }
};

// Topics for each chapter
const chapterTopics = {
  'Math': [
    'Number System', 'Operations', 'Geometry', 'Algebra', 'Data Handling', 'Mensuration'
  ],
  'Science': [
    'Living World', 'Materials', 'Energy', 'Motion', 'Light', 'Electricity', 'Environment'
  ],
  'Social Science': [
    'Democracy', 'Government', 'Society', 'Economy', 'Environment', 'History'
  ]
};

// Sample questions for different question types
const sampleQuestions = {
  'Math': {
    'mcq': [
      {
        stem: 'What is the place value of 5 in the number 5,432?',
        choices: ['5', '50', '500', '5000'],
        correctIndex: 3,
        difficulty: 0.3
      },
      {
        stem: 'Which of the following is a prime number?',
        choices: ['4', '6', '7', '8'],
        correctIndex: 2,
        difficulty: 0.4
      }
    ],
    'fill-in-blank': [
      {
        stem: 'The sum of angles in a triangle is _____ degrees.',
        correctAnswer: '180',
        acceptedAnswers: ['180', 'one hundred eighty'],
        difficulty: 0.5
      },
      {
        stem: 'The formula for area of rectangle is length × _____.',
        correctAnswer: 'breadth',
        acceptedAnswers: ['breadth', 'width'],
        difficulty: 0.4
      }
    ],
    'short-answer': [
      {
        stem: 'Explain why 1 is neither prime nor composite.',
        correctAnswer: '1 has only one factor (itself), while prime numbers have exactly two factors and composite numbers have more than two factors.',
        difficulty: 0.6
      },
      {
        stem: 'What is the difference between perimeter and area?',
        correctAnswer: 'Perimeter is the distance around a shape, while area is the space inside a shape.',
        difficulty: 0.5
      }
    ]
  },
  'Science': {
    'mcq': [
      {
        stem: 'Which gas is essential for photosynthesis?',
        choices: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
        correctIndex: 1,
        difficulty: 0.4
      },
      {
        stem: 'What is the process by which plants make their food?',
        choices: ['Respiration', 'Photosynthesis', 'Digestion', 'Excretion'],
        correctIndex: 1,
        difficulty: 0.3
      }
    ],
    'fill-in-blank': [
      {
        stem: 'The green pigment in leaves is called _____.',
        correctAnswer: 'chlorophyll',
        acceptedAnswers: ['chlorophyll'],
        difficulty: 0.4
      },
      {
        stem: 'The process of breaking down food into simpler substances is called _____.',
        correctAnswer: 'digestion',
        acceptedAnswers: ['digestion'],
        difficulty: 0.5
      }
    ],
    'short-answer': [
      {
        stem: 'Why do we need to conserve water?',
        correctAnswer: 'Water is essential for life, limited resource, needed for agriculture, industry, and daily activities.',
        difficulty: 0.6
      },
      {
        stem: 'What are the different types of pollution?',
        correctAnswer: 'Air pollution, water pollution, soil pollution, and noise pollution.',
        difficulty: 0.5
      }
    ]
  },
  'Social Science': {
    'mcq': [
      {
        stem: 'What is the full form of MLA?',
        choices: ['Member of Legislative Assembly', 'Member of Local Authority', 'Member of Legal Affairs', 'Member of Land Administration'],
        correctIndex: 0,
        difficulty: 0.4
      },
      {
        stem: 'Who is the head of the state government?',
        choices: ['Prime Minister', 'Chief Minister', 'Governor', 'President'],
        correctIndex: 2,
        difficulty: 0.5
      }
    ],
    'fill-in-blank': [
      {
        stem: 'The Constitution of India was adopted on _____.',
        correctAnswer: '26th January 1950',
        acceptedAnswers: ['26th January 1950', '26 January 1950'],
        difficulty: 0.6
      },
      {
        stem: 'The fundamental right to equality is guaranteed under Article _____.',
        correctAnswer: '14',
        acceptedAnswers: ['14', 'fourteen'],
        difficulty: 0.7
      }
    ],
    'short-answer': [
      {
        stem: 'What is democracy?',
        correctAnswer: 'Democracy is a form of government where people have the power to choose their leaders through voting.',
        difficulty: 0.5
      },
      {
        stem: 'Why is it important to have a constitution?',
        correctAnswer: 'Constitution provides basic rules, protects fundamental rights, defines government structure, and ensures justice.',
        difficulty: 0.6
      }
    ]
  }
};

async function seedNCERTChapters() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cognitive-assessment');
    logger.info('Connected to MongoDB');

    // Get or create a default admin user for creating chapters
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = new User({
        name: 'System Admin',
        email: 'admin@system.com',
        passwordHash: 'hashedpassword',
        role: 'admin'
      });
      await adminUser.save();
      logger.info('Created default admin user');
    }

    let totalChapters = 0;
    let totalTopics = 0;
    let totalQuestions = 0;

    // Create chapters for each class and subject
    for (const [classLevel, subjects] of Object.entries(ncertChapters)) {
      for (const [subject, chapters] of Object.entries(subjects)) {
        for (const chapterData of chapters) {
          // Check if chapter already exists
          const existingChapter = await Chapter.findOne({
            class: classLevel,
            subject,
            chapterNumber: chapterData.number
          });

          if (existingChapter) {
            logger.info(`Chapter ${chapterData.name} already exists, skipping...`);
            continue;
          }

          // Create chapter
          const chapter = new Chapter({
            class: classLevel,
            subject,
            chapterNumber: chapterData.number,
            chapterName: chapterData.name,
            description: chapterData.description,
            ncertReference: `NCERT Class ${classLevel} ${subject} Chapter ${chapterData.number}`,
            createdBy: adminUser._id
          });

          await chapter.save();
          totalChapters++;

          // Create topics for this chapter
          const subjectTopics = chapterTopics[subject] || ['General'];
          const topicsPerChapter = Math.min(3, subjectTopics.length);
          const selectedTopics = subjectTopics.slice(0, topicsPerChapter);

          for (let i = 0; i < selectedTopics.length; i++) {
            const topic = new Topic({
              chapterId: chapter._id,
              topicName: selectedTopics[i],
              description: `Topics related to ${selectedTopics[i]} in ${chapterData.name}`,
              difficulty: 0.3 + (i * 0.2), // Vary difficulty
              concepts: [`Basic ${selectedTopics[i]}`, `Advanced ${selectedTopics[i]}`],
              learningObjectives: [
                `Understand basic concepts of ${selectedTopics[i]}`,
                `Apply ${selectedTopics[i]} in problem solving`,
                `Analyze complex ${selectedTopics[i]} problems`
              ],
              createdBy: adminUser._id
            });

            await topic.save();
            chapter.topics.push(topic._id);
            totalTopics++;

            // Create sample questions for this topic
            const questionTypes = ['mcq', 'fill-in-blank', 'short-answer'];
            const questionsPerType = 3;

            for (const questionType of questionTypes) {
              const sampleQuestionsForType = sampleQuestions[subject][questionType] || [];
              
              for (let j = 0; j < Math.min(questionsPerType, sampleQuestionsForType.length); j++) {
                const sampleQ = sampleQuestionsForType[j];
                
                const question = new Question({
                  stem: sampleQ.stem,
                  questionType,
                  grade: classLevel,
                  topic: selectedTopics[i],
                  chapterId: chapter._id,
                  topicId: topic._id,
                  difficulty: sampleQ.difficulty,
                  createdBy: adminUser._id,
                  isGenerated: false,
                  generatedBy: 'seed'
                });

                // Set question-specific fields
                if (questionType === 'mcq') {
                  question.choices = sampleQ.choices;
                  question.correctIndex = sampleQ.correctIndex;
                } else if (questionType === 'fill-in-blank') {
                  question.correctAnswer = sampleQ.correctAnswer;
                  question.acceptedAnswers = sampleQ.acceptedAnswers || [sampleQ.correctAnswer];
                  question.blanksCount = 1;
                } else if (questionType === 'short-answer') {
                  question.correctAnswer = sampleQ.correctAnswer;
                  question.acceptedAnswers = [sampleQ.correctAnswer];
                }

                // Add explanation
                question.explanation = `This question tests your understanding of ${selectedTopics[i]} concepts. Make sure you understand the fundamental principles before attempting to solve it.`;

                await question.save();
                totalQuestions++;
              }
            }
          }

          await chapter.save();
          logger.info(`Created chapter: ${chapterData.name} with ${selectedTopics.length} topics`);
        }
      }
    }

    logger.info(`Seed completed successfully!`);
    logger.info(`Created ${totalChapters} chapters`);
    logger.info(`Created ${totalTopics} topics`);
    logger.info(`Created ${totalQuestions} questions`);

  } catch (error) {
    logger.error('Error seeding NCERT chapters:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the seed function if this file is executed directly
if (require.main === module) {
  seedNCERTChapters()
    .then(() => {
      logger.info('NCERT chapters seeded successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Error seeding NCERT chapters:', error);
      process.exit(1);
    });
}

module.exports = seedNCERTChapters;
