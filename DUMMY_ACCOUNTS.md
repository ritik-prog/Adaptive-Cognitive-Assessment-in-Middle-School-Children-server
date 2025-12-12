# Dummy Accounts and Test Data

This document contains all the dummy accounts and test data created for the Cognitive Assessment System.

## 🔐 Admin Accounts

| Name | Email | Password | Role | Description |
|------|-------|----------|------|-------------|
| Dr. Sarah Johnson | admin@cognitiveschool.edu | admin123 | admin | System Administrator |
| Principal Michael Chen | principal@cognitiveschool.edu | admin123 | admin | School Principal |

## 👨‍🏫 Teacher Accounts

| Name | Email | Password | Role | Description |
|------|-------|----------|------|-------------|
| Ms. Emily Rodriguez | emily.rodriguez@cognitiveschool.edu | teacher123 | teacher | Mathematics Teacher |
| Mr. David Thompson | david.thompson@cognitiveschool.edu | teacher123 | teacher | Science Teacher |
| Dr. Lisa Wang | lisa.wang@cognitiveschool.edu | teacher123 | teacher | Reading Comprehension Teacher |
| Mr. James Wilson | james.wilson@cognitiveschool.edu | teacher123 | teacher | Social Studies Teacher |
| Ms. Maria Garcia | maria.garcia@cognitiveschool.edu | teacher123 | teacher | General Studies Teacher |

## 👨‍🎓 Student Accounts

### Grade 6 Students
| Name | Email | Password | Grade | Parent Email | School |
|------|-------|----------|-------|--------------|--------|
| Emma Davis | emma.davis@cognitiveschool.edu | student123 | 6 | parent.davis@email.com | Cognitive Assessment Middle School |
| Alex Johnson | alex.johnson@cognitiveschool.edu | student123 | 6 | parent.johnson@email.com | Cognitive Assessment Middle School |
| Sophia Martinez | sophia.martinez@cognitiveschool.edu | student123 | 6 | parent.martinez@email.com | Cognitive Assessment Middle School |
| Noah Brown | noah.brown@cognitiveschool.edu | student123 | 6 | parent.brown@email.com | Cognitive Assessment Middle School |

### Grade 7 Students
| Name | Email | Password | Grade | Parent Email | School |
|------|-------|----------|-------|--------------|--------|
| Liam Wilson | liam.wilson@cognitiveschool.edu | student123 | 7 | parent.wilson@email.com | Cognitive Assessment Middle School |
| Olivia Garcia | olivia.garcia@cognitiveschool.edu | student123 | 7 | parent.garcia@email.com | Cognitive Assessment Middle School |
| William Anderson | william.anderson@cognitiveschool.edu | student123 | 7 | parent.anderson@email.com | Cognitive Assessment Middle School |
| Ava Taylor | ava.taylor@cognitiveschool.edu | student123 | 7 | parent.taylor@email.com | Cognitive Assessment Middle School |

### Grade 8 Students
| Name | Email | Password | Grade | Parent Email | School |
|------|-------|----------|-------|--------------|--------|
| James Thomas | james.thomas@cognitiveschool.edu | student123 | 8 | parent.thomas@email.com | Cognitive Assessment Middle School |
| Isabella Jackson | isabella.jackson@cognitiveschool.edu | student123 | 8 | parent.jackson@email.com | Cognitive Assessment Middle School |
| Benjamin White | benjamin.white@cognitiveschool.edu | student123 | 8 | parent.white@email.com | Cognitive Assessment Middle School |
| Mia Harris | mia.harris@cognitiveschool.edu | student123 | 8 | parent.harris@email.com | Cognitive Assessment Middle School |

### Grade 9 Students
| Name | Email | Password | Grade | Parent Email | School |
|------|-------|----------|-------|--------------|--------|
| Lucas Martin | lucas.martin@cognitiveschool.edu | student123 | 9 | parent.martin@email.com | Cognitive Assessment Middle School |
| Charlotte Thompson | charlotte.thompson@cognitiveschool.edu | student123 | 9 | parent.thompson@email.com | Cognitive Assessment Middle School |
| Henry Garcia | henry.garcia@cognitiveschool.edu | student123 | 9 | parent.garcia2@email.com | Cognitive Assessment Middle School |
| Amelia Martinez | amelia.martinez@cognitiveschool.edu | student123 | 9 | parent.martinez2@email.com | Cognitive Assessment Middle School |

## 📊 Test Data Summary

### User Statistics
- **Total Users**: 23
- **Admin Accounts**: 2
- **Teacher Accounts**: 5
- **Student Accounts**: 16
  - Grade 6: 4 students
  - Grade 7: 4 students
  - Grade 8: 4 students
  - Grade 9: 4 students

### Question Bank
- **Total Questions**: 67
- **Topics Covered**:
  - Mathematics (Arithmetic, Algebra, Geometry, Trigonometry)
  - Science (Biology, Chemistry, Physics, Astronomy)
  - Reading Comprehension
  - Social Studies (Geography, History)

### Grade Distribution
- **Grade 6**: Basic arithmetic, simple science concepts, basic reading comprehension
- **Grade 7**: Pre-algebra, intermediate science, inference skills
- **Grade 8**: Algebra, geometry, advanced science, critical thinking
- **Grade 9**: Advanced mathematics, complex science, analytical reading

## 🚀 Quick Start Guide

### 1. Run the Enhanced Seed Script
```bash
cd server
npm run seed:enhanced
```

### 2. Test Different User Roles

#### Admin Login
- **Email**: admin@cognitiveschool.edu
- **Password**: admin123
- **Access**: Full system access, user management, analytics

#### Teacher Login
- **Email**: emily.rodriguez@cognitiveschool.edu
- **Password**: teacher123
- **Access**: Question bank, student progress, assessment creation

#### Student Login
- **Email**: emma.davis@cognitiveschool.edu
- **Password**: student123
- **Access**: Take assessments, view progress, practice mode

### 3. Test Scenarios

#### Admin Scenarios
1. **User Management**: View all users, manage roles
2. **System Analytics**: View overall system statistics
3. **Question Management**: Review and approve generated questions

#### Teacher Scenarios
1. **Question Generation**: Create new questions using AI
2. **Student Monitoring**: Track individual student progress
3. **Class Analytics**: View class performance metrics
4. **Question Bank**: Manage and organize questions

#### Student Scenarios
1. **Assessment Taking**: Complete adaptive assessments
2. **Progress Tracking**: View personal progress and scores
3. **Practice Mode**: Practice with sample questions
4. **Profile Management**: Update personal information

## 🔧 Development Notes

### Password Policy
- All test accounts use simple passwords for easy testing
- In production, implement proper password policies
- Consider using environment variables for sensitive data

### Data Privacy
- All student data is fictional and for testing purposes only
- Parent emails are placeholder addresses
- School names are generic for testing

### Testing Recommendations
1. **Start with Admin**: Test full system functionality
2. **Teacher Workflow**: Test question generation and student monitoring
3. **Student Journey**: Test assessment flow and progress tracking
4. **Cross-Role Testing**: Test interactions between different user types

## 📝 Additional Notes

- All accounts have `consentFlag: true` for students
- Student profiles include learning preferences
- Questions are distributed across all grades and topics
- Assessment sessions can be created for testing adaptive algorithms
- All data is reset when running the seed script

## 🐛 Troubleshooting

### Common Issues
1. **Database Connection**: Ensure MongoDB is running
2. **Environment Variables**: Check `.env` file configuration
3. **Dependencies**: Run `npm install` if modules are missing
4. **Port Conflicts**: Ensure ports 3000 and 3001 are available

### Reset Database
```bash
# Clear all data and reseed
npm run seed:enhanced
```

### View Logs
```bash
# Check application logs
tail -f logs/app.log
```

---

**Last Updated**: November 11, 2025  
**Version**: 1.0.0  
**Environment**: Development/Testing
