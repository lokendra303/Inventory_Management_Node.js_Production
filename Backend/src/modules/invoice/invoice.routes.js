const express = require('express');
const invoiceDashboardController = require('./invoiceDashboard.controller');
const { requirePermission } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/invoices/dashboard/summary
router.get('/dashboard/summary',
  requirePermission('invoice_view'),
  invoiceDashboardController.getDashboardSummary
);

// GET /api/invoices/dashboard/outstanding
router.get('/dashboard/outstanding',
  requirePermission('invoice_view'),
  invoiceDashboardController.getOutstandingSummary
);

module.exports = router;