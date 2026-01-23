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

// GET /api/warehouses/:id
router.get('/:id',
  requirePermission('warehouse_view'),
  warehouseController.getWarehouse
);

// PUT /api/warehouses/:id
router.put('/:id',
  requirePermission('warehouse_management'),
  auditLog('warehouse_updated'),
  warehouseController.updateWarehouse
);

// GET /api/warehouses/:id/details
router.get('/:id/details',
  requirePermission('warehouse_view'),
  warehouseController.getWarehouseDetails
);

module.exports = router;