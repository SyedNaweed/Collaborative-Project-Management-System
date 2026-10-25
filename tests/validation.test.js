require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const Task = require('../models/Task');
const OTP = require('../models/OTP');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${testName}`);
    testsPassed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${testName}`);
    testsFailed++;
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log(' Starting CPMS Validation & Business Rules Audit Test ');
  console.log('======================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collaborative_pms';
  await mongoose.connect(mongoUri);

  // Clear test users
  await User.deleteMany({ username: { $regex: /^test_/ } });
  await Team.deleteMany({ name: { $regex: /^TestTeam_/ } });

  // Ensure indexes are built in MongoDB
  await User.init();
  await Team.init();

  // 1. Internal Student: Valid registration
  try {
    const internalUser = new User({
      username: 'test_internal_valid',
      email: 'test.internal@vitstudent.ac.in',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'INTERNAL',
      fullName: 'Test Internal',
      registerNumber: 'TESTREG01'
    });
    await internalUser.save();
    assert(true, '1. Valid Internal student registration succeeds');
  } catch (err) {
    assert(false, `1. Valid Internal student registration succeeds: ${err.message}`);
  }

  // 2. Internal Student: Missing Register Number must fail
  try {
    const missingReg = new User({
      username: 'test_internal_noreg',
      email: 'test.noreg@vitstudent.ac.in',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'INTERNAL',
      fullName: 'Test No Reg',
      registerNumber: ''
    });
    await missingReg.save();
    assert(false, '2. Internal registration without Register Number fails');
  } catch (err) {
    assert(true, '2. Internal registration without Register Number fails');
  }

  // 3. External Student: Missing Register Number succeeds
  try {
    const externalUser = new User({
      username: 'test_external_valid',
      email: 'test.external@gmail.com',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'EXTERNAL',
      fullName: 'Test External'
    });
    await externalUser.save();
    assert(true, '3. Valid External registration without Register Number succeeds');
  } catch (err) {
    assert(false, `3. Valid External registration without Register Number succeeds: ${err.message}`);
  }

  // 4. Duplicate Register Number fails
  try {
    const dupReg = new User({
      username: 'test_internal_dupreg',
      email: 'test.dupreg@vitstudent.ac.in',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'INTERNAL',
      fullName: 'Test Dup Reg',
      registerNumber: 'TESTREG01' // Duplicate of test 1
    });
    await dupReg.save();
    assert(false, '4. Duplicate Internal Register Number fails');
  } catch (err) {
    assert(true, '4. Duplicate Internal Register Number fails');
  }

  // 5. Faculty: Capacity below 2 fails
  try {
    const facBelow = new User({
      username: 'test_fac_below',
      email: 'fac.below@vit.ac.in',
      password: 'password123',
      role: 'FACULTY',
      fullName: 'Test Fac Below',
      employeeId: 'TESTEMP01',
      facultyCapacity: 1 // below 2
    });
    await facBelow.save();
    assert(false, '5. Faculty capacity below 2 fails');
  } catch (err) {
    assert(true, '5. Faculty capacity below 2 fails');
  }

  // 6. Faculty: Capacity above 7 fails
  try {
    const facAbove = new User({
      username: 'test_fac_above',
      email: 'fac.above@vit.ac.in',
      password: 'password123',
      role: 'FACULTY',
      fullName: 'Test Fac Above',
      employeeId: 'TESTEMP02',
      facultyCapacity: 8 // above 7
    });
    await facAbove.save();
    assert(false, '6. Faculty capacity above 7 fails');
  } catch (err) {
    assert(true, '6. Faculty capacity above 7 fails');
  }

  // 7. Faculty: Valid capacity (4) succeeds
  let testFaculty;
  try {
    testFaculty = await User.create({
      username: 'test_fac_valid',
      email: 'fac.valid@vit.ac.in',
      password: 'password123',
      role: 'FACULTY',
      fullName: 'Dr. Test Guide',
      employeeId: 'TESTEMP03',
      facultyCapacity: 4
    });
    assert(true, '7. Valid faculty registration with capacity between 2 and 7 succeeds');
  } catch (err) {
    assert(false, `7. Valid faculty registration: ${err.message}`);
  }

  // 8. Team size bounds: Empty team (< 1) fails
  try {
    const emptyTeam = new Team({
      name: 'TestTeam_Empty',
      faculty: testFaculty._id,
      creator: testFaculty._id,
      members: [] // 0 members
    });
    await emptyTeam.save();
    assert(false, '8. Team size 0 is rejected');
  } catch (err) {
    assert(true, '8. Team size 0 is rejected');
  }

  // 9. Case-insensitive duplicate team name under same faculty fails
  try {
    const user1 = await User.findOne({ username: 'test_internal_valid' });
    await Team.create({
      name: 'TestTeam_Alpha',
      faculty: testFaculty._id,
      creator: user1._id,
      members: [{ student: user1._id, studentType: 'INTERNAL', status: 'ACTIVE' }]
    });

    // Try same name with different casing
    await Team.create({
      name: 'testteam_alpha',
      faculty: testFaculty._id,
      creator: user1._id,
      members: [{ student: user1._id, studentType: 'INTERNAL', status: 'ACTIVE' }]
    });
    assert(false, '9. Duplicate team name under same faculty (case-insensitive) fails');
  } catch (err) {
    assert(true, '9. Duplicate team name under same faculty (case-insensitive) fails');
  }

  // 10. Team size exceeding 9 fails
  try {
    const user1 = await User.findOne({ username: 'test_internal_valid' });
    const members10 = Array(10).fill({
      student: user1._id,
      studentType: 'INTERNAL',
      status: 'ACTIVE'
    });
    const bigTeam = new Team({
      name: 'TestTeam_TooBig',
      faculty: testFaculty._id,
      creator: user1._id,
      members: members10
    });
    await bigTeam.save();
    assert(false, '10. Team size 10 is rejected');
  } catch (err) {
    assert(true, '10. Team size 10 is rejected (max limit is 9)');
  }

  // 11. Middleware test: Internal student email domain check
  const { validateStudentRegistration } = require('../middleware/validation');
  let mockRes = {
    status: function (code) { this.statusCode = code; return this; },
    json: function (data) { this.body = data; return this; }
  };

  // Test Internal with non-VIT email
  let reqInternalBadEmail = {
    body: {
      studentType: 'INTERNAL',
      fullName: 'Internal User',
      registerNumber: '21BCE9999',
      email: 'internal.user@gmail.com', // NOT @vitstudent.ac.in
      username: 'internal_bad_email',
      password: 'password123',
      confirmPassword: 'password123',
      otp: '123456'
    }
  };
  await validateStudentRegistration(reqInternalBadEmail, mockRes, () => {});
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors.email.includes('@vitstudent.ac.in'),
    '11. Internal registration with non-VIT student domain is rejected'
  );

  // 12. Middleware test: External student with VIT domain is rejected
  let reqExternalVitEmail = {
    body: {
      studentType: 'EXTERNAL',
      fullName: 'External User',
      email: 'external.user@vitstudent.ac.in', // VIT email
      username: 'external_bad_email',
      password: 'password123',
      confirmPassword: 'password123',
      otp: '123456'
    }
  };
  mockRes = {
    status: function (code) { this.statusCode = code; return this; },
    json: function (data) { this.body = data; return this; }
  };
  await validateStudentRegistration(reqExternalVitEmail, mockRes, () => {});
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors.email.includes('not use VIT'),
    '12. External registration with VIT institutional domain is rejected'
  );

  // 13. Password and confirm password mismatch
  let reqPasswordMismatch = {
    body: {
      studentType: 'EXTERNAL',
      fullName: 'Pass Test',
      email: 'passtest@gmail.com',
      username: 'passtest1',
      password: 'password123',
      confirmPassword: 'differentpassword',
      otp: '123456'
    }
  };
  mockRes = {
    status: function (code) { this.statusCode = code; return this; },
    json: function (data) { this.body = data; return this; }
  };
  await validateStudentRegistration(reqPasswordMismatch, mockRes, () => {});
  assert(
    mockRes.statusCode === 400 && mockRes.body.errors.confirmPassword.includes('match'),
    '13. Password and Confirm Password mismatch is rejected'
  );

  // Cleanup test data
  await User.deleteMany({ username: { $regex: /^test_/ } });
  await Team.deleteMany({ name: { $regex: /^TestTeam_/ } });

  console.log('\n------------------------------------------------------');
  console.log(` Summary: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('------------------------------------------------------\n');

  await mongoose.disconnect();
  process.exit(testsFailed > 0 ? 1 : 0);
}

runTestSuite();
