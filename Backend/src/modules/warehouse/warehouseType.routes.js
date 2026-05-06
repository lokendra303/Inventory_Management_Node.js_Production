const express = require('express');
const warehouseTypeController = require('./warehouseType.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');

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
router.put('/:typeId',
  requirePermission('warehouse_type_management'),
  auditLog('warehouse_type_updated'),
  warehouseTypeController.updateWarehouseType
);

// DELETE /api/warehouse-types/:typeId
router.delete('/:typeId',
  requirePermission('warehouse_type_management'),
  auditLog('warehouse_type_deleted'),
  warehouseTypeController.deleteWarehouseType
);

module.exports = router;