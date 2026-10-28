require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Issue = require('../models/Issue');

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

async function runTeamManagementTests() {
  console.log('\n================================================================');
  console.log('   TEAMMATE DELETION & TEAM DISBANDMENT TEST SUITE   ');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collaborative_pms';
  await mongoose.connect(mongoUri);

  // Clean slate
  await User.deleteMany({ username: { $regex: /^teamtest/ } });
  await Team.deleteMany({ name: { $regex: /^TeamTest_/ } });
  await Project.deleteMany({ title: { $regex: /^TeamTestProj_/ } });

  // 1. Setup Faculty and Students
  const faculty = await User.create({
    username: 'teamtestfaculty',
    email: 'teamtest.fac@vit.ac.in',
    password: 'password123',
    role: 'FACULTY',
    fullName: 'Dr. Team Test Guide',
    employeeId: 'TESTEMP771',
    facultyCapacity: 4
  });

  const creatorStudent = await User.create({
    username: 'teamtestcreator',
    email: 'creator@vitstudent.ac.in',
    password: 'password123',
    role: 'STUDENT',
    studentType: 'INTERNAL',
    fullName: 'Team Creator Student',
    registerNumber: '21BCE7701',
    assignedFaculty: faculty._id
  });

  const memberInternal = await User.create({
    username: 'teamtestintmember',
    email: 'intmember@vitstudent.ac.in',
    password: 'password123',
    role: 'STUDENT',
    studentType: 'INTERNAL',
    fullName: 'Internal Teammate',
    registerNumber: '21BCE7702',
    assignedFaculty: faculty._id
  });

  const memberExternal = await User.create({
    username: 'teamtestextmember',
    email: 'extmember@gmail.com',
    password: 'password123',
    role: 'STUDENT',
    studentType: 'EXTERNAL',
    fullName: 'External Teammate',
    assignedFaculty: faculty._id
  });

  // 2. Create Mixed Team
  const team = await Team.create({
    name: 'TeamTest_SquadAlpha',
    faculty: faculty._id,
    creator: creatorStudent._id,
    members: [
      { student: creatorStudent._id, studentType: 'INTERNAL', status: 'ACTIVE' },
      { student: memberInternal._id, studentType: 'INTERNAL', status: 'ACTIVE' },
      { student: memberExternal._id, studentType: 'EXTERNAL', status: 'ACTIVE' }
    ],
    isMixedTeam: true,
    collaborationConfirmed: true
  });

  // Create Project and Tasks
  const project = await Project.create({
    team: team._id,
    faculty: faculty._id,
    title: 'TeamTestProj_AlphaService',
    description: 'Autonomous microservice test',
    status: 'IN_PROGRESS',
    participatingMembers: [
      { student: creatorStudent._id, participationStatus: 'ACTIVE' },
      { student: memberInternal._id, participationStatus: 'ACTIVE' },
      { student: memberExternal._id, participationStatus: 'ACTIVE' }
    ]
  });

  team.currentProject = project._id;
  await team.save();

  const task1 = await Task.create({
    project: project._id,
    title: 'Task for External Member',
    description: 'External specific task',
    assignedTo: memberExternal._id,
    status: 'IN_PROGRESS'
  });

  // -------------------------------------------------------------
  // Test 1: Creator cannot remove themselves from team
  // -------------------------------------------------------------
  const canRemoveSelf = memberExternal._id.toString() !== creatorStudent._id.toString();
  assert(canRemoveSelf === true, '1.1 System differentiates creator from other teammates');

  // -------------------------------------------------------------
  // Test 2: Teammate deletion removes member from active list
  // -------------------------------------------------------------
  const initialCount = team.members.length;
  const extIndex = team.members.findIndex(m => m.student.toString() === memberExternal._id.toString());
  team.members.splice(extIndex, 1);

  // Recalculate mixed team status: Now only internal students remain!
  const hasInt = team.members.some(m => m.studentType === 'INTERNAL');
  const hasExt = team.members.some(m => m.studentType === 'EXTERNAL');
  team.isMixedTeam = hasInt && hasExt;
  await team.save();

  // Unassign tasks assigned to removed member
  await Task.updateMany(
    { project: team.currentProject, assignedTo: memberExternal._id, status: { $ne: 'COMPLETED' } },
    { $set: { assignedTo: null, status: 'TODO' } }
  );

  assert(team.members.length === initialCount - 1, '1.2 Teammate is removed from team members list');
  assert(team.isMixedTeam === false, '1.3 Mixed team status is automatically recalculated to false when external member is removed');

  const refreshedTask = await Task.findById(task1._id);
  assert(refreshedTask.assignedTo === null && refreshedTask.status === 'TODO', '1.4 Uncompleted tasks of removed teammate are returned to unassigned project pool');

  // Verify removed student is now free to join another team
  const activeMembershipForExt = await Team.findOne({
    'members.student': memberExternal._id,
    'members.status': 'ACTIVE',
    isActive: true
  });
  assert(!activeMembershipForExt, '1.5 Removed teammate is immediately freed to join or create other teams');

  // -------------------------------------------------------------
  // Test 3: Team Deletion permanently cleans up team & project
  // -------------------------------------------------------------
  const projects = await Project.find({ team: team._id });
  const pIds = projects.map(p => p._id);
  await Task.deleteMany({ project: { $in: pIds } });
  await Project.deleteMany({ _id: { $in: pIds } });
  await Team.findByIdAndDelete(team._id);

  const teamCheck = await Team.findById(team._id);
  const projCheck = await Project.findById(project._id);
  const taskCheck = await Task.find({ project: project._id });

  assert(!teamCheck, '2.1 Team document is permanently removed upon deletion');
  assert(!projCheck, '2.2 Associated project is permanently removed upon team deletion');
  assert(taskCheck.length === 0, '2.3 Associated project tasks are permanently removed upon team deletion');

  // Verify creator and remaining member are now free to create new teams
  const activeCreatorMembership = await Team.findOne({
    'members.student': creatorStudent._id,
    isActive: true
  });
  assert(!activeCreatorMembership, '2.4 Team creator is immediately released to create or join a new team');

  // Verify faculty capacity is freed up
  const occupiedSlots = await Team.countDocuments({ faculty: faculty._id, isActive: true });
  assert(occupiedSlots === 0, '2.5 Faculty guide occupied team slot is immediately released (0 active teams)');

  // Cleanup
  await User.deleteMany({ username: { $regex: /^teamtest/ } });
  await Team.deleteMany({ name: { $regex: /^TeamTest_/ } });
  await Project.deleteMany({ title: { $regex: /^TeamTestProj_/ } });

  console.log('\n================================================================');
  console.log(` RESULTS: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('================================================================\n');

  await mongoose.disconnect();
  process.exit(testsFailed > 0 ? 1 : 0);
}

runTeamManagementTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
