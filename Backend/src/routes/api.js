const express = require('express');
const { requireAuth, validateInstitutionConsistency } = require('../middleware/auth');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Public routes (no authentication required)
router.use('/auth', require('./auth/auth'));

// Protected routes (authentication required)
router.use(requireAuth);
router.use(validateInstitutionConsistency);

// Resource routes
router.use('/users', require('./auth/users'));
router.use('/roles', require('./auth/roles'));
router.use('/items', require('./entity/items'));
router.use('/manufacturers', require('./entity/manufacturers'));
router.use('/brands', require('./entity/brands'));
router.use('/units', require('./master-data/units'));
router.use('/dropdown-options', require('./master-data/dropdown-options'));
router.use('/categories', require('./entity/categories'));
router.use('/warehouses', require('./warehouse/warehouses'));
router.use('/warehouse-types', require('./warehouse/warehouse-types'));
router.use('/inventory', require('./inventory/inventory'));
router.use('/purchase-orders', require('./order/purchase-orders'));
router.use('/vendors', require('./entity/vendors'));
router.use('/customers', require('./entity/customers'));
router.use('/sales-orders', require('./order/sales-orders'));
router.use('/invoices', require('./invoice/invoices'));
router.use('/purchase-invoices', require('./invoice/purchase-invoices'));
router.use('/sales-invoices', require('./invoice/sales-invoices'));
router.use('/grn', require('./order/grn'));
router.use('/reorder-levels', require('./inventory/reorder-levels'));
router.use('/batch-serial', require('./inventory/batch-serial'));
router.use('/inventory', require('./inventory/batch-serial'));
router.use('/stock-counts', require('./inventory/stock-counts'));
router.use('/purchase-returns', require('./order/purchase-returns'));
router.use('/data', require('./master-data/all-data'));
router.use('/reports', require('./reports/reports'));
router.use('/profit-loss', require('./reports/profit-loss'));
router.use('/settings', require('./settings/settings'));
router.use('/company-settings', require('./settings/company-settings'));
router.use('/documents', require('./documents/documents'));
router.use('/delivery-challans', require('./order/delivery-challans'));
router.use('/transfer-approvals', require('./inventory/transfer-approvals'));
router.use('/analytics', require('./reports/analytics'));
router.use('/notifications', require('./notification/notifications'));
router.use('/audit', require('./audit/audit'));

// Error handling middleware
router.use((error, req, res, next) => {
  const logger = require('../utils/logger');
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    institutionId: req.institutionId,
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