const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const { extractInstitutionContext, validateInstitutionConsistency } = require('./middleware/auth');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// Skip extractInstitutionContext for all /auth routes
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth')) return next();
  extractInstitutionContext(req, res, next);
});

app.use('/api', require('./routes/api'));

app.use((error, req, res, next) => {
  logger.error('API Error', { error: error.message, path: req.path, method: req.method });
  res.status(error.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
  });
});

app.use('*', (req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

module.exports = app;
