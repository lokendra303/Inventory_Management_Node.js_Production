const express = require('express');
const purchaseInvoiceController = require('./purchaseInvoice.controller');
const { requirePermission, validateInstitutionConsistency, auditLog } = require('../auth/auth.middleware');
const { validate, schemas } = require('../../utils/validation');

const router = express.Router();

// Specific routes MUST come before parameterized routes
// POST /api/purchase-invoices/generate-from-grn/:grnId
router.post('/generate-from-grn/:grnId',
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('invoice_generated_from_grn'),
  purchaseInvoiceController.generateInvoiceFromGRN
);

// POST /api/purchase-invoices/generate-from-po/:poId
router.post('/generate-from-po/:poId',
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('invoice_auto_generated'),
  purchaseInvoiceController.generateInvoiceFromPO
);

// GET /api/purchase-invoices/items/list
router.get('/items/list',
  purchaseInvoiceController.getItemsList
);

// GET /api/purchase-invoices/vendors/list
router.get('/vendors/list',
  requirePermission('invoice_view'),
  purchaseInvoiceController.getVendorList
);

// GET /api/purchase-invoices/vendors/:vendorId/details
router.get('/vendors/:vendorId/details',
  requirePermission('invoice_view'),
  purchaseInvoiceController.getVendorDetailsForInvoice
);

// GET /api/purchase-invoices/matching/three-way
router.get('/matching/three-way',
  requirePermission('invoice_view'),
  purchaseInvoiceController.getThreeWayMatching
);

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

// PUT /api/purchase-invoices/:id
router.put('/:id',
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('purchase_invoice_updated'),
  purchaseInvoiceController.updatePurchaseInvoice
);

// GET /api/purchase-invoices/:id/pdf
router.get('/:id/pdf',
  requirePermission('invoice_view'),
  purchaseInvoiceController.generateInvoicePDF
);

// GET /api/purchase-invoices/:id/standard-format
router.get('/:id/standard-format',
  requirePermission('invoice_view'),
  purchaseInvoiceController.getStandardInvoiceFormat
);

// POST /api/purchase-invoices/:id/email
router.post('/:id/email',
  requirePermission('invoice_view'),
  auditLog('purchase_invoice_emailed'),
  purchaseInvoiceController.emailInvoice
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

module.exports = router;