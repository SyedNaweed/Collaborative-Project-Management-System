const User = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const OTP = require('../models/OTP');

// Utility to test email format
const isValidEmailFormat = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// 1. Student Registration Validation
const validateStudentRegistration = async (req, res, next) => {
  const { studentType, fullName, registerNumber, email, username, password, confirmPassword, otp } = req.body;
  const errors = {};

  // Validate student type
  if (!studentType || !['INTERNAL', 'EXTERNAL'].includes(studentType)) {
    errors.studentType = 'Please select a valid student type (Internal or External).';
  }

  // Full name
  if (!fullName || !fullName.trim()) {
    errors.fullName = 'Full name is required.';
  }

  // Username: alphabetic letters only, no numbers or special characters
  if (!username || !username.trim()) {
    errors.username = 'Username is required.';
  } else if (username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters.';
  } else if (!/^[a-zA-Z]+$/.test(username.trim())) {
    errors.username = 'Username must contain only alphabetic letters (no numbers or special characters allowed).';
  } else {
    const existingUser = await User.findOne({ username: username.trim().toLowerCase() });
    if (existingUser) {
      errors.username = 'Username is already taken.';
    }
  }

  // Email format & domain checks
  if (!email || !email.trim()) {
    errors.email = 'Email address is required.';
  } else {
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmailFormat(cleanEmail)) {
      errors.email = 'Please provide a valid email format.';
    } else {
      if (studentType === 'INTERNAL') {
        if (!cleanEmail.endsWith('@vitstudent.ac.in')) {
          errors.email = 'Internal students must use a valid VIT student email ending with @vitstudent.ac.in.';
        }
      } else if (studentType === 'EXTERNAL') {
        if (cleanEmail.endsWith('@vitstudent.ac.in') || cleanEmail.endsWith('@vit.ac.in')) {
          errors.email = 'External students must not use VIT institution emails (@vitstudent.ac.in or @vit.ac.in).';
        }
      }

      // Duplicate email check
      const existingEmail = await User.findOne({ email: cleanEmail });
      if (existingEmail) {
        errors.email = 'Email is already registered.';
      }
    }
  }

  // Register Number conditional validation: 2 numbers, 3 alphabets, 4 numbers
  if (studentType === 'INTERNAL') {
    if (!registerNumber || !registerNumber.trim()) {
      errors.registerNumber = 'Register Number is mandatory for Internal students.';
    } else {
      const cleanRegNo = registerNumber.trim().toUpperCase();
      const regNoRegex = /^[0-9]{2}[A-Z]{3}[0-9]{4}$/;
      if (!regNoRegex.test(cleanRegNo)) {
        errors.registerNumber = 'Register Number must follow the format: 2 numbers, 3 alphabets, and 4 numbers (e.g. 22BIT0061).';
      } else {
        const existingReg = await User.findOne({ registerNumber: cleanRegNo });
        if (existingReg) {
          errors.registerNumber = 'Register Number is already registered.';
        }
      }
    }
  }

  // Password & confirm password
  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  // OTP Verification
  if (!otp || !otp.trim()) {
    errors.otp = 'Email verification OTP is required.';
  } else {
    const otpDoc = await OTP.findOne({
      email: email ? email.trim().toLowerCase() : '',
      purpose: 'REGISTRATION',
      isVerified: true
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      // Allow fallback if user submits current valid OTP in the request
      const pendingOtp = await OTP.findOne({
        email: email ? email.trim().toLowerCase() : '',
        otp: otp.trim(),
        purpose: 'REGISTRATION'
      }).sort({ createdAt: -1 });

      if (!pendingOtp) {
        errors.otp = 'Invalid or expired OTP.';
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
};

// 2. Faculty Registration Validation
const validateFacultyRegistration = async (req, res, next) => {
  const { fullName, employeeId, email, username, password, confirmPassword, facultyCapacity } = req.body;
  const errors = {};

  if (!fullName || !fullName.trim()) {
    errors.fullName = 'Faculty name is required.';
  }

  if (!employeeId || !employeeId.trim()) {
    errors.employeeId = 'Employee ID is required.';
  } else {
    const existingEmp = await User.findOne({ employeeId: employeeId.trim().toUpperCase() });
    if (existingEmp) {
      errors.employeeId = 'Employee ID is already registered.';
    }
  }

  if (!username || !username.trim()) {
    errors.username = 'Username is required.';
  } else if (username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters.';
  } else if (!/^[a-zA-Z]+$/.test(username.trim())) {
    errors.username = 'Username must contain only alphabetic letters (no numbers or special characters allowed).';
  } else {
    const existingUser = await User.findOne({ username: username.trim().toLowerCase() });
    if (existingUser) {
      errors.username = 'Username is already taken.';
    }
  }

  if (!email || !email.trim()) {
    errors.email = 'VIT faculty email is required.';
  } else {
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmailFormat(cleanEmail)) {
      errors.email = 'Please provide a valid email format.';
    } else if (!cleanEmail.endsWith('@vit.ac.in')) {
      errors.email = 'Faculty email must end with @vit.ac.in.';
    } else {
      const existingEmail = await User.findOne({ email: cleanEmail });
      if (existingEmail) {
        errors.email = 'Email is already registered.';
      }
    }
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  const capacityNum = Number(facultyCapacity);
  if (facultyCapacity === undefined || facultyCapacity === null || facultyCapacity === '' || isNaN(capacityNum)) {
    errors.facultyCapacity = 'Team-handling capacity must be a valid number.';
  } else if (!Number.isInteger(capacityNum) || capacityNum < 2 || capacityNum > 7) {
    errors.facultyCapacity = 'Team-handling capacity must be an integer between 2 and 7 inclusive.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
};

// 3. Login Validation
const validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  const errors = {};

  if (!username || !username.trim()) {
    errors.username = 'Username is required.';
  }
  if (!password || !password.trim()) {
    errors.password = 'Password is required.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
};

// 4. Team Creation Validation (with Mixed Team Collaboration Checkbox)
const validateTeamCreation = async (req, res, next) => {
  const { name, facultyId, memberUsernames, collaborationConfirmed } = req.body;
  const errors = {};
  const creator = req.user;

  if (!creator) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  // Team Name
  if (!name || !name.trim()) {
    errors.name = 'Team name is required.';
  }

  // Faculty verification
  if (!facultyId) {
    errors.facultyId = 'Faculty selection is required.';
  }

  const faculty = await User.findOne({ _id: facultyId, role: 'FACULTY' });
  if (!faculty) {
    errors.facultyId = 'Selected faculty is not registered or valid.';
  } else {
    // Check faculty capacity
    const activeTeamsCount = await Team.countDocuments({ faculty: faculty._id, isActive: true });
    if (activeTeamsCount >= faculty.facultyCapacity) {
      errors.facultyId = `Faculty ${faculty.fullName} has reached maximum team capacity (${faculty.facultyCapacity}).`;
    }

    // Check case-insensitive team name uniqueness under this faculty
    if (name && name.trim()) {
      const normalized = name.trim().toLowerCase();
      const existingTeam = await Team.findOne({ faculty: faculty._id, normalizedName: normalized });
      if (existingTeam) {
        errors.name = `A team named "${name.trim()}" already exists under Faculty ${faculty.fullName}.`;
      }
    }
  }

  // Member array construction (creator is always member)
  const submittedUsernames = Array.isArray(memberUsernames)
    ? memberUsernames.map((u) => u.trim().toLowerCase()).filter(Boolean)
    : typeof memberUsernames === 'string'
    ? memberUsernames.split(',').map((u) => u.trim().toLowerCase()).filter(Boolean)
    : [];

  const allUsernames = Array.from(new Set([creator.username.toLowerCase(), ...submittedUsernames]));

  // Bounds: 1 to 9 members
  if (allUsernames.length < 1 || allUsernames.length > 9) {
    errors.members = 'Team size must be between 1 and 9 students (including team creator).';
  }

  // Fetch all members from database
  const memberUsers = await User.find({ username: { $in: allUsernames }, role: 'STUDENT' });

  if (memberUsers.length !== allUsernames.length) {
    const foundUsernames = memberUsers.map((u) => u.username.toLowerCase());
    const missing = allUsernames.filter((u) => !foundUsernames.includes(u));
    errors.members = `The following member usernames are not registered students: ${missing.join(', ')}`;
  }

  // Verify each member is registered under this faculty and not already in an active team
  if (faculty && memberUsers.length === allUsernames.length) {
    for (const member of memberUsers) {
      // Must be registered under the same faculty
      if (member.assignedFaculty && member.assignedFaculty.toString() !== faculty._id.toString()) {
        errors.members = `Member ${member.username} is assigned to a different faculty.`;
        break;
      }

      // Check if student is already in an active team under this faculty
      const existingActiveMembership = await Team.findOne({
        faculty: faculty._id,
        isActive: true,
        'members.student': member._id,
        'members.status': 'ACTIVE'
      });

      if (existingActiveMembership) {
        errors.members = `Student ${member.username} is already an active member of team "${existingActiveMembership.name}" under this faculty.`;
        break;
      }
    }

    // Determine student types from stored database profile
    const hasInternal = memberUsers.some((u) => u.studentType === 'INTERNAL');
    const hasExternal = memberUsers.some((u) => u.studentType === 'EXTERNAL');
    const isMixed = hasInternal && hasExternal;

    // Mixed team mandatory collaboration checkbox validation
    if (isMixed) {
      const isConfirmed =
        collaborationConfirmed === true ||
        collaborationConfirmed === 'true' ||
        collaborationConfirmed === 'on' ||
        collaborationConfirmed === 1;

      if (!isConfirmed) {
        errors.collaborationConfirmed =
          'This team contains both Internal and External students. You must confirm the declaration: "This team is a collaboration between Internal and External students."';
      }
    }

    req.teamData = {
      name: name ? name.trim() : '',
      faculty: faculty._id,
      creator: creator._id,
      members: memberUsers.map((u) => ({
        student: u._id,
        studentType: u.studentType,
        status: 'ACTIVE'
      })),
      isMixedTeam: isMixed,
      collaborationConfirmed: isMixed ? true : false
    };
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
};

// 5. Project Proposal Validation
const validateProjectProposal = async (req, res, next) => {
  const { title, description, teamId } = req.body;
  const errors = {};

  if (!title || !title.trim()) {
    errors.title = 'Project title is required.';
  }
  if (!description || !description.trim()) {
    errors.description = 'Project description is required.';
  }
  if (!teamId) {
    errors.teamId = 'Team identifier is required.';
  } else {
    const team = await Team.findById(teamId).populate('currentProject');
    if (!team) {
      errors.teamId = 'Team not found.';
    } else if (team.currentProject && !['COMPLETED', 'REJECTED'].includes(team.currentProject.status)) {
      errors.teamId = `Team already has an ongoing project ("${team.currentProject.title}") with status "${team.currentProject.status}". A new project cannot be proposed until the current project is completed.`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
};

module.exports = {
  validateStudentRegistration,
  validateFacultyRegistration,
  validateLogin,
  validateTeamCreation,
  validateProjectProposal
};
