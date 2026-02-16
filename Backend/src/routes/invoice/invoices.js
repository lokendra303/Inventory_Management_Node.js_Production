const express = require('express');
const invoiceDashboardController = require('../../controllers/invoice/invoiceDashboardController');
const { requirePermission } = require('../../middleware/auth');

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