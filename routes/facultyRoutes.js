const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { isAuthenticated, isFaculty } = require('../middleware/auth');

router.use(isAuthenticated);
router.use(isFaculty);

// Faculty Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const faculty = req.user;

    // Fetch teams under this faculty
    const teams = await Team.find({ faculty: faculty._id })
      .populate({
        path: 'members.student',
        select: 'fullName username email studentType registerNumber'
      })
      .populate('currentProject');

    const occupiedSlots = teams.filter((t) => t.isActive).length;
    const availableSlots = Math.max(0, faculty.facultyCapacity - occupiedSlots);

    // Fetch proposals under this faculty
    const pendingProposals = await Project.find({
      faculty: faculty._id,
      status: 'PROPOSED'
    }).populate('team', 'name isMixedTeam');

    const activeProjects = await Project.find({
      faculty: faculty._id,
      status: { $in: ['APPROVED', 'IN_PROGRESS'] }
    }).populate('team', 'name');

    const completedProjects = await Project.find({
      faculty: faculty._id,
      status: 'COMPLETED'
    }).populate('team', 'name');

    res.render('faculty/dashboard', {
      title: 'Faculty Dashboard | CPMS',
      faculty,
      teams,
      occupiedSlots,
      availableSlots,
      pendingProposals,
      activeProjects,
      completedProjects
    });
  } catch (err) {
    console.error('Faculty Dashboard Error:', err);
    res.status(500).render('error', { title: 'Server Error', message: err.message });
  }
});

// Proposal Decision (Approve, Reject, Revision Request)
router.post('/proposal-decision', async (req, res) => {
  try {
    const { projectId, action, reason, revisionNotes } = req.body;
    const project = await Project.findOne({ _id: projectId, faculty: req.user._id });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project proposal not found.' });
    }

    if (action === 'APPROVE') {
      project.status = 'APPROVED';
      // Mark participating members active
      const team = await Team.findById(project.team);
      if (team) {
        team.currentProject = project._id;
        await team.save();

        project.participatingMembers = team.members
          .filter((m) => m.status === 'ACTIVE')
          .map((m) => ({ student: m.student, participationStatus: 'ACTIVE' }));
      }
    } else if (action === 'REJECT') {
      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
      }
      project.status = 'REJECTED';
      project.rejectionReason = reason.trim();
    } else if (action === 'REVISION') {
      if (!revisionNotes || !revisionNotes.trim()) {
        return res.status(400).json({ success: false, message: 'Revision instructions are required.' });
      }
      project.status = 'REVISION_REQUESTED';
      project.revisionNotes = revisionNotes.trim();
    } else {
      return res.status(400).json({ success: false, message: 'Invalid proposal action.' });
    }

    await project.save();

    return res.json({
      success: true,
      message: `Project proposal successfully updated to ${project.status}.`,
      redirectUrl: '/faculty/dashboard'
    });
  } catch (err) {
    console.error('Proposal Decision Error:', err);
    return res.status(500).json({ success: false, message: 'Server error processing decision.' });
  }
});

// Final Evaluation and Archival
router.post('/evaluate-project', async (req, res) => {
  try {
    const { projectId, score, remarks } = req.body;
    const project = await Project.findOne({ _id: projectId, faculty: req.user._id });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const numericScore = Number(score);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      return res.status(400).json({ success: false, message: 'Score must be a number between 0 and 100.' });
    }

    project.evaluation = {
      score: numericScore,
      remarks: remarks ? remarks.trim() : 'Project evaluated successfully.',
      evaluatedAt: new Date()
    };
    project.status = 'COMPLETED';
    project.isArchived = true;
    await project.save();

    return res.json({
      success: true,
      message: 'Project evaluated, completed, and archived successfully!',
      redirectUrl: '/faculty/dashboard'
    });
  } catch (err) {
    console.error('Project Evaluation Error:', err);
    return res.status(500).json({ success: false, message: 'Error evaluating project.' });
  }
});

module.exports = router;
