const express = require('express');
const purchaseInvoiceController = require('../controllers/purchaseInvoiceController');
const { requirePermission, validateInstitutionConsistency, auditLog } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validation');

const router = express.Router();

// GET /api/purchase-invoices
router.get('/',
  requirePermission('invoice_view'),
  purchaseInvoiceController.getPurchaseInvoices
);

// POST /api/purchase-invoices
router.post('/',
  validate(schemas.createPurchaseInvoiceSchema),
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('purchase_invoice_created'),
  purchaseInvoiceController.createPurchaseInvoice
);

// GET /api/purchase-invoices/:id
router.get('/:id',
  requirePermission('invoice_view'),
  purchaseInvoiceController.getPurchaseInvoice
);

// PUT /api/purchase-invoices/:id/status
router.put('/:id/status',
  validate(schemas.updateInvoiceStatusSchema),
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('purchase_invoice_status_updated'),
  purchaseInvoiceController.updateInvoiceStatus
);

// POST /api/purchase-invoices/:id/post
router.post('/:id/post',
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('purchase_invoice_posted'),
  purchaseInvoiceController.postPurchaseInvoice
);

// POST /api/purchase-invoices/:id/payments
router.post('/:id/payments',
  validate(schemas.createInvoicePaymentSchema),
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('purchase_invoice_payment_added'),
  purchaseInvoiceController.addPayment
);

// GET /api/purchase-invoices/matching/three-way
router.get('/matching/three-way',
  requirePermission('invoice_view'),
  purchaseInvoiceController.getThreeWayMatching
);

module.exports = router;