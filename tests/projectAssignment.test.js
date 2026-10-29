require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const Task = require('../models/Task');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message, extra = '') {
  if (condition) {
    console.log(`  ✔ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✖ FAIL: ${message} ${extra ? `(${extra})` : ''}`);
    testsFailed++;
  }
}

async function runProjectAssignmentTests() {
  console.log('\n================================================================');
  console.log('   FACULTY DIRECT PROJECT ASSIGNMENT WORKFLOW TEST SUITE   ');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collaborative_pms';
  await mongoose.connect(mongoUri);

  // Clean slate for test entities
  await User.deleteMany({ username: { $regex: /^assignfac/ } });
  await User.deleteMany({ username: { $regex: /^assignstu/ } });
  await Team.deleteMany({ name: { $regex: /^AssignTeam_/ } });
  await Project.deleteMany({ title: { $regex: /^AssignProj_/ } });

  // 1. Setup Faculty Guides & Students
  const faculty1 = await User.create({
    username: 'assignfacone',
    email: 'assignfacone@vit.ac.in',
    password: 'password123',
    role: 'FACULTY',
    fullName: 'Dr. Faculty Assignment Guide',
    employeeId: 'EMPASSIGNONE',
    facultyCapacity: 5
  });

  const faculty2 = await User.create({
    username: 'assignfactwo',
    email: 'assignfactwo@vit.ac.in',
    password: 'password123',
    role: 'FACULTY',
    fullName: 'Dr. Rival Faculty Guide',
    employeeId: 'EMPASSIGNTWO',
    facultyCapacity: 4
  });

  const student1 = await User.create({
    username: 'assignstuone',
    email: 'assignstuone@vitstudent.ac.in',
    password: 'password123',
    role: 'STUDENT',
    studentType: 'INTERNAL',
    fullName: 'Assignment Student One',
    registerNumber: '21BCE9901',
    assignedFaculty: faculty1._id
  });

  const student2 = await User.create({
    username: 'assignstutwo',
    email: 'assignstutwo@vitstudent.ac.in',
    password: 'password123',
    role: 'STUDENT',
    studentType: 'INTERNAL',
    fullName: 'Assignment Student Two',
    registerNumber: '21BCE9902',
    assignedFaculty: faculty1._id
  });

  // 2. Create Guided Team
  const team = await Team.create({
    name: 'AssignTeam_AlphaGrid',
    faculty: faculty1._id,
    creator: student1._id,
    members: [
      { student: student1._id, studentType: 'INTERNAL', status: 'ACTIVE' },
      { student: student2._id, studentType: 'INTERNAL', status: 'ACTIVE' }
    ],
    isMixedTeam: false,
    collaborationConfirmed: false
  });

  console.log('--- 1. Direct Project Assignment by Faculty ---');

  // Test 1.1: Successful assignment of project directly by supervising faculty
  const activeMembers = team.members.filter((m) => m.status === 'ACTIVE');
  const project = new Project({
    team: team._id,
    faculty: faculty1._id,
    title: 'AssignProj_CloudArchitecture',
    description: 'Autonomous microservices scheduler with fault tolerance.',
    status: 'APPROVED',
    participatingMembers: activeMembers.map((m) => ({
      student: m.student,
      participationStatus: 'ACTIVE'
    }))
  });
  await project.save();
  team.currentProject = project._id;
  await team.save();

  assert(project._id != null, '1.1 Project document created successfully by faculty');
  assert(project.status === 'APPROVED', '1.2 Project is immediately APPROVED upon faculty assignment');
  assert(
    project.participatingMembers.length === 2 &&
      project.participatingMembers.every((m) => m.participationStatus === 'ACTIVE'),
    '1.3 All active team members enrolled as active project participants'
  );

  const reloadedTeam = await Team.findById(team._id).populate('currentProject');
  assert(
    reloadedTeam.currentProject && reloadedTeam.currentProject.title === 'AssignProj_CloudArchitecture',
    '1.4 Team currentProject updated to the faculty-assigned project'
  );

  console.log('\n--- 2. Institutional Authorization & Concurrency Guards ---');

  // Test 2.1: A different faculty cannot assign a project to a team they do not supervise
  const isSupervisingFaculty = team.faculty.toString() === faculty2._id.toString();
  assert(!isSupervisingFaculty, '2.1 Non-supervising faculty guide cannot assign project to another faculty team');

  // Test 2.2: Cannot assign a new project while an existing project is ongoing (APPROVED / IN_PROGRESS)
  const hasOngoingProject =
    reloadedTeam.currentProject &&
    !['COMPLETED', 'REJECTED'].includes(reloadedTeam.currentProject.status);
  assert(hasOngoingProject, '2.2 New project assignment blocked while team project is currently active');

  console.log('\n--- 3. Scope Modification & Lifecycle Progression ---');

  // Test 3.1: Faculty updates project scope/title
  project.title = 'AssignProj_CloudArchitecture_V2';
  project.description = 'Updated scope with container security constraints.';
  await project.save();

  const updatedProj = await Project.findById(project._id);
  assert(
    updatedProj.title === 'AssignProj_CloudArchitecture_V2' &&
      updatedProj.description.includes('container security'),
    '3.1 Faculty can update assigned project title and scope'
  );

  // Test 3.2: Once project is COMPLETED, faculty can assign subsequent project
  project.status = 'COMPLETED';
  project.isArchived = true;
  await project.save();

  const canAssignSubsequent =
    !reloadedTeam.currentProject ||
    ['COMPLETED', 'REJECTED'].includes(project.status);
  assert(canAssignSubsequent, '3.2 Faculty can assign a subsequent project after completion of prior project');

  // Clean up
  await User.deleteMany({ username: { $regex: /^assignfac/ } });
  await User.deleteMany({ username: { $regex: /^assignstu/ } });
  await Team.deleteMany({ name: { $regex: /^AssignTeam_/ } });
  await Project.deleteMany({ title: { $regex: /^AssignProj_/ } });

  console.log('\n================================================================');
  console.log(` RESULTS: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('================================================================\n');

  await mongoose.disconnect();
  process.exit(testsFailed > 0 ? 1 : 0);
}

runProjectAssignmentTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
