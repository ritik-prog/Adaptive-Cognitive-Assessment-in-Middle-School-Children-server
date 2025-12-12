require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Question = require('../models/Question');
const AssessmentSession = require('../models/AssessmentSession');
const Chapter = require('../models/Chapter');
const Topic = require('../models/Topic');
const logger = require('../utils/logger');

// Enhanced sample data with more diverse accounts
const sampleUsers = [
  // Admin Accounts
  {
    name: 'Dr. Sarah Johnson',
    email: 'admin@cognitiveschool.edu',
    password: 'admin123',
    role: 'admin'
  },
  {
    name: 'Principal Michael Chen',
    email: 'principal@cognitiveschool.edu',
    password: 'admin123',
    role: 'admin'
  },

  // Teacher Accounts
  {
    name: 'Ms. Emily Rodriguez',
    email: 'emily.rodriguez@cognitiveschool.edu',
    password: 'teacher123',
    role: 'teacher'
  },
  {
    name: 'Mr. David Thompson',
    email: 'david.thompson@cognitiveschool.edu',
    password: 'teacher123',
    role: 'teacher'
  },
  {
    name: 'Dr. Lisa Wang',
    email: 'lisa.wang@cognitiveschool.edu',
    password: 'teacher123',
    role: 'teacher'
  },
  {
    name: 'Mr. James Wilson',
    email: 'james.wilson@cognitiveschool.edu',
    password: 'teacher123',
    role: 'teacher'
  },
  {
    name: 'Ms. Maria Garcia',
    email: 'maria.garcia@cognitiveschool.edu',
    password: 'teacher123',
    role: 'teacher'
  },

  // Grade 6 Students
  {
    name: 'Emma Davis',
    email: 'emma.davis@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '6',
    consentFlag: true,
    parentEmail: 'parent.davis@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'Alex Johnson',
    email: 'alex.johnson@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '6',
    consentFlag: true,
    parentEmail: 'parent.johnson@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'Sophia Martinez',
    email: 'sophia.martinez@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '6',
    consentFlag: true,
    parentEmail: 'parent.martinez@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'Noah Brown',
    email: 'noah.brown@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '6',
    consentFlag: true,
    parentEmail: 'parent.brown@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },

  // Grade 7 Students
  {
    name: 'Liam Wilson',
    email: 'liam.wilson@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '7',
    consentFlag: true,
    parentEmail: 'parent.wilson@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'Olivia Garcia',
    email: 'olivia.garcia@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '7',
    consentFlag: true,
    parentEmail: 'parent.garcia@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'William Anderson',
    email: 'william.anderson@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '7',
    consentFlag: true,
    parentEmail: 'parent.anderson@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'Ava Taylor',
    email: 'ava.taylor@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '7',
    consentFlag: true,
    parentEmail: 'parent.taylor@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },

  // Grade 8 Students
  {
    name: 'James Thomas',
    email: 'james.thomas@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '8',
    consentFlag: true,
    parentEmail: 'parent.thomas@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'Isabella Jackson',
    email: 'isabella.jackson@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '8',
    consentFlag: true,
    parentEmail: 'parent.jackson@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'Benjamin White',
    email: 'benjamin.white@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '8',
    consentFlag: true,
    parentEmail: 'parent.white@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'Mia Harris',
    email: 'mia.harris@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '8',
    consentFlag: true,
    parentEmail: 'parent.harris@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },

  // Grade 9 Students
  {
    name: 'Lucas Martin',
    email: 'lucas.martin@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '9',
    consentFlag: true,
    parentEmail: 'parent.martin@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'Charlotte Thompson',
    email: 'charlotte.thompson@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '9',
    consentFlag: true,
    parentEmail: 'parent.thompson@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'Henry Garcia',
    email: 'henry.garcia@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '9',
    consentFlag: true,
    parentEmail: 'parent.garcia2@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  },
  {
    name: 'Amelia Martinez',
    email: 'amelia.martinez@cognitiveschool.edu',
    password: 'student123',
    role: 'student',
    grade: '9',
    consentFlag: true,
    parentEmail: 'parent.martinez2@email.com',
    schoolName: 'Cognitive Assessment Middle School'
  }
];

// Enhanced sample questions with more variety
const sampleQuestions = [
  // Grade 6 Mathematics
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
    stem: 'What is 12 × 8?',
    choices: ['84', '96', '104', '108'],
    correctIndex: 1,
    difficulty: 0.3,
    tags: ['arithmetic', 'multiplication', 'basic'],
    grade: '6',
    topic: 'mathematics',
    explanation: '12 × 8 = 96. You can calculate this as 10 × 8 + 2 × 8 = 80 + 16 = 96.'
  },
  {
    stem: 'If a pizza is cut into 8 equal slices and you eat 3 slices, what fraction of the pizza is left?',
    choices: ['3/8', '5/8', '1/2', '2/3'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['fractions', 'subtraction', 'word-problem'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'If you eat 3 out of 8 slices, then 8 - 3 = 5 slices are left. So 5/8 of the pizza remains.'
  },
  {
    stem: 'What is the perimeter of a square with sides of length 6 cm?',
    choices: ['12 cm', '18 cm', '24 cm', '36 cm'],
    correctIndex: 2,
    difficulty: 0.4,
    tags: ['geometry', 'perimeter', 'squares'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'The perimeter of a square is 4 × side length. So 4 × 6 cm = 24 cm.'
  },
  {
    stem: 'What is 144 ÷ 12?',
    choices: ['10', '11', '12', '13'],
    correctIndex: 2,
    difficulty: 0.3,
    tags: ['arithmetic', 'division', 'basic'],
    grade: '6',
    topic: 'mathematics',
    explanation: '144 ÷ 12 = 12. You can verify this by checking that 12 × 12 = 144.'
  },
  {
    stem: 'A store sells apples for $0.50 each. How much do 6 apples cost?',
    choices: ['$2.50', '$3.00', '$3.50', '$4.00'],
    correctIndex: 1,
    difficulty: 0.3,
    tags: ['arithmetic', 'multiplication', 'money', 'word-problem'],
    grade: '6',
    topic: 'mathematics',
    explanation: '6 apples × $0.50 each = $3.00 total cost.'
  },
  {
    stem: 'What is 7² (7 squared)?',
    choices: ['42', '49', '56', '63'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['arithmetic', 'exponents', 'squares'],
    grade: '6',
    topic: 'mathematics',
    explanation: '7² = 7 × 7 = 49.'
  },
  {
    stem: 'If a triangle has a base of 10 cm and height of 6 cm, what is its area?',
    choices: ['30 cm²', '32 cm²', '60 cm²', '66 cm²'],
    correctIndex: 0,
    difficulty: 0.5,
    tags: ['geometry', 'area', 'triangles'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'Area of triangle = (1/2) × base × height = (1/2) × 10 × 6 = 30 cm².'
  },
  {
    stem: 'What is the value of 5 + 3 × 2?',
    choices: ['16', '11', '13', '10'],
    correctIndex: 1,
    difficulty: 0.5,
    tags: ['arithmetic', 'order-of-operations', 'basic'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'Following order of operations: 3 × 2 = 6, then 5 + 6 = 11.'
  },
  {
    stem: 'A number increased by 15 equals 42. What is the number?',
    choices: ['25', '27', '29', '31'],
    correctIndex: 1,
    difficulty: 0.5,
    tags: ['algebra', 'equations', 'word-problem'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'Let x be the number. Then x + 15 = 42, so x = 42 - 15 = 27.'
  },
  {
    stem: 'What is 0.6 as a fraction in simplest form?',
    choices: ['3/5', '6/10', '2/3', '1/2'],
    correctIndex: 0,
    difficulty: 0.4,
    tags: ['fractions', 'decimals', 'conversion'],
    grade: '6',
    topic: 'mathematics',
    explanation: '0.6 = 6/10 = 3/5 when simplified by dividing both numerator and denominator by 2.'
  },
  {
    stem: 'What is the greatest common factor (GCF) of 12 and 18?',
    choices: ['3', '4', '6', '9'],
    correctIndex: 2,
    difficulty: 0.6,
    tags: ['arithmetic', 'factors', 'gcf'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'Factors of 12: 1, 2, 3, 4, 6, 12. Factors of 18: 1, 2, 3, 6, 9, 18. The largest common factor is 6.'
  },
  {
    stem: 'If a car travels 60 miles in 2 hours, what is its average speed?',
    choices: ['25 mph', '30 mph', '35 mph', '40 mph'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['arithmetic', 'division', 'speed', 'word-problem'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'Average speed = distance ÷ time = 60 miles ÷ 2 hours = 30 mph.'
  },
  {
    stem: 'What is the least common multiple (LCM) of 4 and 6?',
    choices: ['12', '18', '24', '30'],
    correctIndex: 0,
    difficulty: 0.6,
    tags: ['arithmetic', 'multiples', 'lcm'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'Multiples of 4: 4, 8, 12, 16, 20... Multiples of 6: 6, 12, 18, 24... The smallest common multiple is 12.'
  },
  {
    stem: 'A circle has a diameter of 14 cm. What is its radius?',
    choices: ['7 cm', '14 cm', '21 cm', '28 cm'],
    correctIndex: 0,
    difficulty: 0.3,
    tags: ['geometry', 'circles', 'radius', 'diameter'],
    grade: '6',
    topic: 'mathematics',
    explanation: 'The radius is half the diameter. So radius = 14 cm ÷ 2 = 7 cm.'
  },
  {
    stem: 'What is 15% of 80?',
    choices: ['10', '12', '15', '20'],
    correctIndex: 1,
    difficulty: 0.5,
    tags: ['arithmetic', 'percentages', 'multiplication'],
    grade: '6',
    topic: 'mathematics',
    explanation: '15% of 80 = 0.15 × 80 = 12.'
  },

  // Grade 6 Science
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
    stem: 'What is the chemical symbol for water?',
    choices: ['H2O', 'CO2', 'NaCl', 'O2'],
    correctIndex: 0,
    difficulty: 0.3,
    tags: ['chemistry', 'molecules', 'basic'],
    grade: '6',
    topic: 'science',
    explanation: 'Water is composed of two hydrogen atoms and one oxygen atom, so its chemical formula is H2O.'
  },
  {
    stem: 'What type of animal is a frog?',
    choices: ['Mammal', 'Bird', 'Amphibian', 'Reptile'],
    correctIndex: 2,
    difficulty: 0.3,
    tags: ['biology', 'classification', 'animals'],
    grade: '6',
    topic: 'science',
    explanation: 'Frogs are amphibians, which are animals that can live both in water and on land.'
  },
  {
    stem: 'What is the largest planet in our solar system?',
    choices: ['Earth', 'Saturn', 'Jupiter', 'Neptune'],
    correctIndex: 2,
    difficulty: 0.4,
    tags: ['astronomy', 'planets', 'solar-system'],
    grade: '6',
    topic: 'science',
    explanation: 'Jupiter is the largest planet in our solar system, with a mass greater than all other planets combined.'
  },
  {
    stem: 'What is the process by which water changes from liquid to gas?',
    choices: ['Condensation', 'Evaporation', 'Precipitation', 'Transpiration'],
    correctIndex: 1,
    difficulty: 0.3,
    tags: ['chemistry', 'water-cycle', 'states-of-matter'],
    grade: '6',
    topic: 'science',
    explanation: 'Evaporation is the process by which water changes from liquid to gas (water vapor).'
  },
  {
    stem: 'What is the force that pulls objects toward Earth?',
    choices: ['Magnetism', 'Gravity', 'Friction', 'Inertia'],
    correctIndex: 1,
    difficulty: 0.2,
    tags: ['physics', 'forces', 'gravity'],
    grade: '6',
    topic: 'science',
    explanation: 'Gravity is the force that pulls all objects with mass toward each other, including objects toward Earth.'
  },
  {
    stem: 'What is the smallest unit of matter?',
    choices: ['Molecule', 'Atom', 'Cell', 'Element'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['chemistry', 'atoms', 'matter'],
    grade: '6',
    topic: 'science',
    explanation: 'An atom is the smallest unit of matter that retains the properties of an element.'
  },
  {
    stem: 'What type of energy does the Sun provide to Earth?',
    choices: ['Electrical', 'Solar', 'Nuclear', 'Chemical'],
    correctIndex: 1,
    difficulty: 0.3,
    tags: ['astronomy', 'energy', 'sun'],
    grade: '6',
    topic: 'science',
    explanation: 'The Sun provides solar energy (light and heat) to Earth through radiation.'
  },
  {
    stem: 'What is the process by which plants lose water through their leaves?',
    choices: ['Photosynthesis', 'Transpiration', 'Respiration', 'Digestion'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['biology', 'plants', 'water-cycle'],
    grade: '6',
    topic: 'science',
    explanation: 'Transpiration is the process by which plants lose water vapor through their leaves.'
  },
  {
    stem: 'What is the center of an atom called?',
    choices: ['Nucleus', 'Electron', 'Proton', 'Neutron'],
    correctIndex: 0,
    difficulty: 0.5,
    tags: ['chemistry', 'atoms', 'nucleus'],
    grade: '6',
    topic: 'science',
    explanation: 'The nucleus is the center of an atom, containing protons and neutrons.'
  },
  {
    stem: 'What is the study of weather called?',
    choices: ['Geology', 'Meteorology', 'Astronomy', 'Biology'],
    correctIndex: 1,
    difficulty: 0.3,
    tags: ['earth-science', 'weather', 'meteorology'],
    grade: '6',
    topic: 'science',
    explanation: 'Meteorology is the scientific study of weather and atmospheric conditions.'
  },
  {
    stem: 'What is the hardest natural substance on Earth?',
    choices: ['Gold', 'Iron', 'Diamond', 'Quartz'],
    correctIndex: 2,
    difficulty: 0.4,
    tags: ['geology', 'minerals', 'hardness'],
    grade: '6',
    topic: 'science',
    explanation: 'Diamond is the hardest known natural substance on Earth, with a hardness of 10 on the Mohs scale.'
  },
  {
    stem: 'What gas do plants absorb from the atmosphere?',
    choices: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'],
    correctIndex: 2,
    difficulty: 0.3,
    tags: ['biology', 'photosynthesis', 'gases'],
    grade: '6',
    topic: 'science',
    explanation: 'Plants absorb carbon dioxide (CO2) from the atmosphere during photosynthesis.'
  },
  {
    stem: 'What is the speed of light?',
    choices: ['300,000 km/s', '150,000 km/s', '450,000 km/s', '600,000 km/s'],
    correctIndex: 0,
    difficulty: 0.5,
    tags: ['physics', 'light', 'speed'],
    grade: '6',
    topic: 'science',
    explanation: 'The speed of light in a vacuum is approximately 300,000 kilometers per second.'
  },
  {
    stem: 'What is the process by which rocks are broken down into smaller pieces?',
    choices: ['Erosion', 'Weathering', 'Deposition', 'Compaction'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['geology', 'rocks', 'weathering'],
    grade: '6',
    topic: 'science',
    explanation: 'Weathering is the process by which rocks are broken down into smaller pieces by physical or chemical means.'
  },
  {
    stem: 'What is the main component of air?',
    choices: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Water Vapor'],
    correctIndex: 2,
    difficulty: 0.3,
    tags: ['chemistry', 'atmosphere', 'gases'],
    grade: '6',
    topic: 'science',
    explanation: 'Nitrogen makes up about 78% of Earth\'s atmosphere, making it the main component of air.'
  },

  // Grade 6 Reading Comprehension
  {
    stem: 'What is the main idea of the passage?',
    choices: ['Dogs are better pets than cats', 'Animals need proper care', 'Pets are expensive', 'Children should have pets'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['reading', 'main-idea', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'Taking care of a pet requires responsibility and commitment. Animals need regular feeding, exercise, and medical care. Before getting a pet, families should consider if they have the time and resources to provide proper care.',
    explanation: 'The passage focuses on the responsibility and care that pets require, making "Animals need proper care" the main idea.'
  },
  {
    stem: 'Based on the passage, what is the author\'s main purpose?',
    choices: ['To entertain readers', 'To inform about a topic', 'To persuade readers', 'To describe a personal experience'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['reading', 'author-purpose', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'The author\'s main purpose is to inform readers about the brain and its importance.'
  },
  {
    stem: 'What can you infer from the passage?',
    choices: ['The author is a doctor', 'The brain is not fully understood', 'Everyone has the same brain', 'The brain never changes'],
    correctIndex: 1,
    difficulty: 0.5,
    tags: ['reading', 'inference', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'The statement "Scientists are still learning" suggests that the brain is not fully understood yet.'
  },
  {
    stem: 'What is the meaning of the word "complex" in this context?',
    choices: ['Simple', 'Complicated', 'Small', 'Large'],
    correctIndex: 1,
    difficulty: 0.3,
    tags: ['reading', 'vocabulary', 'context-clues'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions.',
    explanation: 'In this context, "complex" means complicated or having many parts, as the brain has many functions.'
  },
  {
    stem: 'What is the main idea of this passage?',
    choices: ['The brain is very important', 'Scientists study the brain', 'The brain controls everything', 'The brain is mysterious'],
    correctIndex: 0,
    difficulty: 0.4,
    tags: ['reading', 'main-idea', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'The main idea is that the brain is very important, as it controls everything and is complex.'
  },
  {
    stem: 'What type of text is this?',
    choices: ['Fiction', 'Poetry', 'Informational', 'Biography'],
    correctIndex: 2,
    difficulty: 0.3,
    tags: ['reading', 'text-type', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'This is informational text because it provides facts and information about the brain.'
  },
  {
    stem: 'What is the author\'s tone in this passage?',
    choices: ['Humorous', 'Serious', 'Angry', 'Sad'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['reading', 'tone', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'The author\'s tone is serious and informative, presenting factual information about the brain.'
  },
  {
    stem: 'What is the best title for this passage?',
    choices: ['The Amazing Brain', 'How Scientists Work', 'Our Body\'s Control Center', 'Learning About Health'],
    correctIndex: 2,
    difficulty: 0.4,
    tags: ['reading', 'title', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'The best title is "Our Body\'s Control Center" because the brain controls all our functions.'
  },
  {
    stem: 'What does the word "organs" mean in this passage?',
    choices: ['Musical instruments', 'Body parts', 'Tools', 'Books'],
    correctIndex: 1,
    difficulty: 0.3,
    tags: ['reading', 'vocabulary', 'context-clues'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions.',
    explanation: 'In this context, "organs" refers to body parts, specifically the brain as a body part.'
  },
  {
    stem: 'What can you conclude about the brain?',
    choices: ['It is easy to understand', 'It is very important', 'It never changes', 'It is not studied'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['reading', 'conclusion', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'You can conclude that the brain is very important because it controls all our functions.'
  },
  {
    stem: 'What is the author trying to explain?',
    choices: ['How to study the brain', 'Why the brain is important', 'What scientists do', 'How the body works'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['reading', 'author-intent', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'The author is trying to explain why the brain is important by describing its functions and complexity.'
  },
  {
    stem: 'What is the relationship between the brain and the body?',
    choices: ['The brain is separate from the body', 'The brain controls the body', 'The body controls the brain', 'They are unrelated'],
    correctIndex: 1,
    difficulty: 0.3,
    tags: ['reading', 'relationships', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'The passage states that the brain "controls all our thoughts, movements, and bodily functions," showing it controls the body.'
  },
  {
    stem: 'What does "bodily functions" refer to?',
    choices: ['Only thinking', 'Only moving', 'Physical processes', 'Only breathing'],
    correctIndex: 2,
    difficulty: 0.4,
    tags: ['reading', 'vocabulary', 'context-clues'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'Bodily functions refer to physical processes like breathing, digestion, and circulation that the brain controls.'
  },
  {
    stem: 'What is the author\'s attitude toward the brain?',
    choices: ['Disinterested', 'Fascinated', 'Confused', 'Angry'],
    correctIndex: 1,
    difficulty: 0.4,
    tags: ['reading', 'attitude', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'The author seems fascinated by the brain, describing it as "most complex" and noting ongoing research.'
  },
  {
    stem: 'What is the main point the author wants to make?',
    choices: ['The brain is simple', 'The brain is mysterious', 'The brain is important', 'The brain is small'],
    correctIndex: 2,
    difficulty: 0.4,
    tags: ['reading', 'main-point', 'comprehension'],
    grade: '6',
    topic: 'reading-comprehension',
    passage: 'The human brain is one of the most complex organs in the body. It controls all our thoughts, movements, and bodily functions. Scientists are still learning about how the brain works and how to keep it healthy.',
    explanation: 'The main point is that the brain is important, as evidenced by its complexity and control over all functions.'
  },

  // Grade 7 Mathematics
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
    stem: 'In the equation y = 2x + 3, what is the slope?',
    choices: ['2', '3', '5', 'x'],
    correctIndex: 0,
    difficulty: 0.6,
    tags: ['algebra', 'linear-equations', 'slope'],
    grade: '7',
    topic: 'mathematics',
    explanation: 'In the slope-intercept form y = mx + b, the slope is the coefficient of x, which is 2.'
  },

  // Grade 7 Science
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
    stem: 'What is the chemical symbol for gold?',
    choices: ['Go', 'Gd', 'Au', 'Ag'],
    correctIndex: 2,
    difficulty: 0.4,
    tags: ['chemistry', 'elements', 'symbols'],
    grade: '7',
    topic: 'science',
    explanation: 'The chemical symbol for gold is Au, derived from the Latin word "aurum".'
  },

  // Grade 8 Mathematics
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

  // Grade 8 Reading Comprehension
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

  // Grade 9 Mathematics
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

  // Grade 9 Science
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

  // Social Studies
  {
    stem: 'What is the capital of France?',
    choices: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctIndex: 2,
    difficulty: 0.2,
    tags: ['geography', 'capitals', 'europe'],
    grade: '6',
    topic: 'social-studies',
    explanation: 'Paris is the capital and largest city of France.'
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
    await AssessmentSession.deleteMany({});
    await Chapter.deleteMany({});
    await Topic.deleteMany({});
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
      const { grade, consentFlag, parentEmail, schoolName, password, ...userFields } = userData;

      // Create user with passwordHash instead of password
      const user = new User({
        ...userFields,
        passwordHash: password
      });
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
            topics: ['mathematics', 'science', 'reading-comprehension']
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

async function seedChaptersAndTopics(adminUser) {
  try {
    const chapterTopicMap = {}; // Map to store chapterId -> topicId mappings
    
    // Subject mapping from question topics to Chapter subjects
    const subjectMap = {
      'mathematics': 'Math',
      'science': 'Science',
      'reading-comprehension': 'Social Science',
      'social-studies': 'Social Science'
    };

    // Create chapters and topics for each grade and subject combination
    const grades = ['6', '7', '8', '9'];
    const subjects = ['Math', 'Science', 'Social Science'];
    const chapterNumberMap = {}; // Track chapter numbers per class/subject
    
    for (const grade of grades) {
      // Note: Chapter model only supports classes 6 and 7, so we'll use 6 for grades 6-7 and 7 for grades 8-9
      const chapterClass = ['6', '7'].includes(grade) ? grade : '7';
      
      for (const subject of subjects) {
        // Get or initialize chapter number for this class/subject combination
        const key = `${chapterClass}-${subject}`;
        if (!chapterNumberMap[key]) {
          chapterNumberMap[key] = 0;
        }
        chapterNumberMap[key]++;
        
        // Create a default chapter for this grade/subject combination
        const chapter = new Chapter({
          class: chapterClass,
          subject: subject,
          chapterNumber: chapterNumberMap[key],
          chapterName: `Grade ${grade} ${subject} - General`,
          description: `General chapter for Grade ${grade} ${subject} questions`,
          ncertReference: `Grade ${grade} ${subject}`,
          createdBy: adminUser._id
        });
        await chapter.save();

        // Create a default topic for this chapter
        const topic = new Topic({
          chapterId: chapter._id,
          topicName: `General ${subject}`,
          description: `General topic for Grade ${grade} ${subject}`,
          difficulty: 0.5,
          concepts: [`Basic ${subject}`, `Advanced ${subject}`],
          learningObjectives: [
            `Understand basic concepts of ${subject}`,
            `Apply ${subject} in problem solving`
          ],
          createdBy: adminUser._id
        });
        await topic.save();

        // Add topic to chapter
        chapter.topics.push(topic._id);
        await chapter.save();

        // Store mapping: grade + topic -> chapterId and topicId
        const mapKey = `${grade}-${subject.toLowerCase()}`;
        chapterTopicMap[mapKey] = {
          chapterId: chapter._id,
          topicId: topic._id
        };
      }
    }

    logger.info('Created default chapters and topics');
    return chapterTopicMap;
  } catch (error) {
    logger.error('Error seeding chapters and topics:', error);
    throw error;
  }
}

async function seedQuestions(chapterTopicMap, adminUser) {
  try {
    const createdQuestions = [];
    const subjectMap = {
      'mathematics': 'math',
      'science': 'science',
      'reading-comprehension': 'social science',
      'social-studies': 'social science'
    };

    for (const questionData of sampleQuestions) {
      // Map question topic to subject
      const questionTopic = questionData.topic || 'mathematics';
      const subject = subjectMap[questionTopic] || 'math';
      const grade = questionData.grade || '6';
      
      // Get chapter and topic IDs
      const key = `${grade}-${subject}`;
      const chapterTopic = chapterTopicMap[key] || chapterTopicMap['6-math']; // Fallback to grade 6 math
      
      if (!chapterTopic) {
        logger.warn(`No chapter/topic found for grade ${grade} and subject ${subject}, skipping question`);
        continue;
      }

      const question = new Question({
        ...questionData,
        chapterId: chapterTopic.chapterId,
        topicId: chapterTopic.topicId,
        questionType: questionData.questionType || 'mcq',
        isGenerated: false,
        generatedBy: 'seed',
        isActive: true,
        createdBy: adminUser._id
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

async function createAccountDetails() {
  const accountDetails = {
    admin: sampleUsers.filter(user => user.role === 'admin'),
    teachers: sampleUsers.filter(user => user.role === 'teacher'),
    students: sampleUsers.filter(user => user.role === 'student')
  };
  return accountDetails;
}

async function seed() {
  try {
    logger.info('Starting enhanced database seeding...');

    await connectDatabase();
    await clearDatabase();

    const users = await seedUsers();
    
    // Get an admin user for creating chapters and topics
    const adminUser = users.find(u => u.role === 'admin') || users[0];
    
    // Seed chapters and topics first
    const chapterTopicMap = await seedChaptersAndTopics(adminUser);
    
    // Seed questions with chapter and topic references
    const questions = await seedQuestions(chapterTopicMap, adminUser);
    const accountDetails = await createAccountDetails();

    logger.info('Enhanced database seeding completed successfully!');
    logger.info(`Created ${users.length} users and ${questions.length} questions`);

    // Display login credentials
    console.log('\n=== Enhanced Login Credentials ===');
    console.log('\n🔐 ADMIN ACCOUNTS:');
    accountDetails.admin.forEach(admin => {
      console.log(`   ${admin.name} - ${admin.email} / ${admin.password}`);
    });
    
    console.log('\n👨‍🏫 TEACHER ACCOUNTS:');
    accountDetails.teachers.forEach(teacher => {
      console.log(`   ${teacher.name} - ${teacher.email} / ${teacher.password}`);
    });
    
    console.log('\n👨‍🎓 STUDENT ACCOUNTS:');
    accountDetails.students.forEach(student => {
      console.log(`   ${student.name} (Grade ${student.grade}) - ${student.email} / ${student.password}`);
    });
    
    console.log('\n📊 SUMMARY:');
    console.log(`   Total Users: ${users.length}`);
    console.log(`   - Admins: ${accountDetails.admin.length}`);
    console.log(`   - Teachers: ${accountDetails.teachers.length}`);
    console.log(`   - Students: ${accountDetails.students.length}`);
    console.log(`   Total Questions: ${questions.length}`);
    console.log('=====================================\n');

    process.exit(0);
  } catch (error) {
    logger.error('Enhanced seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seed();
}

module.exports = { seed, connectDatabase, clearDatabase, seedUsers, seedQuestions, seedChaptersAndTopics, createAccountDetails };
