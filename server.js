require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'cpms_dev_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collaborative_pms',
      collectionName: 'sessions',
      ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      httpOnly: true
    }
  })
);

// Global user state in views
const User = require('./models/User');
app.use(async (req, res, next) => {
  res.locals.currentUser = null;
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).select('-password');
      if (user) {
        req.user = user;
        res.locals.currentUser = user;
      }
    } catch (err) {
      console.error('Session user attach error:', err);
    }
  }
  next();
});

// Mount Routes
app.use('/auth', require('./routes/authRoutes'));
app.use('/student', require('./routes/studentRoutes'));
app.use('/faculty', require('./routes/facultyRoutes'));
app.use('/project', require('./routes/projectRoutes'));

// Root route: Front Landing Page
app.get('/', (req, res) => {
  res.render('home', {
    title: 'CPMS | Collaborative Academic Project Management System',
    fullWidth: true
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Page Not Found',
    message: 'The requested resource or page was not found on this system.'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
  res.status(500).render('error', {
    title: '500 - Server Error',
    message: 'An unexpected internal error occurred. Please try again.'
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` CPMS Server running on http://localhost:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` MongoDB: ${process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collaborative_pms'}`);
  console.log(`====================================================`);
});

module.exports = app;
