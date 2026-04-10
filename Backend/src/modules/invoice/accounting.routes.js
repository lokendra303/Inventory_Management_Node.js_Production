const express = require('express');
const accountingController = require('./accounting.controller');
const { requirePermission } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/accounting/summary
router.get('/summary',
  requirePermission('invoice_view'),
  accountingController.getAccountingSummary
);

// GET /api/accounting/chart-of-accounts
router.get('/chart-of-accounts',
  requirePermission('invoice_view'),
  accountingController.getChartOfAccounts
);

// GET /api/accounting/trial-balance
router.get('/trial-balance',
  requirePermission('invoice_view'),
  accountingController.getTrialBalance
);

// GET /api/accounting/journal-entries
router.get('/journal-entries',
  requirePermission('invoice_view'),
  accountingController.getJournalEntries
);

// GET /api/accounting/payables
router.get('/payables',
  requirePermission('invoice_view'),
  accountingController.getVendorPayables
);

// GET /api/accounting/receivables
router.get('/receivables',
  requirePermission('invoice_view'),
  accountingController.getCustomerReceivables
);

// GET /api/accounting/ledger/:accountCode
router.get('/ledger/:accountCode',
  requirePermission('invoice_view'),
  accountingController.getAccountLedger
);

module.exports = router;
