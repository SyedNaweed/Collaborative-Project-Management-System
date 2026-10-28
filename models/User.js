const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      validate: {
        validator: function (v) {
          return /^[a-zA-Z]{3,30}$/.test(v);
        },
        message: 'Username must contain only alphabetic letters without any numbers or special characters.'
      }
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: [true, 'Password is required']
    },
    role: {
      type: String,
      enum: ['STUDENT', 'FACULTY'],
      required: true
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    // Student specific fields
    studentType: {
      type: String,
      enum: ['INTERNAL', 'EXTERNAL'],
      required: function () {
        return this.role === 'STUDENT';
      }
    },
    registerNumber: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      sparse: true,
      validate: {
        validator: function (v) {
          // Required only for INTERNAL student: 2 numbers, 3 alphabets, 4 numbers
          if (this.role === 'STUDENT' && this.studentType === 'INTERNAL') {
            return typeof v === 'string' && /^[0-9]{2}[A-Z]{3}[0-9]{4}$/.test(v.trim().toUpperCase());
          }
          return true;
        },
        message: 'Register Number must follow the format: 2 numbers, 3 alphabets, and 4 numbers (e.g. 22BIT0061).'
      }
    },
    assignedFaculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // Faculty specific fields
    employeeId: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      sparse: true,
      required: function () {
        return this.role === 'FACULTY';
      }
    },
    facultyCapacity: {
      type: Number,
      min: [2, 'Minimum team capacity is 2'],
      max: [7, 'Maximum team capacity is 7'],
      required: function () {
        return this.role === 'FACULTY';
      }
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password helper
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Password hashing and comparison helpers exist above
module.exports = mongoose.model('User', userSchema);
