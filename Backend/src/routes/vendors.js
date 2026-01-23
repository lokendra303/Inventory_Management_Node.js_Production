const express = require('express');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { requirePermission, validateTenantConsistency, auditLog } = require('../middleware/auth');

const router = express.Router();

// GET /api/vendors
router.get('/',
  requirePermission('vendor_view'),
  purchaseOrderController.getVendors
);

// POST /api/vendors
router.post('/',
  requirePermission('vendor_management'),
  validateTenantConsistency,
  auditLog('vendor_created'),
  purchaseOrderController.createVendor
);

// GET /api/vendors/:id
router.get('/:id',
  requirePermission('vendor_view'),
  purchaseOrderController.getVendor
);

// PUT /api/vendors/:id
router.put('/:id',
  requirePermission('vendor_management'),
  validateTenantConsistency,
  auditLog('vendor_updated'),
  purchaseOrderController.updateVendor
);

// GET /api/vendors/:id/performance
router.get('/:id/performance',
  requirePermission('vendor_view'),
  purchaseOrderController.getVendorPerformance
);

module.exports = router;