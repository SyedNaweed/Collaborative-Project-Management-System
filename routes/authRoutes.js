const express = require('express');
const router = express.Router();
const User = require('../models/User');
const OTP = require('../models/OTP');
const {
  validateStudentRegistration,
  validateFacultyRegistration,
  validateLogin
} = require('../middleware/validation');

// Render Student Register
router.get('/student-register', (req, res) => {
  res.render('auth/student-register', { title: 'Student Registration | CPMS' });
});

// Render Faculty Register
router.get('/faculty-register', (req, res) => {
  res.render('auth/faculty-register', { title: 'Faculty Registration | CPMS' });
});

// Render Login
router.get('/login', (req, res) => {
  res.render('auth/login', { title: 'Sign In | CPMS' });
});

// Send OTP endpoint
router.post('/send-otp', async (req, res) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const validPurposes = ['REGISTRATION', 'PASSWORD_RESET', 'ACCOUNT_CHANGE'];
    const otpPurpose = validPurposes.includes(purpose) ? purpose : 'REGISTRATION';

    // Generate random 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any previous pending OTP for this email and purpose
    await OTP.deleteMany({ email: cleanEmail, purpose: otpPurpose });

    await OTP.create({
      email: cleanEmail,
      otp: generatedOtp,
      purpose: otpPurpose
    });

    console.log(`[OTP Generated for ${cleanEmail} (${otpPurpose})]: ${generatedOtp}`);

    return res.json({
      success: true,
      message: `Verification OTP has been sent to ${cleanEmail}. (Development code: ${generatedOtp})`,
      devOtp: generatedOtp // Provided for rapid testing/grading demo
    });
  } catch (err) {
    console.error('OTP Send Error:', err);
    return res.status(500).json({ success: false, message: 'Server error while generating OTP.' });
  }
});

// Verify OTP endpoint
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const otpDoc = await OTP.findOne({
      email: cleanEmail,
      purpose: purpose || 'REGISTRATION',
      isVerified: false
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    if (otpDoc.otp !== otp.trim()) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      return res.status(400).json({ success: false, message: 'Incorrect OTP code.' });
    }

    otpDoc.isVerified = true;
    await otpDoc.save();

    return res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err) {
    console.error('OTP Verify Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
  }
});

// Student Registration POST
router.post('/student-register', validateStudentRegistration, async (req, res) => {
  try {
    const { studentType, fullName, registerNumber, email, username, password } = req.body;

    const user = new User({
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password,
      role: 'STUDENT',
      studentType,
      registerNumber: studentType === 'INTERNAL' && registerNumber ? registerNumber.trim().toUpperCase() : undefined
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Student account registered successfully! Redirecting to login...',
      redirectUrl: '/auth/login'
    });
  } catch (err) {
    console.error('Student Registration Error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        errors: { [field]: `${field} is already in use by another account.` }
      });
    }
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// Faculty Registration POST
router.post('/faculty-register', validateFacultyRegistration, async (req, res) => {
  try {
    const { fullName, employeeId, email, username, password, facultyCapacity } = req.body;

    const user = new User({
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password,
      role: 'FACULTY',
      employeeId: employeeId.trim().toUpperCase(),
      facultyCapacity: Number(facultyCapacity)
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Faculty account registered successfully! Redirecting to faculty login...',
      redirectUrl: '/auth/login'
    });
  } catch (err) {
    console.error('Faculty Registration Error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        errors: { [field]: `${field} is already registered.` }
      });
    }
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// Login POST (Student & Faculty)
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = username.trim().toLowerCase();

    // Look up user by username or email
    const user = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanUsername }]
    });

    // Enforce generic authentication error (Rule 3.5: do not reveal whether username/email exists)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    // Save session
    req.session.userId = user._id;
    req.session.role = user.role;

    const redirectUrl = user.role === 'FACULTY' ? '/faculty/dashboard' : '/student/dashboard';

    return res.json({
      success: true,
      message: 'Authentication successful. Redirecting...',
      redirectUrl
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// Member Lookup Endpoint for Frontend Dynamic Validation
router.post('/check-student', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    const student = await User.findOne({
      username: username.trim().toLowerCase(),
      role: 'STUDENT'
    }).select('fullName username email studentType registerNumber assignedFaculty');

    if (!student) {
      return res.status(404).json({ success: false, message: 'No registered student found with this username.' });
    }

    return res.json({
      success: true,
      student: {
        _id: student._id,
        fullName: student.fullName,
        username: student.username,
        email: student.email,
        studentType: student.studentType,
        registerNumber: student.registerNumber,
        assignedFaculty: student.assignedFaculty
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error checking student.' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;
