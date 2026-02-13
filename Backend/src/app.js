const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const { requireAuth, validateInstitutionConsistency } = require('./middleware/auth');
const { validateApiKey } = require('./middleware/apiKey');
const { validateBearerToken } = require('./middleware/bearerToken');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, error: 'Too many requests' }
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files for uploads (BEFORE authentication)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', require('./routes/auth'));

// Public user registration
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName } = req.body;
    
    // Create institution using new service
    const { institutionId, userId } = await require('./services/authService').createInstitution({
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

// Token management routes (JWT protected)
app.use('/api/api-keys', requireAuth, validateInstitutionConsistency, require('./routes/api-keys'));
app.use('/api/bearer-tokens', requireAuth, validateInstitutionConsistency, require('./routes/bearer-tokens'));

// Protected routes (JWT, API Key, or Bearer Token)
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];
  
  if (apiKey) {
    return validateApiKey(req, res, next);
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Check if it's a JWT (contains dots) or random Bearer token
    if (token.includes('.')) {
      return requireAuth(req, res, next);
    } else {
      return validateBearerToken(req, res, next);
    }
  } else {
    return requireAuth(req, res, next);
  }
};

app.use('/api', authMiddleware);
app.use('/api', (req, res, next) => {
  if (!req.apiKey && !req.bearerToken) {
    return validateInstitutionConsistency(req, res, next);
  }
  next();
});

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