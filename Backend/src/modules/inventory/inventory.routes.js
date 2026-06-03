const express = require('express');
const inventoryController = require('./inventory.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');
const { validate, schemas } = require('../../utils/validation');

const router = express.Router();

// GET /api/inventory
router.get('/', 
  requirePermission('inventory_view'),
  inventoryController.getInstitutionInventory
);

// GET /api/inventory/adjustments
router.get('/adjustments',
  requirePermission('inventory_view'),
  inventoryController.getAdjustments
);

// GET /api/inventory/dashboard-stats
router.get('/dashboard-stats', 
  requirePermission('inventory_view'),
  inventoryController.getDashboardStats
);

// GET /api/inventory/low-stock
router.get('/low-stock', 
  requirePermission('inventory_view'),
  inventoryController.getLowStockItems
);

// GET /api/inventory/warehouse/:warehouseId
router.get('/warehouse/:warehouseId', 
  requirePermission('inventory_view'),
  inventoryController.getWarehouseStock
);

// GET /api/inventory/transfers
router.get('/transfers',
  requirePermission('inventory_view'),
  inventoryController.getTransferHistory
);

// GET /api/inventory/item-logs/:itemId - Detailed item operation logs
router.get('/item-logs/:itemId', 
  requirePermission('inventory_view'),
  inventoryController.getDetailedItemLogs
);

// GET /api/inventory/item-activity/:itemId/warehouse/:warehouseId - Item activity for specific warehouse
router.get('/item-activity/:itemId/warehouse/:warehouseId', 
  requirePermission('inventory_view'),
  inventoryController.getItemActivitySummary
);

// GET /api/inventory/item-activity/:itemId - Comprehensive item activity summary
router.get('/item-activity/:itemId', 
  requirePermission('inventory_view'),
  inventoryController.getItemActivitySummary
);

// GET /api/inventory/composite/:compositeItemId/:warehouseId/availability
router.get(
  '/composite/:compositeItemId/:warehouseId/availability',
  requirePermission('inventory_view'),
  inventoryController.getCompositeAvailability
);

// POST /api/inventory/assemble-kit
router.post(
  '/assemble-kit',
  validate(schemas.assembleKitSchema),
  requirePermission('inventory_adjust'),
  auditLog('kit_assembled'),
  inventoryController.assembleKit
);

// POST /api/inventory/disassemble-kit
router.post(
  '/disassemble-kit',
  validate(schemas.disassembleKitSchema),
  requirePermission('inventory_adjust'),
  auditLog('kit_disassembled'),
  inventoryController.disassembleKit
);

// GET /api/inventory/:itemId/:warehouseId/history
router.get('/:itemId/:warehouseId/history', 
  requirePermission('inventory_view'),
  inventoryController.getInventoryHistory
);

// GET /api/inventory/:itemId/:warehouseId
router.get('/:itemId/:warehouseId', 
  requirePermission('inventory_view'),
  inventoryController.getCurrentStock
);

// POST /api/inventory/reserve
router.post('/reserve', 
  validate(schemas.reserveStockSchema),
  requirePermission('inventory_reserve'),
  auditLog('stock_reserved'),
  inventoryController.reserveStock
);

// POST /api/inventory/ship
router.post('/ship', 
  validate(schemas.shipStockSchema),
  requirePermission('inventory_ship'),
  auditLog('stock_shipped'),
  inventoryController.shipStock
);

// POST /api/inventory/adjust
router.post('/adjust', 
  validate(schemas.adjustStockSchema),
  requirePermission('inventory_adjust'),
  auditLog('stock_adjusted'),
  inventoryController.adjustStock
);

// POST /api/inventory/transfer
router.post('/transfer', 
  validate(schemas.transferStockSchema),
  requirePermission('inventory_transfer'),
  auditLog('stock_transferred'),
  inventoryController.transferStock
);

// DELETE /api/inventory/:itemId/:warehouseId
router.delete('/:itemId/:warehouseId',
  requirePermission('inventory_adjust'),
  auditLog('inventory_deleted'),
  inventoryController.deleteInventory
);

module.exports = router;