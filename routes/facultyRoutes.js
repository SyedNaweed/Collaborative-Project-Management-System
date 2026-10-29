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

    // Fetch proposals under this faculty (both initial and revision requested)
    const pendingProposals = await Project.find({
      faculty: faculty._id,
      status: { $in: ['PROPOSED', 'REVISION_REQUESTED'] }
    }).populate('team', 'name isMixedTeam');

    const activeProjects = await Project.find({
      faculty: faculty._id,
      status: { $in: ['APPROVED', 'IN_PROGRESS'] }
    }).populate('team', 'name');

    const completedProjects = await Project.find({
      faculty: faculty._id,
      status: 'COMPLETED'
    }).populate('team', 'name');

    // Fetch tasks awaiting faculty verification
    const allFacultyProjects = await Project.find({ faculty: faculty._id }).select('_id');
    const projectIds = allFacultyProjects.map((p) => p._id);
    const pendingDeliverables = await Task.find({
      project: { $in: projectIds },
      status: 'IN_REVIEW'
    })
      .populate('project', 'title')
      .populate('assignedTo', 'fullName username');

    res.render('faculty/dashboard', {
      title: 'Faculty Dashboard | CPMS',
      faculty,
      teams,
      occupiedSlots,
      availableSlots,
      pendingProposals,
      activeProjects,
      completedProjects,
      pendingDeliverables
    });
  } catch (err) {
    console.error('Faculty Dashboard Error:', err);
    res.status(500).render('error', { title: 'Server Error', message: err.message });
  }
});

// Assign Project Directly to a Guided Student Team
router.post('/assign-project', async (req, res) => {
  try {
    const { teamId, title, description } = req.body;

    if (!teamId) {
      return res.status(400).json({ success: false, message: 'Please select a student team.' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Project title is required.' });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Project description and scope are required.' });
    }

    const team = await Team.findById(teamId).populate('currentProject');
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    if (team.faculty.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not the supervising faculty for this team.' });
    }

    if (!team.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot assign a project to an inactive team.' });
    }

    if (team.currentProject && !['COMPLETED', 'REJECTED'].includes(team.currentProject.status)) {
      return res.status(400).json({
        success: false,
        message: `Team "${team.name}" already has an ongoing project ("${team.currentProject.title}"). A new project can only be assigned after the current one is completed.`
      });
    }

    const activeMembers = team.members.filter((m) => m.status === 'ACTIVE');
    if (activeMembers.length === 0) {
      return res.status(400).json({ success: false, message: 'Selected team has no active student members.' });
    }

    const project = new Project({
      team: team._id,
      faculty: req.user._id,
      title: title.trim(),
      description: description.trim(),
      status: 'APPROVED',
      participatingMembers: activeMembers.map((m) => ({
        student: m.student,
        participationStatus: 'ACTIVE'
      }))
    });

    await project.save();

    team.currentProject = project._id;
    await team.save();

    return res.status(201).json({
      success: true,
      message: `Project "${project.title}" successfully assigned to team "${team.name}"!`,
      redirectUrl: `/project/${project._id}/workspace`
    });
  } catch (err) {
    console.error('Faculty Assign Project Error:', err);
    return res.status(500).json({ success: false, message: 'Server error assigning project.' });
  }
});

// Update Project Scope / Title by Faculty
router.post('/project/:projectId/update', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !title.trim() || !description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }

    const project = await Project.findOne({ _id: req.params.projectId, faculty: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found or unauthorized.' });
    }

    project.title = title.trim();
    project.description = description.trim();
    await project.save();

    return res.json({
      success: true,
      message: 'Project details and scope updated successfully!',
      project
    });
  } catch (err) {
    console.error('Faculty Project Update Error:', err);
    return res.status(500).json({ success: false, message: 'Error updating project details.' });
  }
});

// Proposal Decision (Approve, Reject, Revision Request - Legacy support)
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

// Delete Team (by Faculty Guide)
router.post('/team/:teamId/delete', async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    if (team.faculty.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not the supervising faculty for this team.' });
    }

    const projects = await Project.find({ team: team._id });
    const projectIds = projects.map((p) => p._id);

    if (projectIds.length > 0) {
      const Issue = require('../models/Issue');
      await Task.deleteMany({ project: { $in: projectIds } });
      await Issue.deleteMany({ project: { $in: projectIds } });
      await Project.deleteMany({ _id: { $in: projectIds } });
    }

    await Team.findByIdAndDelete(teamId);

    return res.json({
      success: true,
      message: `Team "${team.name}" has been deleted by faculty guide.`,
      redirectUrl: '/faculty/dashboard'
    });
  } catch (err) {
    console.error('Faculty Delete Team Error:', err);
    return res.status(500).json({ success: false, message: 'Error deleting team.' });
  }
});

// Remove Member (by Faculty Guide)
router.post('/team/:teamId/remove-member', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { memberId } = req.body;

    const team = await Team.findById(teamId).populate('currentProject');
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    if (team.faculty.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not the supervising faculty for this team.' });
    }

    const memberIndex = team.members.findIndex((m) => m.student.toString() === memberId.toString());
    if (memberIndex === -1) {
      return res.status(404).json({ success: false, message: 'Student is not a member of this team.' });
    }

    const removedStudentId = team.members[memberIndex].student;
    team.members.splice(memberIndex, 1);

    const hasInternal = team.members.some((m) => m.studentType === 'INTERNAL');
    const hasExternal = team.members.some((m) => m.studentType === 'EXTERNAL');
    team.isMixedTeam = hasInternal && hasExternal;
    if (!team.isMixedTeam) {
      team.collaborationConfirmed = false;
    }

    await team.save();

    if (team.currentProject) {
      await Project.updateOne(
        { _id: team.currentProject },
        { $pull: { participatingMembers: { student: removedStudentId } } }
      );
      await Task.updateMany(
        { project: team.currentProject, assignedTo: removedStudentId, status: { $ne: 'COMPLETED' } },
        { $set: { assignedTo: null, status: 'TODO' } }
      );
    }

    return res.json({
      success: true,
      message: 'Student was removed from the team by faculty guide.',
      redirectUrl: '/faculty/dashboard'
    });
  } catch (err) {
    console.error('Faculty Remove Member Error:', err);
    return res.status(500).json({ success: false, message: 'Error removing team member.' });
  }
});

module.exports = router;
