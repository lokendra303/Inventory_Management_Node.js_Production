const express = require('express');
const thirdPartyInvoiceController = require('./thirdPartyInvoice.controller');
const { requirePermission, requireRole, validateInstitutionConsistency, auditLog } = require('../auth/auth.middleware');
const { validate, schemas } = require('../../utils/validation');

const router = express.Router();

router.get('/customers/:customerId/details',
  requirePermission('invoice_view'),
  thirdPartyInvoiceController.getCustomerDetailsForInvoice
);

router.get('/customers/list',
  requirePermission('invoice_view'),
  thirdPartyInvoiceController.getCustomersList
);

router.get('/vendors/:vendorId/details',
  requirePermission('invoice_view'),
  thirdPartyInvoiceController.getVendorDetailsForInvoice
);

router.get('/vendors/list',
  requirePermission('invoice_view'),
  thirdPartyInvoiceController.getVendorsList
);

router.get('/',
  requirePermission('invoice_view'),
  thirdPartyInvoiceController.getThirdPartyInvoices
);

router.post('/',
  validate(schemas.createThirdPartyInvoiceSchema),
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('third_party_invoice_created'),
  thirdPartyInvoiceController.createThirdPartyInvoice
);

router.get('/:id',
  requirePermission('invoice_view'),
  thirdPartyInvoiceController.getThirdPartyInvoice
);

router.put('/:id',
  validate(schemas.createThirdPartyInvoiceSchema),
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('third_party_invoice_updated'),
  thirdPartyInvoiceController.updateThirdPartyInvoice
);

router.put('/:id/status',
  validate(schemas.updateThirdPartyInvoiceStatusSchema),
  requirePermission('invoice_management'),
  validateInstitutionConsistency,
  auditLog('third_party_invoice_status_updated'),
  thirdPartyInvoiceController.updateInvoiceStatus
);

router.get('/:id/pdf',
  requirePermission('invoice_view'),
  thirdPartyInvoiceController.generateInvoicePDF
);

// Deletion is restricted to the company super admin (institution owner) only.
router.delete('/:id',
  requireRole('super_admin'),
  validateInstitutionConsistency,
  auditLog('third_party_invoice_deleted'),
  thirdPartyInvoiceController.deleteThirdPartyInvoice
);

module.exports = router;
