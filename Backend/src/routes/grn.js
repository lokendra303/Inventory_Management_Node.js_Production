const express = require('express');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { requirePermission, validateTenantConsistency, auditLog } = require('../middleware/auth');

const router = express.Router();

// GET /api/grn/pending-receipts
router.get('/pending-receipts',
  requirePermission('inventory_view'),
  purchaseOrderController.getPendingReceipts
);

// POST /api/grn
router.post('/',
  requirePermission('inventory_receive'),
  validateTenantConsistency,
  auditLog('grn_created'),
  purchaseOrderController.createGRN
);

// GET /api/grn/:id
router.get('/:id',
  requirePermission('inventory_view'),
  purchaseOrderController.getGRN
);

module.exports = router;