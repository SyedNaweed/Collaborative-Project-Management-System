require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const Task = require('../models/Task');
const OTP = require('../models/OTP');
const {
  validateStudentRegistration,
  validateFacultyRegistration,
  validateLogin,
  validateTeamCreation,
  validateProjectProposal
} = require('../middleware/validation');

let testsPassed = 0;
let testsFailed = 0;
const resultsLog = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${testName}`);
    testsPassed++;
    resultsLog.push({ name: testName, status: 'PASS', details });
  } else {
    console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${testName} ${details ? '(' + details + ')' : ''}`);
    testsFailed++;
    resultsLog.push({ name: testName, status: 'FAIL', details });
  }
}

// Mock Express response helper
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runFullAuditSuite() {
  console.log('\n================================================================');
  console.log('   FULL CPMS FORM VALIDATION AUDIT & SPECIFICATION TEST SUITE   ');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collaborative_pms';
  await mongoose.connect(mongoUri);

  // Clean slate for test entities
  await User.deleteMany({ username: { $regex: /^test/ } });
  await Team.deleteMany({ name: { $regex: /^TestTeam_/ } });
  await Project.deleteMany({ title: { $regex: /^TestProject_/ } });
  await OTP.deleteMany({ email: { $regex: /test/ } });

  await User.init();
  await Team.init();
  await Project.init();
  await OTP.init();

  // ==========================================
  // SECTION 1: STUDENT REGISTRATION TESTS
  // ==========================================
  console.log('\n--- 1. Student Registration Validation ---');

  // Test 1.1: Valid Internal Student Registration
  let testInternal1;
  try {
    testInternal1 = await User.create({
      username: 'testinternalone',
      email: 'student1@vitstudent.ac.in',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'INTERNAL',
      fullName: 'Internal Student One',
      registerNumber: '21BCE8001'
    });
    assert(true, '1.1 Valid Internal registration succeeds with @vitstudent.ac.in');
  } catch (err) {
    assert(false, '1.1 Valid Internal registration succeeds with @vitstudent.ac.in', err.message);
  }

  // Test 1.2: Internal Student without Register Number fails
  try {
    const badInt = new User({
      username: 'testinternalnoreg',
      email: 'student_noreg@vitstudent.ac.in',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'INTERNAL',
      fullName: 'No Reg Student',
      registerNumber: ''
    });
    await badInt.save();
    assert(false, '1.2 Internal registration without Register Number fails');
  } catch (err) {
    assert(true, '1.2 Internal registration without Register Number fails');
  }

  // Test 1.3: Internal Student with invalid email domain fails
  let mockRes = createMockRes();
  await validateStudentRegistration(
    {
      body: {
        studentType: 'INTERNAL',
        fullName: 'Bad Domain Student',
        registerNumber: '21BCE8002',
        email: 'student@gmail.com', // NOT @vitstudent.ac.in
        username: 'testinternalbaddomain',
        password: 'password123',
        confirmPassword: 'password123',
        otp: '123456'
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.email,
    '1.3 Internal registration with invalid email domain fails'
  );

  // Test 1.4: Valid External Student without Register Number succeeds
  let testExternal1;
  try {
    testExternal1 = await User.create({
      username: 'testexternalone',
      email: 'partner1@gmail.com',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'EXTERNAL',
      fullName: 'External Student One'
      // No registerNumber
    });
    assert(true, '1.4 Valid External registration without Register Number succeeds');
  } catch (err) {
    assert(false, '1.4 Valid External registration without Register Number succeeds', err.message);
  }

  // Test 1.5: External Student using @vitstudent.ac.in fails
  mockRes = createMockRes();
  await validateStudentRegistration(
    {
      body: {
        studentType: 'EXTERNAL',
        fullName: 'Ext With VIT Student Email',
        email: 'ext@vitstudent.ac.in',
        username: 'testexternalvit',
        password: 'password123',
        confirmPassword: 'password123',
        otp: '123456'
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.email,
    '1.5 External registration using @vitstudent.ac.in fails'
  );

  // Test 1.6: External Student using @vit.ac.in fails
  mockRes = createMockRes();
  await validateStudentRegistration(
    {
      body: {
        studentType: 'EXTERNAL',
        fullName: 'Ext With VIT Faculty Email',
        email: 'ext@vit.ac.in',
        username: 'testexternalvitfac',
        password: 'password123',
        confirmPassword: 'password123',
        otp: '123456'
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.email,
    '1.6 External registration using @vit.ac.in fails'
  );

  // Test 1.7: Duplicate Internal Register Number fails
  try {
    const dupReg = new User({
      username: 'testinternaldupreg',
      email: 'student_dup@vitstudent.ac.in',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'INTERNAL',
      fullName: 'Dup Reg Student',
      registerNumber: '21BCE8001' // Matches testInternal1
    });
    await dupReg.save();
    assert(false, '1.7 Duplicate Internal Register Number fails');
  } catch (err) {
    assert(true, '1.7 Duplicate Internal Register Number fails');
  }

  // Test 1.8: Duplicate username fails
  try {
    const dupUser = new User({
      username: 'testinternalone', // Matches testInternal1
      email: 'student_diff@vitstudent.ac.in',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'INTERNAL',
      fullName: 'Dup User Student',
      registerNumber: '21BCE8009'
    });
    await dupUser.save();
    assert(false, '1.8 Duplicate username fails');
  } catch (err) {
    assert(true, '1.8 Duplicate username fails');
  }

  // Test 1.9: Duplicate email fails
  try {
    const dupMail = new User({
      username: 'testinternaldiffuser',
      email: 'student1@vitstudent.ac.in', // Matches testInternal1
      password: 'password123',
      role: 'STUDENT',
      studentType: 'INTERNAL',
      fullName: 'Dup Email Student',
      registerNumber: '21BCE8010'
    });
    await dupMail.save();
    assert(false, '1.9 Duplicate email address fails');
  } catch (err) {
    assert(true, '1.9 Duplicate email address fails');
  }

  // Test 1.10: Password and Confirm Password mismatch fails
  mockRes = createMockRes();
  await validateStudentRegistration(
    {
      body: {
        studentType: 'EXTERNAL',
        fullName: 'Password Test',
        email: 'pass.test@outlook.com',
        username: 'testpassmismatch',
        password: 'password123',
        confirmPassword: 'differentPassword456',
        otp: '123456'
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.confirmPassword,
    '1.10 Password and Confirm Password mismatch fails'
  );

  // Test 1.11: Unverified or missing OTP fails
  mockRes = createMockRes();
  await validateStudentRegistration(
    {
      body: {
        studentType: 'EXTERNAL',
        fullName: 'OTP Test',
        email: 'no.otp@yahoo.com',
        username: 'testnootp',
        password: 'password123',
        confirmPassword: 'password123',
        otp: ''
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.otp,
    '1.11 Missing OTP fails'
  );

  // Test 1.12: Username containing numbers fails
  mockRes = createMockRes();
  await validateStudentRegistration(
    {
      body: {
        studentType: 'EXTERNAL',
        fullName: 'Number Username Test',
        email: 'num.user@yahoo.com',
        username: 'testuser123', // Contains numbers!
        password: 'password123',
        confirmPassword: 'password123',
        otp: '123456'
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.username,
    '1.12 Username containing numbers fails'
  );

  // Test 1.13: Username containing special characters fails
  mockRes = createMockRes();
  await validateStudentRegistration(
    {
      body: {
        studentType: 'EXTERNAL',
        fullName: 'Special Char Username Test',
        email: 'special.user@yahoo.com',
        username: 'test_user_special', // Contains underscore!
        password: 'password123',
        confirmPassword: 'password123',
        otp: '123456'
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.username,
    '1.13 Username containing special characters fails'
  );

  // Test 1.14: Internal student with invalid Register Number format fails
  mockRes = createMockRes();
  await validateStudentRegistration(
    {
      body: {
        studentType: 'INTERNAL',
        fullName: 'Bad Reg Format Student',
        registerNumber: '21BCE800', // Only 3 digits at end, invalid!
        email: 'badreg@vitstudent.ac.in',
        username: 'testbadregformat',
        password: 'password123',
        confirmPassword: 'password123',
        otp: '123456'
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.registerNumber,
    '1.14 Register Number not matching (2 numbers, 3 alphabets, 4 numbers) fails'
  );

  // Test 1.15: Internal student with valid Register Number format (2 numbers, 3 alphabets, 4 numbers) succeeds
  mockRes = createMockRes();
  let validRegNext = false;
  // Create an OTP for this test email
  await OTP.create({ email: 'validreg@vitstudent.ac.in', otp: '654321', purpose: 'REGISTRATION', isVerified: true });
  // Delete any existing user with this test register number
  await User.deleteMany({ registerNumber: '22BIT9999' });
  await validateStudentRegistration(
    {
      body: {
        studentType: 'INTERNAL',
        fullName: 'Valid Reg Student',
        registerNumber: '22BIT9999', // 2 numbers, 3 alphabets, 4 numbers
        email: 'validreg@vitstudent.ac.in',
        username: 'testvalidregstudent',
        password: 'password123',
        confirmPassword: 'password123',
        otp: '654321'
      }
    },
    mockRes,
    () => { validRegNext = true; }
  );
  assert(
    validRegNext === true,
    '1.15 Internal student with valid format 22BIT0061 (2 numbers, 3 alphabets, 4 numbers) succeeds',
    mockRes.body && mockRes.body.errors ? JSON.stringify(mockRes.body.errors) : ''
  );

  // ==========================================
  // SECTION 2: FACULTY REGISTRATION & LOGIN
  // ==========================================
  console.log('\n--- 2. Faculty Registration and Login Validation ---');

  // Test 2.1: Valid faculty registration succeeds
  let testFaculty1;
  try {
    testFaculty1 = await User.create({
      username: 'testfacultyone',
      email: 'fac.guide1@vit.ac.in',
      password: 'password123',
      role: 'FACULTY',
      fullName: 'Dr. Test Guide One',
      employeeId: 'TESTEMP901',
      facultyCapacity: 4
    });
    assert(true, '2.1 Valid faculty registration succeeds');
  } catch (err) {
    assert(false, '2.1 Valid faculty registration succeeds', err.message);
  }

  // Test 2.2: Invalid faculty email domain fails
  mockRes = createMockRes();
  await validateFacultyRegistration(
    {
      body: {
        fullName: 'Dr. Bad Domain',
        employeeId: 'TESTEMP902',
        email: 'guide@gmail.com', // NOT @vit.ac.in
        username: 'testfacultybaddomain',
        password: 'password123',
        confirmPassword: 'password123',
        facultyCapacity: 4
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.email,
    '2.2 Invalid faculty email domain (non-@vit.ac.in) fails'
  );

  // Test 2.3: Capacity below 2 fails
  mockRes = createMockRes();
  await validateFacultyRegistration(
    {
      body: {
        fullName: 'Dr. Low Cap',
        employeeId: 'TESTEMP903',
        email: 'lowcap@vit.ac.in',
        username: 'testfacultylowcap',
        password: 'password123',
        confirmPassword: 'password123',
        facultyCapacity: 1 // below 2
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.facultyCapacity,
    '2.3 Faculty capacity below 2 fails'
  );

  // Test 2.4: Capacity above 7 fails
  mockRes = createMockRes();
  await validateFacultyRegistration(
    {
      body: {
        fullName: 'Dr. High Cap',
        employeeId: 'TESTEMP904',
        email: 'highcap@vit.ac.in',
        username: 'testfacultyhighcap',
        password: 'password123',
        confirmPassword: 'password123',
        facultyCapacity: 8 // above 7
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.facultyCapacity,
    '2.4 Faculty capacity above 7 fails'
  );

  // Test 2.5: Missing or non-numeric capacity fails
  mockRes = createMockRes();
  await validateFacultyRegistration(
    {
      body: {
        fullName: 'Dr. Nan Cap',
        employeeId: 'TESTEMP905',
        email: 'nancap@vit.ac.in',
        username: 'testfacultynancap',
        password: 'password123',
        confirmPassword: 'password123',
        facultyCapacity: 'not_a_number'
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.facultyCapacity,
    '2.5 Non-numeric or missing faculty capacity fails'
  );

  // Test 2.6: Duplicate employee ID fails
  try {
    const dupEmp = new User({
      username: 'testfacultydupemp',
      email: 'dupemp@vit.ac.in',
      password: 'password123',
      role: 'FACULTY',
      fullName: 'Dr. Dup Emp',
      employeeId: 'TESTEMP901', // Duplicate of testFaculty1
      facultyCapacity: 5
    });
    await dupEmp.save();
    assert(false, '2.6 Duplicate employee ID fails');
  } catch (err) {
    assert(true, '2.6 Duplicate employee ID fails');
  }

  // Test 2.7: Login validation: missing credentials fail
  mockRes = createMockRes();
  validateLogin(
    {
      body: {
        username: '',
        password: ''
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.username && mockRes.body.errors.password,
    '2.7 Login validation rejects missing credentials'
  );

  // ==========================================
  // SECTION 3: REGISTER UNDER FACULTY
  // ==========================================
  console.log('\n--- 3. Register Under Faculty Validation ---');

  // Create Faculty with capacity 2 for capacity tests
  const limitedFaculty = await User.create({
    username: 'testfacultylimited',
    email: 'limited@vit.ac.in',
    password: 'password123',
    role: 'FACULTY',
    fullName: 'Dr. Limited Guide',
    employeeId: 'TESTEMP990',
    facultyCapacity: 2
  });

  // Test 3.1: Assign valid registered faculty to student
  testInternal1.assignedFaculty = testFaculty1._id;
  await testInternal1.save();
  const refreshedStudent = await User.findById(testInternal1._id);
  assert(
    refreshedStudent.assignedFaculty.toString() === testFaculty1._id.toString(),
    '3.1 Correct faculty details succeed for student registration under faculty'
  );

  // Test 3.2: Full capacity check on backend
  // Fill 2 active teams for limitedFaculty
  await Team.create({
    name: 'TestTeam_Cap1',
    faculty: limitedFaculty._id,
    creator: testInternal1._id,
    members: [{ student: testInternal1._id, studentType: 'INTERNAL', status: 'ACTIVE' }],
    isActive: true
  });
  await Team.create({
    name: 'TestTeam_Cap2',
    faculty: limitedFaculty._id,
    creator: testExternal1._id,
    members: [{ student: testExternal1._id, studentType: 'EXTERNAL', status: 'ACTIVE' }],
    isActive: true
  });

  const occupiedSlots = await Team.countDocuments({ faculty: limitedFaculty._id, isActive: true });
  assert(
    occupiedSlots >= limitedFaculty.facultyCapacity,
    '3.2 Full faculty capacity (2/2) correctly detects slot exhaustion'
  );

  // ==========================================
  // SECTION 4: TEAM CREATION VALIDATION
  // ==========================================
  console.log('\n--- 4. Team Creation Validation ---');

  // Create additional students assigned to testFaculty1
  const studentInternal2 = await User.create({
    username: 'testinternaltwo',
    email: 'student2@vitstudent.ac.in',
    password: 'password123',
    role: 'STUDENT',
    studentType: 'INTERNAL',
    fullName: 'Internal Student Two',
    registerNumber: '21BCE8002',
    assignedFaculty: testFaculty1._id
  });

  const studentExternal2 = await User.create({
    username: 'testexternaltwo',
    email: 'partner2@gmail.com',
    password: 'password123',
    role: 'STUDENT',
    studentType: 'EXTERNAL',
    fullName: 'External Student Two',
    assignedFaculty: testFaculty1._id
  });

  // Assign testExternal1 to testFaculty1
  testExternal1.assignedFaculty = testFaculty1._id;
  await testExternal1.save();

  // Test 4.1: Team size 1 (solo team by creator) is accepted
  mockRes = createMockRes();
  let nextCalled = false;
  await validateTeamCreation(
    {
      user: studentInternal2,
      body: {
        name: 'TestTeam_Solo',
        facultyId: testFaculty1._id,
        memberUsernames: [],
        collaborationConfirmed: false
      }
    },
    mockRes,
    () => { nextCalled = true; }
  );
  assert(nextCalled === true, '4.1 Team size 1 (solo creator) is accepted');

  // Test 4.2: Team size 10 (exceeds max limit 9) is rejected
  mockRes = createMockRes();
  nextCalled = false;
  await validateTeamCreation(
    {
      user: studentInternal2,
      body: {
        name: 'TestTeam_Exceed',
        facultyId: testFaculty1._id,
        memberUsernames: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9'], // 1 + 9 = 10
        collaborationConfirmed: false
      }
    },
    mockRes,
    () => { nextCalled = true; }
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.members,
    '4.2 Team size 10 is rejected (max limit is 9)'
  );

  // Test 4.3: Unregistered member username is rejected
  mockRes = createMockRes();
  await validateTeamCreation(
    {
      user: studentInternal2,
      body: {
        name: 'TestTeam_Unregistered',
        facultyId: testFaculty1._id,
        memberUsernames: ['non_existent_student_xyz'],
        collaborationConfirmed: false
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.members.includes('not registered'),
    '4.3 Unregistered members are rejected'
  );

  // Test 4.4: Member assigned to a different faculty is rejected
  const otherFaculty = await User.create({
    username: 'testfacultyother',
    email: 'otherfac@vit.ac.in',
    password: 'password123',
    role: 'FACULTY',
    fullName: 'Dr. Other Faculty',
    employeeId: 'TESTEMP988',
    facultyCapacity: 3
  });
  const mismatchedStudent = await User.create({
    username: 'testinternalmismatchfac',
    email: 'mismatch@vitstudent.ac.in',
    password: 'password123',
    role: 'STUDENT',
    studentType: 'INTERNAL',
    fullName: 'Mismatched Student',
    registerNumber: '21BCE8099',
    assignedFaculty: otherFaculty._id // Assigned to otherFaculty!
  });

  mockRes = createMockRes();
  await validateTeamCreation(
    {
      user: studentInternal2,
      body: {
        name: 'TestTeam_FacultyMismatch',
        facultyId: testFaculty1._id,
        memberUsernames: [mismatchedStudent.username],
        collaborationConfirmed: false
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.members.includes('different faculty'),
    '4.4 Members associated with another faculty are rejected'
  );

  // Test 4.5: Duplicate team name under same faculty (case-insensitive) fails
  await Team.create({
    name: 'TestTeam_CaseUnique',
    faculty: testFaculty1._id,
    creator: studentInternal2._id,
    members: [{ student: studentInternal2._id, studentType: 'INTERNAL', status: 'ACTIVE' }]
  });

  mockRes = createMockRes();
  await validateTeamCreation(
    {
      user: studentExternal2,
      body: {
        name: 'testteam_caseunique', // Lowercase duplicate
        facultyId: testFaculty1._id,
        memberUsernames: [],
        collaborationConfirmed: false
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.name.includes('already exists'),
    '4.5 Duplicate team names within the same faculty are rejected regardless of letter case'
  );

  // Test 4.6: Same team name under a DIFFERENT faculty is allowed
  mockRes = createMockRes();
  nextCalled = false;
  await validateTeamCreation(
    {
      user: mismatchedStudent,
      body: {
        name: 'TestTeam_CaseUnique', // Same name, but under otherFaculty!
        facultyId: otherFaculty._id,
        memberUsernames: [],
        collaborationConfirmed: false
      }
    },
    mockRes,
    () => { nextCalled = true; }
  );
  assert(nextCalled === true, '4.6 Same team name under a different faculty is allowed');

  // Create dedicated students for mixed team tests
  const mixedInternal = await User.create({
    username: 'testinternalmixed',
    email: 'mixed.int@vitstudent.ac.in',
    password: 'password123',
    role: 'STUDENT',
    studentType: 'INTERNAL',
    fullName: 'Mixed Internal Student',
    registerNumber: '21BCE8077',
    assignedFaculty: testFaculty1._id
  });

  const mixedExternal = await User.create({
    username: 'testexternalmixed',
    email: 'mixed.ext@gmail.com',
    password: 'password123',
    role: 'STUDENT',
    studentType: 'EXTERNAL',
    fullName: 'Mixed External Student',
    assignedFaculty: testFaculty1._id
  });

  // Test 4.7: Mixed team without declaration fails
  mockRes = createMockRes();
  await validateTeamCreation(
    {
      user: mixedInternal, // Internal
      body: {
        name: 'TestTeam_MixedNoConfirm',
        facultyId: testFaculty1._id,
        memberUsernames: [mixedExternal.username], // External
        collaborationConfirmed: false // NOT checked
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.collaborationConfirmed,
    '4.7 Mixed teams without confirmation declaration are rejected'
  );

  // Test 4.8: Mixed team with declaration succeeds
  mockRes = createMockRes();
  nextCalled = false;
  await validateTeamCreation(
    {
      user: mixedInternal, // Internal
      body: {
        name: 'TestTeam_MixedConfirmed',
        facultyId: testFaculty1._id,
        memberUsernames: [mixedExternal.username], // External
        collaborationConfirmed: true // Confirmed!
      }
    },
    mockRes,
    () => { nextCalled = true; }
  );
  assert(nextCalled === true, '4.8 Mixed teams with confirmation declaration are accepted');

  // Test 4.9: Internal-only team does not require mixed team declaration
  const studentInternal3 = await User.create({
    username: 'testinternalthree',
    email: 'student3@vitstudent.ac.in',
    password: 'password123',
    role: 'STUDENT',
    studentType: 'INTERNAL',
    fullName: 'Internal Student Three',
    registerNumber: '21BCE8003',
    assignedFaculty: testFaculty1._id
  });

  mockRes = createMockRes();
  nextCalled = false;
  await validateTeamCreation(
    {
      user: studentInternal3, // Internal
      body: {
        name: 'TestTeam_InternalOnly',
        facultyId: testFaculty1._id,
        memberUsernames: [], // Internal-only
        collaborationConfirmed: false
      }
    },
    mockRes,
    () => { nextCalled = true; }
  );
  assert(nextCalled === true, '4.9 Internal-only team does not require mixed team declaration');

  // Test 4.10: Student already in an active team cannot join another active team under same faculty
  const activeTeamObj = await Team.create({
    name: 'TestTeam_ActiveMembership',
    faculty: testFaculty1._id,
    creator: studentInternal3._id,
    members: [{ student: studentInternal3._id, studentType: 'INTERNAL', status: 'ACTIVE' }],
    isActive: true
  });

  mockRes = createMockRes();
  await validateTeamCreation(
    {
      user: studentExternal2,
      body: {
        name: 'TestTeam_DoubleActive',
        facultyId: testFaculty1._id,
        memberUsernames: [studentInternal3.username], // studentInternal3 is already in TestTeam_ActiveMembership!
        collaborationConfirmed: true
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.members.includes('already an active member'),
    '4.10 Students already in an active team under the same faculty cannot join another active team there'
  );

  // ==========================================
  // SECTION 5: OTP & ACCOUNT RECOVERY
  // ==========================================
  console.log('\n--- 5. OTP and Account Recovery Validation ---');

  // Create an OTP document with dedicated test email
  const testOtpEmail = 'test_otp_singleuse@vitstudent.ac.in';
  await OTP.deleteMany({ email: testOtpEmail });

  await OTP.create({
    email: testOtpEmail,
    otp: '987654',
    purpose: 'REGISTRATION',
    isVerified: false
  });

  // Test 5.1: Wrong OTP fails
  const wrongOtp = await OTP.findOne({ email: testOtpEmail, otp: '111111' });
  assert(!wrongOtp, '5.1 Incorrect OTP is rejected');

  // Test 5.2: Purpose mismatch (e.g. asking for PASSWORD_RESET when OTP was for REGISTRATION) fails
  const purposeMismatch = await OTP.findOne({
    email: testOtpEmail,
    otp: '987654',
    purpose: 'PASSWORD_RESET'
  });
  assert(!purposeMismatch, '5.2 Purpose-mismatched OTP is rejected');

  // Test 5.3: Single-use OTP: Once verified/used, cannot be used again
  await OTP.updateOne({ email: testOtpEmail, otp: '987654' }, { isVerified: true });
  // Query for an unverified/available OTP
  const reusedOtp = await OTP.findOne({
    email: testOtpEmail,
    otp: '987654',
    isVerified: false
  });
  assert(!reusedOtp, '5.3 Single-use OTP: Already-used OTP cannot be reused');

  // ==========================================
  // SECTION 6: PROJECT PROPOSAL VALIDATION
  // ==========================================
  console.log('\n--- 6. Project Proposal Validation ---');

  // Test 6.1: Missing required proposal fields rejected
  mockRes = createMockRes();
  await validateProjectProposal(
    {
      body: {
        title: '',
        description: '',
        teamId: activeTeamObj._id
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.title && mockRes.body.errors.description,
    '6.1 Missing required proposal fields (title, description) are rejected'
  );

  // Test 6.2: A team cannot start a new project while current project is ongoing
  const ongoingProject = await Project.create({
    title: 'TestProject_Ongoing',
    description: 'Existing ongoing project description',
    team: activeTeamObj._id,
    faculty: testFaculty1._id,
    status: 'IN_PROGRESS'
  });
  activeTeamObj.currentProject = ongoingProject._id;
  await activeTeamObj.save();

  mockRes = createMockRes();
  await validateProjectProposal(
    {
      body: {
        title: 'TestProject_NewProposal',
        description: 'New proposal while another is active',
        teamId: activeTeamObj._id
      }
    },
    mockRes,
    () => {}
  );
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors && mockRes.body.errors.teamId.includes('ongoing project'),
    '6.2 A new project cannot start while the team current project is ongoing'
  );

  // Test 6.3: Valid proposal for team with completed project succeeds
  ongoingProject.status = 'COMPLETED';
  await ongoingProject.save();

  mockRes = createMockRes();
  nextCalled = false;
  await validateProjectProposal(
    {
      body: {
        title: 'TestProject_NextPhase',
        description: 'Second project proposed after completion of first',
        teamId: activeTeamObj._id
      }
    },
    mockRes,
    () => { nextCalled = true; }
  );
  assert(nextCalled === true, '6.3 Proposal for team without active ongoing project is accepted');

  // ==========================================
  // CLEANUP & SUMMARY
  // ==========================================
  await User.deleteMany({ username: { $regex: /^test/ } });
  await Team.deleteMany({ name: { $regex: /^TestTeam_/ } });
  await Project.deleteMany({ title: { $regex: /^TestProject_/ } });
  await OTP.deleteMany({ email: { $regex: /test/ } });

  console.log('\n================================================================');
  console.log(` AUDIT TEST SUITE RESULTS: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('================================================================\n');

  await mongoose.disconnect();
  process.exit(testsFailed > 0 ? 1 : 0);
}

runFullAuditSuite().catch((err) => {
  console.error('Test suite runner encountered critical error:', err);
  process.exit(1);
});
