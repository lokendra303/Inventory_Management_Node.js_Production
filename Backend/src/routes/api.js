const express = require('express');
const { requireAuth, validateTenantConsistency } = require('../middleware/auth');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Public routes (no authentication required)
router.use('/auth', require('./auth'));

// Protected routes (authentication required)
router.use(requireAuth);
router.use(validateTenantConsistency);

// Resource routes
router.use('/users', require('./users'));
router.use('/roles', require('./roles'));
router.use('/items', require('./items'));
router.use('/dropdown-options', require('./dropdown-options'));
router.use('/categories', require('./categories'));
router.use('/warehouses', require('./warehouses'));
router.use('/warehouse-types', require('./warehouse-types'));
router.use('/inventory', require('./inventory'));
router.use('/purchase-orders', require('./purchase-orders'));
router.use('/vendors', require('./vendors'));
router.use('/sales-orders', require('./sales-orders'));
router.use('/grn', require('./grn'));
router.use('/reorder-levels', require('./reorder-levels'));
router.use('/reports', require('./reports'));
router.use('/settings', require('./settings'));

// Error handling middleware
router.use((error, req, res, next) => {
  const logger = require('../utils/logger');
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    tenantId: req.tenantId,
    userId: req.user?.userId
  });

  res.status(error.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
  });
});

// 404 handler
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

module.exports = router;