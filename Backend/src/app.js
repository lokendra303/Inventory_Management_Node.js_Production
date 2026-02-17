const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const { extractInstitutionContext, validateInstitutionConsistency } = require('./middleware/auth');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());

// Rate limiting with better configuration
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { 
    success: false, 
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks and static files
    return req.path === '/health' || req.path.startsWith('/uploads/');
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
    });
  }
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploads (BEFORE authentication)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', require('./routes/auth/auth'));

// Public user registration
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName } = req.body;
    
    // Create institution using new service
    const { institutionId, userId } = await require('./services/auth/authService').createInstitution({
      name: companyName,
      email: `admin@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      adminEmail: email,
      adminPassword: password,
      adminFirstName: firstName,
      adminLastName: lastName
    });
    
    res.status(201).json({
      success: true,
      message: 'Company and admin user created successfully',
      data: { userId, institutionId, companyName }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Service account management routes (JWT protected)
app.use('/api/service-accounts', extractInstitutionContext, validateInstitutionConsistency, require('./routes/auth/service-accounts'));

// All protected routes now use JWT only (user or service account)
app.use('/api', extractInstitutionContext);
app.use('/api', validateInstitutionConsistency);

// Use the centralized API router
app.use('/api', require('./routes/api'));

// Error handling
app.use((error, req, res, next) => {
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  res.status(error.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

module.exports = app;