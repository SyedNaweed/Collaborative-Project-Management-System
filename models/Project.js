const mongoose = require('mongoose');

const participationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participationStatus: {
    type: String,
    enum: ['ACTIVE', 'FROZEN'],
    default: 'ACTIVE'
  }
});

const projectSchema = new mongoose.Schema(
  {
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Project description is required'],
      trim: true
    },
    status: {
      type: String,
      enum: ['PROPOSED', 'REVISION_REQUESTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'],
      default: 'PROPOSED'
    },
    rejectionReason: {
      type: String,
      default: null
    },
    revisionNotes: {
      type: String,
      default: null
    },
    participatingMembers: [participationSchema],
    evaluation: {
      score: {
        type: Number,
        min: 0,
        max: 100,
        default: null
      },
      remarks: {
        type: String,
        default: null
      },
      evaluatedAt: {
        type: Date,
        default: null
      }
    },
    isArchived: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Project', projectSchema);
