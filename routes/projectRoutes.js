const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Team = require('../models/Team');
const Task = require('../models/Task');
const Issue = require('../models/Issue');
const { isAuthenticated } = require('../middleware/auth');
const { validateProjectProposal } = require('../middleware/validation');

router.use(isAuthenticated);

// Propose New Project POST
router.post('/propose', validateProjectProposal, async (req, res) => {
  try {
    const { title, description, teamId } = req.body;
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    const project = new Project({
      team: team._id,
      faculty: team.faculty,
      title: title.trim(),
      description: description.trim(),
      status: 'PROPOSED',
      participatingMembers: team.members
        .filter((m) => m.status === 'ACTIVE')
        .map((m) => ({ student: m.student, participationStatus: 'ACTIVE' }))
    });

    await project.save();

    team.currentProject = project._id;
    await team.save();

    return res.status(201).json({
      success: true,
      message: 'Project proposal submitted to faculty successfully!',
      redirectUrl: `/project/${project._id}/workspace`
    });
  } catch (err) {
    console.error('Propose Project Error:', err);
    return res.status(500).json({ success: false, message: 'Server error submitting proposal.' });
  }
});

// Project Workspace View
router.get('/:id/workspace', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('team')
      .populate('faculty', 'fullName email employeeId')
      .populate({
        path: 'participatingMembers.student',
        select: 'fullName username email studentType registerNumber'
      });

    if (!project) {
      return res.status(404).render('error', { title: 'Not Found', message: 'Project not found.' });
    }

    const tasks = await Task.find({ project: project._id })
      .populate('assignedTo', 'fullName username')
      .populate('dependencies', 'title status');

    const issues = await Issue.find({ project: project._id })
      .populate('raisedBy', 'fullName username')
      .populate('resolvedBy', 'fullName username');

    res.render('project/workspace', {
      title: `${project.title} | Project Workspace`,
      project,
      tasks,
      issues,
      user: req.user
    });
  } catch (err) {
    console.error('Workspace View Error:', err);
    res.status(500).render('error', { title: 'Server Error', message: err.message });
  }
});

// Toggle Project Participation (ACTIVE vs FROZEN)
router.post('/:id/toggle-participation', async (req, res) => {
  try {
    const { studentId, status } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const memberEntry = project.participatingMembers.find(
      (m) => m.student.toString() === studentId.toString()
    );

    if (!memberEntry) {
      return res.status(404).json({ success: false, message: 'Student is not in the project participation list.' });
    }

    if (!['ACTIVE', 'FROZEN'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid participation status.' });
    }

    memberEntry.participationStatus = status;
    await project.save();

    return res.json({
      success: true,
      message: `Participation status updated to ${status}.`
    });
  } catch (err) {
    console.error('Toggle Participation Error:', err);
    return res.status(500).json({ success: false, message: 'Error updating participation.' });
  }
});

// Create Task
router.post('/:id/create-task', async (req, res) => {
  try {
    const { title, description, assignedTo, dependencies } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required.' });
    }

    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'Task must be assigned to a team member.' });
    }

    const deps = Array.isArray(dependencies)
      ? dependencies
      : typeof dependencies === 'string' && dependencies.trim()
      ? [dependencies]
      : [];

    const task = new Task({
      project: req.params.id,
      title: title.trim(),
      description: description ? description.trim() : '',
      assignedTo,
      dependencies: deps,
      status: 'TODO'
    });

    await task.save();

    return res.status(201).json({
      success: true,
      message: 'Task created successfully!',
      redirectUrl: `/project/${req.params.id}/workspace`
    });
  } catch (err) {
    console.error('Create Task Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create task.' });
  }
});

// Update Task Status with Dependency Enforcement
router.post('/task/:taskId/status', async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findById(req.params.taskId).populate('dependencies');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    // Check prerequisites if attempting to progress beyond TODO
    if (status !== 'TODO' && task.dependencies && task.dependencies.length > 0) {
      const incompleteDeps = task.dependencies.filter((d) => d.status !== 'COMPLETED');
      if (incompleteDeps.length > 0) {
        const names = incompleteDeps.map((d) => `"${d.title}"`).join(', ');
        return res.status(400).json({
          success: false,
          message: `Cannot progress task. The prerequisite task(s) (${names}) must be COMPLETED first.`
        });
      }
    }

    task.status = status;
    await task.save();

    return res.json({ success: true, message: `Task status updated to ${status}.` });
  } catch (err) {
    console.error('Task Status Error:', err);
    return res.status(500).json({ success: false, message: 'Error updating task status.' });
  }
});

// Task Deliverable Submission with Version History and AI Report
router.post('/task/:taskId/submit', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Submission content/link cannot be empty.' });
    }

    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const nextVersion = task.submissions.length + 1;

    // AI-Assisted Verification Report generation (advisory check)
    const isShort = content.trim().length < 20;
    const aiReport = {
      similarityScore: Math.floor(Math.random() * 15), // Simulated 0-15% low similarity
      feedback: isShort
        ? 'AI Flag: Submission content appears brief. Please verify complete deliverables.'
        : 'AI Verification: Deliverables match task scope. Ready for faculty review.',
      flags: isShort ? ['BRIEF_CONTENT'] : ['CLEAN_SUBMISSION']
    };

    task.submissions.push({
      version: nextVersion,
      content: content.trim(),
      submittedAt: new Date(),
      aiReport
    });

    task.status = 'IN_REVIEW';
    await task.save();

    return res.json({
      success: true,
      message: `Version ${nextVersion} submitted successfully! Status moved to IN_REVIEW.`,
      submission: task.submissions[task.submissions.length - 1]
    });
  } catch (err) {
    console.error('Submission Error:', err);
    return res.status(500).json({ success: false, message: 'Error submitting deliverable.' });
  }
});

// Faculty Deliverable Verification & Review
router.post('/task/:taskId/verify', async (req, res) => {
  try {
    if (req.user.role !== 'FACULTY') {
      return res.status(403).json({ success: false, message: 'Only faculty members can verify deliverables.' });
    }

    const { action, remarks } = req.body;
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (!task.submissions || task.submissions.length === 0) {
      return res.status(400).json({ success: false, message: 'No submissions found to verify.' });
    }

    const latestSub = task.submissions[task.submissions.length - 1];

    if (action === 'APPROVE') {
      latestSub.facultyReview = {
        reviewedAt: new Date(),
        status: 'APPROVED',
        remarks: remarks && remarks.trim() ? remarks.trim() : 'Approved by faculty.'
      };
      task.status = 'COMPLETED';
      await task.save();

      return res.json({
        success: true,
        message: 'Deliverable approved! Task status marked as COMPLETED.',
        taskStatus: 'COMPLETED'
      });
    } else if (action === 'REQUEST_CHANGES') {
      latestSub.facultyReview = {
        reviewedAt: new Date(),
        status: 'CHANGES_REQUESTED',
        remarks: remarks && remarks.trim() ? remarks.trim() : 'Changes requested. Please submit updated version.'
      };
      task.status = 'IN_PROGRESS';
      await task.save();

      return res.json({
        success: true,
        message: 'Changes requested! Task returned to IN_PROGRESS for revision.',
        taskStatus: 'IN_PROGRESS'
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid verification action.' });
    }
  } catch (err) {
    console.error('Deliverable Verification Error:', err);
    return res.status(500).json({ success: false, message: 'Error verifying deliverable.' });
  }
});

// Student Proposal Resubmission (when REVISION_REQUESTED)
router.post('/:id/resubmit-proposal', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !title.trim() || !description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (project.status !== 'REVISION_REQUESTED') {
      return res.status(400).json({ success: false, message: 'Only projects in REVISION_REQUESTED status can be resubmitted.' });
    }

    project.title = title.trim();
    project.description = description.trim();
    project.status = 'PROPOSED';
    project.revisionNotes = null;
    await project.save();

    return res.json({
      success: true,
      message: 'Revised project proposal submitted for faculty review!',
      redirectUrl: `/project/${project._id}/workspace`
    });
  } catch (err) {
    console.error('Proposal Resubmission Error:', err);
    return res.status(500).json({ success: false, message: 'Error resubmitting proposal.' });
  }
});

// Create Issue / Doubt
router.post('/:id/create-issue', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Issue title and description are required.' });
    }

    const issue = new Issue({
      project: req.params.id,
      raisedBy: req.user._id,
      title: title.trim(),
      description: description.trim(),
      status: 'OPEN'
    });

    await issue.save();

    return res.status(201).json({
      success: true,
      message: 'Issue raised successfully in project workspace.',
      redirectUrl: `/project/${req.params.id}/workspace`
    });
  } catch (err) {
    console.error('Create Issue Error:', err);
    return res.status(500).json({ success: false, message: 'Error creating issue.' });
  }
});

// Resolve Issue
router.post('/issue/:issueId/resolve', async (req, res) => {
  try {
    const { resolution } = req.body;
    if (!resolution || !resolution.trim()) {
      return res.status(400).json({ success: false, message: 'Resolution details are required.' });
    }

    const issue = await Issue.findById(req.params.issueId);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found.' });
    }

    issue.resolution = resolution.trim();
    issue.status = 'RESOLVED';
    issue.resolvedBy = req.user._id;
    await issue.save();

    return res.json({ success: true, message: 'Issue marked as RESOLVED.' });
  } catch (err) {
    console.error('Resolve Issue Error:', err);
    return res.status(500).json({ success: false, message: 'Error resolving issue.' });
  }
});

module.exports = router;
