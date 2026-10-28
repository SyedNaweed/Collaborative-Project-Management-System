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
    const { email, purpose, studentType } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Validate student-type domain rules before dispatching OTP
    if (studentType === 'INTERNAL') {
      if (!cleanEmail.endsWith('@vitstudent.ac.in')) {
        return res.status(400).json({
          success: false,
          message: 'Internal students must use an institutional email ending with @vitstudent.ac.in.'
        });
      }
    } else if (studentType === 'EXTERNAL') {
      if (cleanEmail.endsWith('@vitstudent.ac.in') || cleanEmail.endsWith('@vit.ac.in')) {
        return res.status(400).json({
          success: false,
          message: 'External students must use personal email. Institutional VIT emails are not allowed.'
        });
      }
    }

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
      devOtp: generatedOtp
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

// Render Forgot Password
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password | CPMS' });
});

// Forgot Password Send OTP
router.post('/forgot-password/send-otp', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    const user = await User.findOne({ username: username.trim().toLowerCase() });
    // Safe generic message if not found (Rule 5.3: reject invalid recovery requests with appropriate generic error)
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or incomplete recovery request.' });
    }

    const cleanEmail = user.email;
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.deleteMany({ email: cleanEmail, purpose: 'PASSWORD_RESET' });
    await OTP.create({
      email: cleanEmail,
      otp: generatedOtp,
      purpose: 'PASSWORD_RESET'
    });

    // Mask email for privacy (e.g. j****@vitstudent.ac.in)
    const [userPart, domainPart] = cleanEmail.split('@');
    const maskedUser = userPart.length > 2 ? userPart[0] + '***' + userPart[userPart.length - 1] : userPart[0] + '***';
    const maskedEmail = `${maskedUser}@${domainPart}`;

    return res.json({
      success: true,
      message: `Password reset OTP generated for ${maskedEmail}.`,
      maskedEmail,
      email: cleanEmail,
      devOtp: generatedOtp
    });
  } catch (err) {
    console.error('Forgot Password Send OTP Error:', err);
    return res.status(500).json({ success: false, message: 'Error processing recovery request.' });
  }
});

// Forgot Password Reset Submit
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { username, otp, newPassword, confirmNewPassword } = req.body;
    const errors = {};

    if (!username) errors.username = 'Username is required.';
    if (!otp) errors.otp = 'OTP is required.';
    if (!newPassword || newPassword.length < 6) errors.newPassword = 'New password must be at least 6 characters.';
    if (newPassword !== confirmNewPassword) errors.confirmNewPassword = 'Passwords do not match.';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid recovery request.' });
    }

    // Verify OTP for PASSWORD_RESET purpose (single-use)
    const otpDoc = await OTP.findOne({
      email: user.email,
      otp: otp.trim(),
      purpose: 'PASSWORD_RESET',
      isVerified: false
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid, expired, or purpose-mismatched OTP.' });
    }

    otpDoc.isVerified = true;
    await otpDoc.save();

    // Update password
    user.password = newPassword;
    await user.save();

    // Delete used OTP
    await OTP.deleteMany({ email: user.email, purpose: 'PASSWORD_RESET' });

    return res.json({
      success: true,
      message: 'Password successfully reset! You can now log in with your updated credentials.'
    });
  } catch (err) {
    console.error('Forgot Password Reset Error:', err);
    return res.status(500).json({ success: false, message: 'Server error resetting password.' });
  }
});

// Render Account Settings
const { isAuthenticated } = require('../middleware/auth');
router.get('/account-settings', isAuthenticated, (req, res) => {
  res.render('auth/account-settings', { title: 'Account Settings | CPMS' });
});

// Change Username POST
router.post('/account-settings/change-username', isAuthenticated, async (req, res) => {
  try {
    const { newUsername, otp } = req.body;
    if (!newUsername || newUsername.trim().length < 3) {
      return res.status(400).json({ success: false, errors: { newUsername: 'Username must be at least 3 characters.' } });
    }
    if (!/^[a-zA-Z]+$/.test(newUsername.trim())) {
      return res.status(400).json({ success: false, errors: { newUsername: 'Username must contain only alphabetic letters (no numbers or special characters).' } });
    }
    const cleanUsername = newUsername.trim().toLowerCase();
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({ success: false, errors: { newUsername: 'Username is already taken.' } });
    }

    // Verify OTP for ACCOUNT_CHANGE
    const otpDoc = await OTP.findOne({
      email: req.user.email,
      otp: otp ? otp.trim() : '',
      purpose: 'ACCOUNT_CHANGE',
      isVerified: false
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP for account change.' });
    }

    otpDoc.isVerified = true;
    await otpDoc.save();

    req.user.username = cleanUsername;
    await req.user.save();
    await OTP.deleteMany({ email: req.user.email, purpose: 'ACCOUNT_CHANGE' });

    return res.json({ success: true, message: `Username successfully updated to @${cleanUsername}!` });
  } catch (err) {
    console.error('Change Username Error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating username.' });
  }
});

// Change Password POST
router.post('/account-settings/change-password', isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword, otp } = req.body;
    if (!currentPassword) return res.status(400).json({ success: false, message: 'Current password is required.' });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'Passwords do not match.' });

    // Validate current password
    const user = await User.findById(req.user._id);
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    // Verify OTP
    const otpDoc = await OTP.findOne({
      email: req.user.email,
      otp: otp ? otp.trim() : '',
      purpose: 'ACCOUNT_CHANGE',
      isVerified: false
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP for account change.' });
    }

    otpDoc.isVerified = true;
    await otpDoc.save();

    user.password = newPassword;
    await user.save();
    await OTP.deleteMany({ email: req.user.email, purpose: 'ACCOUNT_CHANGE' });

    return res.json({ success: true, message: 'Password successfully updated!' });
  } catch (err) {
    console.error('Change Password Error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating password.' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;
