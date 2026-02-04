const express = require('express');
const salesInvoiceController = require('../controllers/salesInvoiceController');
const { requirePermission, validateInstitutionConsistency, auditLog } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validation');

const router = express.Router();

// GET /api/sales-invoices
router.get('/',
  requirePermission('invoice_view'),
  salesInvoiceController.getSalesInvoices
);

// POST /api/sales-invoices
router.post('/',
  validate(schemas.createSalesInvoiceSchema),
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('sales_invoice_created'),
  salesInvoiceController.createSalesInvoice
);

// GET /api/sales-invoices/:id
router.get('/:id',
  requirePermission('invoice_view'),
  salesInvoiceController.getSalesInvoice
);

// PUT /api/sales-invoices/:id/status
router.put('/:id/status',
  validate(schemas.updateInvoiceStatusSchema),
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('sales_invoice_status_updated'),
  salesInvoiceController.updateInvoiceStatus
);

// POST /api/sales-invoices/:id/post
router.post('/:id/post',
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('sales_invoice_posted'),
  salesInvoiceController.postSalesInvoice
);

// POST /api/sales-invoices/:id/payments
router.post('/:id/payments',
  validate(schemas.createInvoicePaymentSchema),
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('sales_invoice_payment_added'),
  salesInvoiceController.addPayment
);

// GET /api/sales-invoices/analytics/summary
router.get('/analytics/summary',
  requirePermission('invoice_view'),
  salesInvoiceController.getInvoiceAnalytics
);

module.exports = router;