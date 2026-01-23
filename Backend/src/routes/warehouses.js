const express = require('express');
const warehouseController = require('../controllers/warehouseController');
const { requirePermission, auditLog } = require('../middleware/auth');

const router = express.Router();

// GET /api/warehouses
router.get('/',
  requirePermission('warehouse_view'),
  warehouseController.getWarehouses
);

// POST /api/warehouses
router.post('/',
  requirePermission('warehouse_management'),
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