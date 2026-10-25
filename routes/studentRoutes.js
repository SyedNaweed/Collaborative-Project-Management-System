const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { isAuthenticated, isStudent } = require('../middleware/auth');
const { validateTeamCreation } = require('../middleware/validation');

router.use(isAuthenticated);
router.use(isStudent);

// Student Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const student = await User.findById(req.user._id).populate('assignedFaculty', 'fullName employeeId email');

    // Find student's active and past teams
    const activeTeam = await Team.findOne({
      'members.student': req.user._id,
      'members.status': 'ACTIVE',
      isActive: true
    }).populate('faculty', 'fullName employeeId email')
      .populate({
        path: 'members.student',
        select: 'fullName username email studentType registerNumber'
      })
      .populate('currentProject');

    const pastTeams = await Team.find({
      'members.student': req.user._id,
      $or: [{ 'members.status': 'LEFT' }, { isActive: false }]
    }).populate('faculty', 'fullName');

    let tasks = [];
    if (activeTeam && activeTeam.currentProject) {
      tasks = await Task.find({
        project: activeTeam.currentProject._id,
        assignedTo: req.user._id
      });
    }

    res.render('student/dashboard', {
      title: 'Student Dashboard | CPMS',
      student,
      activeTeam,
      pastTeams,
      tasks
    });
  } catch (err) {
    console.error('Student Dashboard Error:', err);
    res.status(500).render('error', { title: 'Server Error', message: err.message });
  }
});

// View and Select Faculty
router.get('/select-faculty', async (req, res) => {
  try {
    const faculties = await User.find({ role: 'FACULTY' }).select('fullName employeeId email facultyCapacity');

    // Calculate occupied slots and available slots for each faculty
    const facultyList = await Promise.all(
      faculties.map(async (f) => {
        const occupied = await Team.countDocuments({ faculty: f._id, isActive: true });
        const available = f.facultyCapacity - occupied;
        return {
          _id: f._id,
          fullName: f.fullName,
          employeeId: f.employeeId,
          email: f.email,
          capacity: f.facultyCapacity,
          occupied,
          available: available > 0 ? available : 0,
          isAvailable: available > 0
        };
      })
    );

    res.render('student/faculty-select', {
      title: 'Select Faculty Guide | CPMS',
      facultyList,
      currentAssigned: req.user.assignedFaculty
    });
  } catch (err) {
    console.error('Faculty List Error:', err);
    res.status(500).render('error', { title: 'Server Error', message: err.message });
  }
});

// Register Under Faculty POST
router.post('/select-faculty', async (req, res) => {
  try {
    const { facultyId } = req.body;
    if (!facultyId) {
      return res.status(400).json({ success: false, message: 'Please select a faculty member.' });
    }

    const faculty = await User.findOne({ _id: facultyId, role: 'FACULTY' });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty member not found.' });
    }

    // Capacity verification on the backend
    const occupied = await Team.countDocuments({ faculty: faculty._id, isActive: true });
    if (occupied >= faculty.facultyCapacity) {
      return res.status(400).json({
        success: false,
        message: `Faculty ${faculty.fullName} is currently at full capacity (${faculty.facultyCapacity} teams).`
      });
    }

    // Assign faculty to student profile
    req.user.assignedFaculty = faculty._id;
    await req.user.save();

    return res.json({
      success: true,
      message: `Successfully registered under Faculty ${faculty.fullName}.`,
      redirectUrl: '/student/create-team'
    });
  } catch (err) {
    console.error('Assign Faculty Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to assign faculty.' });
  }
});

// Render Create Team Page
router.get('/create-team', async (req, res) => {
  try {
    const faculties = await User.find({ role: 'FACULTY' }).select('fullName employeeId email facultyCapacity');
    const student = await User.findById(req.user._id);

    // Compute live capacity info
    const facultyOptions = await Promise.all(
      faculties.map(async (f) => {
        const occupied = await Team.countDocuments({ faculty: f._id, isActive: true });
        return {
          _id: f._id,
          fullName: f.fullName,
          employeeId: f.employeeId,
          email: f.email,
          capacity: f.facultyCapacity,
          occupied,
          available: Math.max(0, f.facultyCapacity - occupied)
        };
      })
    );

    res.render('student/create-team', {
      title: 'Create Team | CPMS',
      facultyOptions,
      student
    });
  } catch (err) {
    console.error('Render Create Team Error:', err);
    res.status(500).render('error', { title: 'Server Error', message: err.message });
  }
});

// Create Team POST (with Mixed Team Collaboration Checkbox enforced)
router.post('/create-team', validateTeamCreation, async (req, res) => {
  try {
    const { name, faculty, creator, members, isMixedTeam, collaborationConfirmed } = req.teamData;

    const newTeam = new Team({
      name,
      faculty,
      creator,
      members,
      isMixedTeam,
      collaborationConfirmed
    });

    await newTeam.save();

    return res.status(201).json({
      success: true,
      message: `Team "${name}" created successfully!`,
      redirectUrl: '/student/dashboard'
    });
  } catch (err) {
    console.error('Team Creation Save Error:', err);
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        errors: { name: 'A team with this name already exists under the selected faculty.' }
      });
    }
    return res.status(500).json({ success: false, message: 'Internal server error creating team.' });
  }
});

// Leave Team Request
router.post('/leave-team', async (req, res) => {
  try {
    const { teamId } = req.body;
    const team = await Team.findById(teamId).populate('currentProject');

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    // Rule 22: Check whether the team's current project is still ongoing
    if (team.currentProject && !['COMPLETED', 'REJECTED'].includes(team.currentProject.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot leave team while an academic project is ongoing. You can only leave after the project is completed.'
      });
    }

    // Mark member as LEFT and record leftAt date (preserving history)
    const memberEntry = team.members.find((m) => m.student.toString() === req.user._id.toString() && m.status === 'ACTIVE');
    if (!memberEntry) {
      return res.status(400).json({ success: false, message: 'You are not an active member of this team.' });
    }

    memberEntry.status = 'LEFT';
    memberEntry.leftAt = new Date();

    // Check remaining active members
    const activeRemaining = team.members.filter((m) => m.status === 'ACTIVE');
    if (activeRemaining.length === 0) {
      team.isActive = false;
    }

    await team.save();

    return res.json({
      success: true,
      message: 'You have successfully left the team. Your previous contributions remain stored in your academic history.',
      redirectUrl: '/student/dashboard'
    });
  } catch (err) {
    console.error('Leave Team Error:', err);
    return res.status(500).json({ success: false, message: 'Error processing leave request.' });
  }
});

module.exports = router;
