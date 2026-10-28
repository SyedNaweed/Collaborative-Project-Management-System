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

    // Auto-sync if student is in an active team but profile assignedFaculty diverged
    if (activeTeam && activeTeam.faculty) {
      if (!student.assignedFaculty || student.assignedFaculty._id.toString() !== activeTeam.faculty._id.toString()) {
        student.assignedFaculty = activeTeam.faculty;
        await User.findByIdAndUpdate(student._id, { assignedFaculty: activeTeam.faculty._id });
      }
    }

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

    // Find student's active team to ensure authoritative faculty guide
    const activeTeam = await Team.findOne({
      'members.student': req.user._id,
      'members.status': 'ACTIVE',
      isActive: true
    }).populate('faculty', 'fullName');

    const effectiveAssigned = (activeTeam && activeTeam.faculty)
      ? activeTeam.faculty._id
      : req.user.assignedFaculty;

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
      currentAssigned: effectiveAssigned,
      activeTeam
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

    // Check if student already belongs to an active team
    const activeTeam = await Team.findOne({
      'members.student': req.user._id,
      'members.status': 'ACTIVE',
      isActive: true
    }).populate('faculty', 'fullName');

    if (activeTeam && activeTeam.faculty && activeTeam.faculty._id.toString() !== facultyId) {
      return res.status(400).json({
        success: false,
        message: `You are currently an active member of team "${activeTeam.name}" under ${activeTeam.faculty.fullName}. Leave your team before registering under a different faculty.`
      });
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
      redirectUrl: '/student/dashboard'
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

    // Auto-sync team creator and members' assignedFaculty to match team's faculty
    req.user.assignedFaculty = faculty;
    await req.user.save();
    await User.updateMany(
      { _id: { $in: members.map((m) => m.student) } },
      { $set: { assignedFaculty: faculty } }
    );

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

// Remove Teammate (by Team Creator)
router.post('/team/:teamId/remove-member', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Member identifier is required.' });
    }

    const team = await Team.findById(teamId).populate('currentProject');
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    // Only the team creator can remove teammates
    if (team.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the team creator has permission to remove teammates.' });
    }

    // Creator cannot remove themselves
    if (memberId.toString() === team.creator.toString()) {
      return res.status(400).json({
        success: false,
        message: 'The team creator cannot be removed from the team. To disband the team, please use the Delete Team option.'
      });
    }

    // Find member index in team
    const memberIndex = team.members.findIndex((m) => m.student.toString() === memberId.toString());
    if (memberIndex === -1) {
      return res.status(404).json({ success: false, message: 'Student is not an active member of this team.' });
    }

    const removedStudentId = team.members[memberIndex].student;

    // Remove from team members array
    team.members.splice(memberIndex, 1);

    // Re-evaluate mixed team status
    const hasInternal = team.members.some((m) => m.studentType === 'INTERNAL');
    const hasExternal = team.members.some((m) => m.studentType === 'EXTERNAL');
    team.isMixedTeam = hasInternal && hasExternal;
    if (!team.isMixedTeam) {
      team.collaborationConfirmed = false;
    }

    await team.save();

    // If there is an active project, clean up member's participation and unassign active tasks
    if (team.currentProject) {
      await Project.updateOne(
        { _id: team.currentProject },
        { $pull: { participatingMembers: { student: removedStudentId } } }
      );

      // Unassign uncompleted tasks assigned to this removed member
      await Task.updateMany(
        { project: team.currentProject, assignedTo: removedStudentId, status: { $ne: 'COMPLETED' } },
        { $set: { assignedTo: null, status: 'TODO' } }
      );
    }

    return res.json({
      success: true,
      message: 'Teammate was successfully removed from the team.',
      redirectUrl: '/student/dashboard'
    });
  } catch (err) {
    console.error('Remove Teammate Error:', err);
    return res.status(500).json({ success: false, message: 'Error removing teammate.' });
  }
});

// Delete / Disband Team (by Team Creator)
router.post('/team/:teamId/delete', async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    // Only the team creator can delete the team
    if (team.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the team creator has permission to delete this team.' });
    }

    // Clean up project, tasks, issues associated with this team
    const projects = await Project.find({ team: team._id });
    const projectIds = projects.map((p) => p._id);

    if (projectIds.length > 0) {
      const Issue = require('../models/Issue');
      await Task.deleteMany({ project: { $in: projectIds } });
      await Issue.deleteMany({ project: { $in: projectIds } });
      await Project.deleteMany({ _id: { $in: projectIds } });
    }

    // Delete the team document
    await Team.findByIdAndDelete(teamId);

    return res.json({
      success: true,
      message: `Team "${team.name}" has been permanently deleted and all member slots have been released.`,
      redirectUrl: '/student/dashboard'
    });
  } catch (err) {
    console.error('Delete Team Error:', err);
    return res.status(500).json({ success: false, message: 'Error deleting team.' });
  }
});

module.exports = router;
