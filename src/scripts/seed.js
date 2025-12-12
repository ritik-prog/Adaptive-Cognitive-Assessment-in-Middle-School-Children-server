require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Question = require('../models/Question');
const logger = require('../utils/logger');

// Sample data
const sampleUsers = [
  {
    name: 'John Smith',
    email: 'john.smith@school.edu',
    password: 'password123',
    role: 'admin'
  },
  {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@school.edu',
    password: 'password123',
    role: 'teacher'
  },
  {
    name: 'Mike Wilson',
    email: 'mike.wilson@school.edu',
    password: 'password123',
    role: 'teacher'
  },
  {
    name: 'Emma Davis',
    email: 'emma.davis@school.edu',
    password: 'password123',
    role: 'student',
    grade: '6',
    consentFlag: true,
    parentEmail: 'parent.davis@email.com',
    schoolName: 'Lincoln Middle School'
  },
  {
    name: 'Alex Brown',
    email: 'alex.brown@school.edu',
    password: 'password123',
    role: 'student',
    grade: '7',
    consentFlag: true,
    parentEmail: 'parent.brown@email.com',
    schoolName: 'Lincoln Middle School'
  },
  {
    name: 'Sophia Garcia',
    email: 'sophia.garcia@school.edu',
    password: 'password123',
    role: 'student',
    grade: '8',
    consentFlag: true,
    parentEmail: 'parent.garcia@email.com',
    schoolName: 'Lincoln Middle School'
  },
  {
    name: 'Liam Martinez',
    email: 'liam.martinez@school.edu',
    password: 'password123',
    role: 'student',
    grade: '9',
    consentFlag: true,
    parentEmail: 'parent.martinez@email.com',
    schoolName: 'Lincoln Middle School'
  }
];

const sampleQuestions = [
  // Grade 6 Questions
  {
    stem: 'Sarah has 15 apples. She gives 7 apples to her friend. How many apples does Sarah have left?',
    choices: ['6 apples', '7 apples', '8 apples', '9 apples'],
    correctIndex: 2,
    difficulty: 0.2,
    tags: ['arithmetic', 'subtraction', 'word-problem'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'To find how many apples Sarah has left, subtract 7 from 15: 15 - 7 = 8 apples.'
  },
  {
    stem: 'What is 3/4 of 24?',
    choices: ['16', '18', '20', '22'],
    correctIndex: 1,
    difficulty: 0.3,
    tags: ['fractions', 'multiplication', 'basic'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'To find 3/4 of 24, multiply 24 by 3/4: 24 × 3/4 = 18.'
  },
  {
    stem: 'A rectangle has a length of 8 cm and a width of 5 cm. What is the area of the rectangle?',
    choices: ['13 cm²', '26 cm²', '40 cm²', '45 cm²'],
    correctIndex: 2,
    difficulty: 0.5,
    tags: ['geometry', 'area', 'multiplication'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'The area of a rectangle is length × width: 8 cm × 5 cm = 40 cm².'
  },
  {
    stem: 'What is the process by which plants make their own food?',
    choices: ['Respiration', 'Photosynthesis', 'Digestion', 'Fermentation'],
    correctIndex: 1,
    difficulty: 0.2,
    tags: ['biology', 'plants', 'photosynthesis'],
    grade: '6',
    topic: 'science',
    explanation: 'Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to produce glucose and oxygen.'
  },
  {
    stem: 'Which of the following is NOT a state of matter?',
    choices: ['Solid', 'Liquid', 'Gas', 'Energy'],
    correctIndex: 3,
    difficulty: 0.4,
    tags: ['chemistry', 'states-of-matter', 'basic'],
    grade: '6',
    topic: 'science',
    explanation: 'Energy is not a state of matter. The three main states of matter are solid, liquid, and gas.'
  },

  // Grade 7 Questions
  {
    stem: 'If 3x + 7 = 22, what is the value of x?',
    choices: ['x = 3', 'x = 4', 'x = 5', 'x = 6'],
    correctIndex: 2,
    difficulty: 0.6,
    tags: ['algebra', 'equations', 'solving'],
    grade: '7',
    topic: 'mathematics',
    explanation: 'Solve for x: 3x + 7 = 22, so 3x = 15, therefore x = 5.'
  },
  {
    stem: 'A triangle has angles measuring 45°, 60°, and x°. What is the value of x?',
    choices: ['65°', '75°', '85°', '95°'],
    correctIndex: 1,
    difficulty: 0.5,
    tags: ['geometry', 'triangles', 'angles'],
    grade: '7',
    topic: 'mathematics',
    explanation: 'The sum of angles in a triangle is 180°. So 45° + 60° + x° = 180°, therefore x = 75°.'
  },
  {
    stem: 'What happens to the volume of a gas when its temperature increases and pressure remains constant?',
    choices: ['Volume decreases', 'Volume increases', 'Volume stays the same', 'Volume becomes zero'],
    correctIndex: 1,
    difficulty: 0.7,
    tags: ['chemistry', 'gas-laws', 'temperature'],
    grade: '7',
    topic: 'science',
    explanation: 'According to Charles\'s Law, the volume of a gas is directly proportional to its temperature when pressure is constant.'
  },
  {
    stem: 'In the story, why did the main character decide to help the old woman?',
    choices: ['Because she offered money', 'Because it was the right thing to do', 'Because his friends told him to', 'Because he had nothing else to do'],
    correctIndex: 1,
    difficulty: 0.5,
    tags: ['reading', 'inference', 'character-motivation'],
    grade: '7',
    topic: 'reading-comprehension',
    passage: 'The old woman struggled with her heavy bags as she walked down the street. Marcus noticed her from across the road and immediately felt compelled to help, even though he was running late for his appointment.',
    explanation: 'The passage suggests Marcus helped because he felt it was the right thing to do, not for personal gain or external pressure.'
  },

  // Grade 8 Questions
  {
    stem: 'What is the square root of 64?',
    choices: ['6', '7', '8', '9'],
    correctIndex: 2,
    difficulty: 0.3,
    tags: ['square-roots', 'basic', 'arithmetic'],
    grade: '8',
    topic: 'mathematics',
    explanation: 'The square root of 64 is 8 because 8 × 8 = 64.'
  },
  {
    stem: 'If a circle has a radius of 6 cm, what is its circumference? (Use π ≈ 3.14)',
    choices: ['18.84 cm', '37.68 cm', '113.04 cm', '226.08 cm'],
    correctIndex: 1,
    difficulty: 0.5,
    tags: ['geometry', 'circles', 'circumference'],
    grade: '8',
    topic: 'mathematics',
    explanation: 'Circumference = 2πr = 2 × 3.14 × 6 = 37.68 cm.'
  },
  {
    stem: 'A quadratic equation x² - 5x + 6 = 0 has solutions at x = 2 and x = 3. What is the vertex of this parabola?',
    choices: ['(2.5, -0.25)', '(2.5, 0.25)', '(2, 0)', '(3, 0)'],
    correctIndex: 0,
    difficulty: 0.8,
    tags: ['quadratics', 'parabolas', 'vertex'],
    grade: '8',
    topic: 'mathematics',
    explanation: 'The vertex of a parabola is at the midpoint of the x-intercepts: (2+3)/2 = 2.5. Substituting x=2.5 gives y = (2.5)² - 5(2.5) + 6 = -0.25.'
  },
  {
    stem: 'What can you infer about the author\'s attitude toward technology based on the passage?',
    choices: ['The author is enthusiastic about technology', 'The author is cautious about technology', 'The author is indifferent to technology', 'The author is opposed to technology'],
    correctIndex: 1,
    difficulty: 0.8,
    tags: ['reading', 'inference', 'author-attitude'],
    grade: '8',
    topic: 'reading-comprehension',
    passage: 'While technology has brought many benefits to our lives, we must be careful not to become overly dependent on it. The author discusses both the advantages and potential drawbacks of our digital age.',
    explanation: 'The author shows a balanced but cautious approach, acknowledging benefits while warning about over-dependence.'
  },

  // Grade 9 Questions
  {
    stem: 'What is 2³ × 2²?',
    choices: ['2⁵', '2⁶', '4⁵', '4⁶'],
    correctIndex: 0,
    difficulty: 0.4,
    tags: ['exponents', 'multiplication', 'basic'],
    grade: '9',
    topic: 'mathematics',
    explanation: 'When multiplying powers with the same base, add the exponents: 2³ × 2² = 2^(3+2) = 2⁵.'
  },
  {
    stem: 'In a right triangle with legs of length 3 and 4, what is the length of the hypotenuse?',
    choices: ['5', '6', '7', '8'],
    correctIndex: 0,
    difficulty: 0.5,
    tags: ['geometry', 'pythagorean-theorem', 'triangles'],
    grade: '9',
    topic: 'mathematics',
    explanation: 'Using the Pythagorean theorem: a² + b² = c², so 3² + 4² = 9 + 16 = 25, therefore c = 5.'
  },
  {
    stem: 'If log₂(x) = 3, what is the value of x?',
    choices: ['6', '8', '9', '12'],
    correctIndex: 1,
    difficulty: 0.8,
    tags: ['logarithms', 'exponents', 'advanced'],
    grade: '9',
    topic: 'mathematics',
    explanation: 'If log₂(x) = 3, then x = 2³ = 8.'
  },
  {
    stem: 'Which of the following best describes the process of cellular respiration?',
    choices: ['Converting light energy to chemical energy', 'Breaking down glucose to release energy', 'Building proteins from amino acids', 'Storing energy in ATP molecules'],
    correctIndex: 1,
    difficulty: 0.6,
    tags: ['biology', 'cellular-respiration', 'energy'],
    grade: '9',
    topic: 'science',
    explanation: 'Cellular respiration is the process by which cells break down glucose to release energy, producing ATP as a result.'
  },
  {
    stem: 'What is the main difference between a compound and a mixture?',
    choices: ['Compounds are always solid, mixtures can be any state', 'Compounds have fixed composition, mixtures have variable composition', 'Compounds are always natural, mixtures are always artificial', 'Compounds are always pure, mixtures are always impure'],
    correctIndex: 1,
    difficulty: 0.7,
    tags: ['chemistry', 'compounds', 'mixtures'],
    grade: '9',
    topic: 'science',
    explanation: 'Compounds have a fixed chemical composition with elements bonded together, while mixtures have variable composition with components that are not chemically bonded.'
  },

  // Additional questions for variety
  {
    stem: 'What is the next number in the sequence: 2, 4, 8, 16, ?',
    choices: ['20', '24', '32', '64'],
    correctIndex: 2,
    difficulty: 0.6,
    tags: ['patterns', 'sequences', 'multiplication'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'Each number is double the previous one: 2, 4, 8, 16, 32.'
  },
  {
    stem: 'Which planet is closest to the Sun?',
    choices: ['Venus', 'Mercury', 'Earth', 'Mars'],
    correctIndex: 1,
    difficulty: 0.3,
    tags: ['astronomy', 'planets', 'solar-system'],
    grade: '6',
    topic: 'science',
    explanation: 'Mercury is the planet closest to the Sun in our solar system.'
  },
  {
    stem: 'What is the capital of France?',
    choices: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctIndex: 2,
    difficulty: 0.2,
    tags: ['geography', 'capitals', 'europe'],
    grade: '6',
    topic: 'social-studies',
    explanation: 'Paris is the capital and largest city of France.'
  },
  {
    stem: 'In the equation y = 2x + 3, what is the slope?',
    choices: ['2', '3', '5', 'x'],
    correctIndex: 0,
    difficulty: 0.6,
    tags: ['algebra', 'linear-equations', 'slope'],
    grade: '8',
    topic: 'mathematics',
    explanation: 'In the slope-intercept form y = mx + b, the slope is the coefficient of x, which is 2.'
  },
  {
    stem: 'What is the chemical symbol for gold?',
    choices: ['Go', 'Gd', 'Au', 'Ag'],
    correctIndex: 2,
    difficulty: 0.4,
    tags: ['chemistry', 'elements', 'symbols'],
    grade: '7',
    topic: 'science',
    explanation: 'The chemical symbol for gold is Au, derived from the Latin word "aurum".'
  }
];

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cognitive-assessment', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function clearDatabase() {
  try {
    await User.deleteMany({});
    await StudentProfile.deleteMany({});
    await Question.deleteMany({});
    logger.info('Database cleared');
  } catch (error) {
    logger.error('Error clearing database:', error);
    throw error;
  }
}

async function seedUsers() {
  try {
    const createdUsers = [];

    for (const userData of sampleUsers) {
      const { grade, consentFlag, parentEmail, schoolName, ...userFields } = userData;

      // Create user
      const user = new User(userFields);
      await user.save();
      createdUsers.push(user);

      // Create student profile if role is student
      if (userData.role === 'student') {
        const studentProfile = new StudentProfile({
          userId: user._id,
          grade,
          consentFlag,
          parentEmail,
          schoolName,
          learningPreferences: {
            difficulty: 'medium',
            topics: ['mathematics', 'science']
          }
        });
        await studentProfile.save();
      }
    }

    logger.info(`Created ${createdUsers.length} users`);
    return createdUsers;
  } catch (error) {
    logger.error('Error seeding users:', error);
    throw error;
  }
}

async function seedQuestions() {
  try {
    const createdQuestions = [];

    for (const questionData of sampleQuestions) {
      const question = new Question({
        ...questionData,
        isGenerated: false,
        generatedBy: 'seed',
        isActive: true
      });
      await question.save();
      createdQuestions.push(question);
    }

    logger.info(`Created ${createdQuestions.length} questions`);
    return createdQuestions;
  } catch (error) {
    logger.error('Error seeding questions:', error);
    throw error;
  }
}

async function seed() {
  try {
    logger.info('Starting database seeding...');

    await connectDatabase();
    await clearDatabase();

    const users = await seedUsers();
    const questions = await seedQuestions();

    logger.info('Database seeding completed successfully!');
    logger.info(`Created ${users.length} users and ${questions.length} questions`);

    // Display login credentials
    console.log('\n=== Login Credentials ===');
    console.log('Admin: john.smith@school.edu / password123');
    console.log('Teacher: sarah.johnson@school.edu / password123');
    console.log('Student: emma.davis@school.edu / password123');
    console.log('========================\n');

    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seed();
}

module.exports = { seed, connectDatabase, clearDatabase, seedUsers, seedQuestions };
