const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  version: {
    type: Number,
    required: true,
    default: 1
  },
  content: {
    type: String,
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  aiReport: {
    similarityScore: { type: Number, default: 0 },
    feedback: { type: String, default: '' },
    flags: [String]
  }
});

const taskSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'],
      default: 'TODO'
    },
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task'
      }
    ],
    submissions: [submissionSchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Task', taskSchema);
