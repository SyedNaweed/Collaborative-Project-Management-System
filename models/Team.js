const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentType: {
    type: String,
    enum: ['INTERNAL', 'EXTERNAL'],
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'LEFT'],
    default: 'ACTIVE'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: {
    type: Date,
    default: null
  }
});

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Faculty association is required']
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    members: {
      type: [memberSchema],
      validate: [
        {
          validator: function (val) {
            return val && val.length >= 1 && val.length <= 9;
          },
          message: 'Team size must be between 1 and 9 students.'
        }
      ]
    },
    isMixedTeam: {
      type: Boolean,
      default: false
    },
    collaborationConfirmed: {
      type: Boolean,
      default: false
    },
    currentProject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Normalize team name before validation & saving
teamSchema.pre('validate', function (next) {
  if (this.name) {
    this.normalizedName = this.name.trim().toLowerCase();
  }
  next();
});

// Composite unique index: Team names must be unique within the same faculty (case-insensitive)
teamSchema.index({ faculty: 1, normalizedName: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);
