const express = require('express');
const purchaseOrderController = require('../../controllers/order/purchaseOrderController');
const { requirePermission, validateInstitutionConsistency, auditLog } = require('../../middleware/auth');
const { validate, schemas } = require('../../utils/validation');

const router = express.Router();

// GET /api/purchase-orders
router.get('/',
  requirePermission('purchase_view'),
  purchaseOrderController.getPurchaseOrders
);

// POST /api/purchase-orders
router.post('/',
  validate(schemas.createPurchaseOrderSchema),
  requirePermission('purchase_management'),
  validateInstitutionConsistency,
  auditLog('purchase_order_created'),
  purchaseOrderController.createPurchaseOrder
);

// GET /api/purchase-orders/:id
router.get('/:id',
  requirePermission('purchase_view'),
  purchaseOrderController.getPurchaseOrder
);

// PUT /api/purchase-orders/:id
router.put('/:id',
  requirePermission('purchase_management'),
  validateInstitutionConsistency,
  auditLog('purchase_order_updated'),
  purchaseOrderController.updatePurchaseOrder
);

// PUT /api/purchase-orders/:id/status
router.put('/:id/status',
  validate(schemas.updatePOStatusSchema),
  requirePermission('purchase_management'),
  validateInstitutionConsistency,
  auditLog('purchase_order_status_updated'),
  purchaseOrderController.updatePOStatus
);

// POST /api/purchase-orders/:id/confirm - Enhanced confirmation endpoint
router.post('/:id/confirm',
  requirePermission('purchase_management'),
  validateInstitutionConsistency,
  auditLog('purchase_order_confirmed'),
  purchaseOrderController.confirmPurchaseOrder
);

// GET /api/purchase-orders/:id/confirmation-summary
router.get('/:id/confirmation-summary',
  requirePermission('purchase_view'),
  purchaseOrderController.getConfirmationSummary
);

// GET /api/purchase-orders/:id/pdf - Download PO as PDF
router.get('/:id/pdf',
  requirePermission('purchase_view'),
  purchaseOrderController.downloadPOPDF
);

// POST /api/purchase-orders/:id/email - Email PO
router.post('/:id/email',
  requirePermission('purchase_view'),
  purchaseOrderController.emailPurchaseOrder
);

module.exports = router;