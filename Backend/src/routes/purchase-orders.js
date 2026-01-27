const express = require('express');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { requirePermission, validateTenantConsistency, auditLog } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validation');

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
  validateTenantConsistency,
  auditLog('purchase_order_created'),
  purchaseOrderController.createPurchaseOrder
);

// GET /api/purchase-orders/:id
router.get('/:id',
  requirePermission('purchase_view'),
  purchaseOrderController.getPurchaseOrder
);

// PUT /api/purchase-orders/:id/status
router.put('/:id/status',
  validate(schemas.updatePOStatusSchema),
  requirePermission('purchase_management'),
  validateTenantConsistency,
  auditLog('purchase_order_status_updated'),
  purchaseOrderController.updatePOStatus
);

module.exports = router;