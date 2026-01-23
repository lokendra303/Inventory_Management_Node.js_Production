const express = require('express');
const warehouseTypeController = require('../controllers/warehouseTypeController');
const { requirePermission, auditLog } = require('../middleware/auth');

const router = express.Router();

// GET /api/warehouse-types
router.get('/',
  requirePermission('warehouse_type_view'),
  warehouseTypeController.getWarehouseTypes
);

// POST /api/warehouse-types
router.post('/',
  requirePermission('warehouse_type_management'),
  auditLog('warehouse_type_created'),
  warehouseTypeController.createWarehouseType
);

// PUT /api/warehouse-types/:id
router.put('/:id',
  requirePermission('warehouse_type_management'),
  auditLog('warehouse_type_updated'),
  warehouseTypeController.updateWarehouseType
);

module.exports = router;