const User = require('../models/User');

const isAuthenticated = async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).select('-password');
      if (user) {
        req.user = user;
        res.locals.currentUser = user;
        return next();
      }
    } catch (err) {
      console.error('Session user fetch error:', err);
    }
  }

  // Check if API or browser request
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/auth/login');
};

const isStudent = (req, res, next) => {
  if (req.user && req.user.role === 'STUDENT') {
    return next();
  }
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(403).json({ success: false, message: 'Forbidden. Student role required.' });
  }
  res.status(403).render('error', { title: 'Access Denied', message: 'Student role required.' });
};

const isFaculty = (req, res, next) => {
  if (req.user && req.user.role === 'FACULTY') {
    return next();
  }
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(403).json({ success: false, message: 'Forbidden. Faculty role required.' });
  }
  res.status(403).render('error', { title: 'Access Denied', message: 'Faculty role required.' });
};

module.exports = {
  isAuthenticated,
  isStudent,
  isFaculty
};
