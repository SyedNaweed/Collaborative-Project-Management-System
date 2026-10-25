require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const Task = require('../models/Task');
const OTP = require('../models/OTP');
const Issue = require('../models/Issue');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collaborative_pms';
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB');

    // Clear existing data cleanly
    await User.deleteMany({});
    await Team.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});
    await OTP.deleteMany({});
    await Issue.deleteMany({});

    console.log('[Seed] Database collections cleared.');

    // 1. Create Faculty Members
    const faculty1 = await User.create({
      username: 'drpriya',
      email: 'priya.raman@vit.ac.in',
      password: 'password123',
      role: 'FACULTY',
      fullName: 'Dr. Priya Raman',
      employeeId: 'EMP1001',
      facultyCapacity: 4
    });

    const faculty2 = await User.create({
      username: 'drsuresh',
      email: 'suresh.kumar@vit.ac.in',
      password: 'password123',
      role: 'FACULTY',
      fullName: 'Dr. Suresh Kumar',
      employeeId: 'EMP1002',
      facultyCapacity: 5
    });

    console.log('[Seed] Faculty created:', faculty1.username, faculty2.username);

    // 2. Create Internal Students
    const student1 = await User.create({
      username: 'rahul21',
      email: 'rahul.sharma2021@vitstudent.ac.in',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'INTERNAL',
      fullName: 'Rahul Sharma',
      registerNumber: '21BCE1001',
      assignedFaculty: faculty1._id
    });

    const student2 = await User.create({
      username: 'ananya21',
      email: 'ananya.patel2021@vitstudent.ac.in',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'INTERNAL',
      fullName: 'Ananya Patel',
      registerNumber: '21BCE1045',
      assignedFaculty: faculty1._id
    });

    // 3. Create External Student (Personal email, No Register Number)
    const student3 = await User.create({
      username: 'alex_external',
      email: 'alex.collaboration@gmail.com',
      password: 'password123',
      role: 'STUDENT',
      studentType: 'EXTERNAL',
      fullName: 'Alex Vance',
      assignedFaculty: faculty1._id
    });

    console.log('[Seed] Students created:', student1.username, student2.username, student3.username);

    // 4. Create a Sample Mixed Team with Mandatory Collaboration Confirmation
    const sampleTeam = await Team.create({
      name: 'CyberOrchestrators',
      faculty: faculty1._id,
      creator: student1._id,
      members: [
        { student: student1._id, studentType: 'INTERNAL', status: 'ACTIVE' },
        { student: student2._id, studentType: 'INTERNAL', status: 'ACTIVE' },
        { student: student3._id, studentType: 'EXTERNAL', status: 'ACTIVE' }
      ],
      isMixedTeam: true,
      collaborationConfirmed: true
    });

    // 5. Create Approved Project Proposal
    const sampleProject = await Project.create({
      team: sampleTeam._id,
      faculty: faculty1._id,
      title: 'Cloud-Native Distributed Task Orchestration Engine',
      description: 'An enterprise task scheduling and dependency resolution platform with automated failure recovery and AI verification of submitted deliverables.',
      status: 'APPROVED',
      participatingMembers: [
        { student: student1._id, participationStatus: 'ACTIVE' },
        { student: student2._id, participationStatus: 'ACTIVE' },
        { student: student3._id, participationStatus: 'FROZEN' } // Alex is frozen for this project without leaving team!
      ]
    });

    sampleTeam.currentProject = sampleProject._id;
    await sampleTeam.save();

    // 6. Create Tasks with Dependencies
    const task1 = await Task.create({
      project: sampleProject._id,
      title: 'Database Schema & State Machine Modeling',
      description: 'Define Mongoose schemas, indexes, and state machine transitions.',
      assignedTo: student1._id,
      status: 'COMPLETED',
      submissions: [
        {
          version: 1,
          content: 'https://github.com/SyedNaweed/cpms/pull/1 - Initial Mongoose schema definitions.',
          aiReport: { similarityScore: 4, feedback: 'AI Verified: Valid schema syntax and indexes confirmed.', flags: [] }
        }
      ]
    });

    const task2 = await Task.create({
      project: sampleProject._id,
      title: 'REST API & Form Validation Middleware',
      description: 'Build Express routes with strict domain and capacity validation.',
      assignedTo: student2._id,
      dependencies: [task1._id],
      status: 'IN_PROGRESS'
    });

    // 7. Create Issue
    await Issue.create({
      project: sampleProject._id,
      raisedBy: student1._id,
      title: 'Validating external student email domains against institution whitelist',
      description: 'Need confirmation on whether external emails should support custom corporate domains.',
      status: 'OPEN'
    });

    console.log('[Seed] Database successfully populated with initial data!');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
};

seedData();
