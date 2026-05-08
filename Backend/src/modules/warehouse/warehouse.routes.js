const express = require('express');
const warehouseController = require('./warehouse.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');
const { checkLimit } = require('../../middleware/subscriptionGate');

const router = express.Router();
const canReadAccessibleWarehouses = (req, res, next) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  if (user.role === 'admin' || user.role === 'super_admin' || user.permissions?.all) {
    return next();
  }
  if (
    user.permissions?.warehouse_view ||
    user.permissions?.item_management ||
    user.permissions?.item_view ||
    user.permissions?.inventory_view
  ) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: 'Insufficient permissions',
    required: 'warehouse_view or item_management'
  });
};

// GET /api/warehouses
router.get('/',
  requirePermission('warehouse_view'),
  warehouseController.getWarehouses
);

// GET /api/warehouses/accessible
// Minimal list for item/inventory flows where full warehouse module access is not granted.
router.get('/accessible',
  canReadAccessibleWarehouses,
  warehouseController.getAccessibleWarehouses
);

// POST /api/warehouses
router.post('/',
  requirePermission('warehouse_management'),
  checkLimit('warehouses'),
  auditLog('warehouse_created'),
  warehouseController.createWarehouse
);

// GET /api/warehouses/:warehouseId
router.get('/:warehouseId',
  requirePermission('warehouse_view'),
  warehouseController.getWarehouse
);

// PUT /api/warehouses/:warehouseId
router.put('/:warehouseId',
  requirePermission('warehouse_management'),
  checkLimit('warehouses'),
  auditLog('warehouse_updated'),
  warehouseController.updateWarehouse
);

// DELETE /api/warehouses/:warehouseId
router.delete('/:warehouseId',
  requirePermission('warehouse_management'),
  auditLog('warehouse_deleted'),
  warehouseController.deleteWarehouse
);

// GET /api/warehouses/:warehouseId/details
router.get('/:warehouseId/details',
  requirePermission('warehouse_view'),
  warehouseController.getWarehouseDetails
);

module.exports = router;