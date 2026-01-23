const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const { requireAuth, validateTenantConsistency } = require('./middleware/auth');
const { validateApiKey } = require('./middleware/apiKey');
const { validateBearerToken } = require('./middleware/bearerToken');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { success: false, error: 'Too many requests' }
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
    
    // Create tenant first
    const tenantId = require('uuid').v4();
    
    await require('./database/connection').query(
      'INSERT INTO tenants (id, name, status) VALUES (?, ?, "active")',
      [tenantId, companyName]
    );
    
    // Create admin user
    const userId = await require('./services/authService').createUser(tenantId, {
      email,
      password,
      firstName,
      lastName,
      role: 'admin'
    });
    
    res.status(201).json({
      success: true,
      message: 'Company and admin user created successfully',
      data: { userId, tenantId, companyName }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Token management routes (JWT protected)
app.use('/api/api-keys', requireAuth, validateTenantConsistency, require('./routes/api-keys'));
app.use('/api/bearer-tokens', requireAuth, validateTenantConsistency, require('./routes/bearer-tokens'));

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
    return validateTenantConsistency(req, res, next);
  }
  next();
});

app.use('/api/users', require('./routes/users'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/items', require('./routes/items'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/warehouses', require('./routes/warehouses'));
app.use('/api/warehouse-types', require('./routes/warehouse-types'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/purchase-orders', require('./routes/purchase-orders'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/sales-orders', require('./routes/sales-orders'));
app.use('/api/grn', require('./routes/grn'));
app.use('/api/reorder-levels', require('./routes/reorder-levels'));
app.use('/api/settings', require('./routes/settings'));

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