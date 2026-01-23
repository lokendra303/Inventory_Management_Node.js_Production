const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { requirePermission, auditLog } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validation');

const router = express.Router();

// GET /api/inventory
router.get('/', 
  requirePermission('inventory_view'),
  inventoryController.getTenantInventory
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

// GET /api/inventory/:itemId/:warehouseId
router.get('/:itemId/:warehouseId', 
  requirePermission('inventory_view'),
  inventoryController.getCurrentStock
);

// GET /api/inventory/:itemId/:warehouseId/history
router.get('/:itemId/:warehouseId/history', 
  requirePermission('inventory_view'),
  inventoryController.getInventoryHistory
);

// POST /api/inventory/receive
router.post('/receive', 
  validate(schemas.receiveStockSchema),
  requirePermission('inventory_receive'),
  auditLog('stock_received'),
  inventoryController.receiveStock
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

module.exports = router;