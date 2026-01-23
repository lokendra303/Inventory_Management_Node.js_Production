const express = require('express');
const authController = require('../controllers/authController');
const roleController = require('../controllers/roleController');
const inventoryController = require('../controllers/inventoryController');
const itemController = require('../controllers/itemController');
const warehouseController = require('../controllers/warehouseController');
const warehouseTypeController = require('../controllers/warehouseTypeController');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const salesOrderController = require('../controllers/salesOrderController');
const reorderLevelController = require('../controllers/reorderLevelController');
const categoryController = require('../controllers/categoryController');
const settingsController = require('../controllers/settingsController');
const { requireAuth, requirePermission, validateTenantConsistency, auditLog } = require('../middleware/auth');
const { validate, schemas } = require('../utils/validation');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Public routes (no authentication required)
router.post('/auth/register-tenant', 
  validate(schemas.registerTenantSchema),
  auditLog('tenant_registration'),
  authController.registerTenant
);

router.post('/auth/login', 
  validate(schemas.loginSchema),
  auditLog('user_login'),
  authController.login
);

router.post('/auth/temp-login',
  auditLog('temp_access_login'),
  authController.tempLogin
);

// Protected routes (authentication required)
router.use(requireAuth);
router.use(validateTenantConsistency);

// Auth routes
router.get('/auth/profile', authController.getProfile);
router.post('/auth/refresh', authController.refreshToken);
router.put('/auth/profile', 
  auditLog('profile_updated'),
  authController.updateProfile
);
router.put('/auth/change-password',
  auditLog('password_changed'),
  authController.changePassword
);

// User management (admin only)
router.post('/users', 
  requirePermission('user_management'),
  auditLog('user_creation'),
  authController.createUser
);

router.get('/users', 
  requirePermission('user_management'),
  authController.getUsers
);

router.put('/users/:userId/permissions', 
  requirePermission('user_management'),
  validate(schemas.updateUserPermissionsSchema),
  auditLog('user_permission_update'),
  authController.updateUserPermissions
);

router.put('/users/:userId/status',
  validate(schemas.updateUserStatusSchema),
  requirePermission('user_management'),
  auditLog('user_status_update'),
  authController.updateUserStatus
);

router.post('/users/:userId/temp-access',
  requirePermission('user_management'),
  auditLog('temp_access_generated'),
  authController.generateTempAccess
);

// Role management
router.post('/roles',
  requirePermission('user_management'),
  auditLog('role_created'),
  roleController.createRole
);

router.get('/roles',
  requirePermission('user_management'),
  roleController.getRoles
);

router.put('/roles/:roleId',
  requirePermission('user_management'),
  auditLog('role_updated'),
  roleController.updateRole
);

router.put('/roles/:roleId/status',
  requirePermission('user_management'),
  auditLog('role_status_toggled'),
  roleController.toggleRoleStatus
);

// Item management
router.post('/items',
  requirePermission('item_management'),
  auditLog('item_created'),
  itemController.createItem
);

router.get('/items',
  requirePermission('item_view'),
  itemController.getItems
);

router.get('/items/:itemId',
  requirePermission('item_view'),
  itemController.getItem
);

router.put('/items/:itemId',
  requirePermission('item_management'),
  auditLog('item_updated'),
  itemController.updateItem
);

router.delete('/items/:itemId',
  requirePermission('item_management'),
  auditLog('item_deleted'),
  itemController.deleteItem
);

// Warehouse management
router.post('/warehouses',
  requirePermission('warehouse_management'),
  auditLog('warehouse_created'),
  warehouseController.createWarehouse
);

router.get('/warehouses',
  requirePermission('warehouse_view'),
  warehouseController.getWarehouses
);

router.get('/warehouses/:warehouseId/details',
  requirePermission('warehouse_view'),
  warehouseController.getWarehouseDetails
);

router.get('/warehouses/:warehouseId',
  requirePermission('warehouse_view'),
  warehouseController.getWarehouse
);

router.put('/warehouses/:warehouseId',
  requirePermission('warehouse_management'),
  auditLog('warehouse_updated'),
  warehouseController.updateWarehouse
);

// Warehouse Type Management
router.post('/warehouse-types',
  requirePermission('warehouse_type_management'),
  auditLog('warehouse_type_created'),
  warehouseTypeController.createWarehouseType
);

router.get('/warehouse-types',
  requirePermission('warehouse_type_view'),
  warehouseTypeController.getWarehouseTypes
);

router.put('/warehouse-types/:typeId',
  requirePermission('warehouse_type_management'),
  auditLog('warehouse_type_updated'),
  warehouseTypeController.updateWarehouseType
);

// Inventory operations
router.post('/inventory/receive', 
  validate(schemas.receiveStockSchema),
  requirePermission('inventory_receive'),
  auditLog('stock_received'),
  inventoryController.receiveStock
);

router.post('/inventory/reserve', 
  validate(schemas.reserveStockSchema),
  requirePermission('inventory_reserve'),
  auditLog('stock_reserved'),
  inventoryController.reserveStock
);

router.post('/inventory/ship', 
  validate(schemas.shipStockSchema),
  requirePermission('inventory_ship'),
  auditLog('stock_shipped'),
  inventoryController.shipStock
);

router.post('/inventory/adjust', 
  validate(schemas.adjustStockSchema),
  requirePermission('inventory_adjust'),
  auditLog('stock_adjusted'),
  inventoryController.adjustStock
);

router.post('/inventory/transfer', 
  validate(schemas.transferStockSchema),
  requirePermission('inventory_transfer'),
  auditLog('stock_transferred'),
  inventoryController.transferStock
);

// Inventory queries
router.get('/inventory/history/:itemId/:warehouseId', 
  requirePermission('inventory_view'),
  inventoryController.getInventoryHistory
);

router.get('/inventory/current/:itemId/:warehouseId', 
  requirePermission('inventory_view'),
  inventoryController.getCurrentStock
);

router.get('/inventory/warehouse/:warehouseId', 
  requirePermission('inventory_view'),
  inventoryController.getWarehouseStock
);

router.get('/inventory', 
  requirePermission('inventory_view'),
  inventoryController.getTenantInventory
);

router.get('/inventory/dashboard-stats', 
  requirePermission('inventory_view'),
  inventoryController.getDashboardStats
);

router.get('/inventory/low-stock', 
  requirePermission('inventory_view'),
  inventoryController.getLowStockItems
);

// Purchase Order management
router.post('/purchase-orders',
  validate(schemas.createPurchaseOrderSchema),
  requirePermission('purchase_management'),
  validateTenantConsistency,
  auditLog('purchase_order_created'),
  purchaseOrderController.createPurchaseOrder
);

router.get('/purchase-orders',
  requirePermission('purchase_view'),
  purchaseOrderController.getPurchaseOrders
);

router.get('/purchase-orders/:poId',
  requirePermission('purchase_view'),
  purchaseOrderController.getPurchaseOrder
);

router.put('/purchase-orders/:poId/status',
  requirePermission('purchase_management'),
  validateTenantConsistency,
  auditLog('purchase_order_status_updated'),
  purchaseOrderController.updatePOStatus
);

router.post('/grn',
  requirePermission('inventory_receive'),
  validateTenantConsistency,
  auditLog('grn_created'),
  purchaseOrderController.createGRN
);

router.get('/grn/:grnId',
  requirePermission('inventory_view'),
  purchaseOrderController.getGRN
);

router.get('/pending-receipts',
  requirePermission('inventory_view'),
  purchaseOrderController.getPendingReceipts
);

// Vendor management
router.post('/vendors',
  requirePermission('vendor_management'),
  validateTenantConsistency,
  auditLog('vendor_created'),
  purchaseOrderController.createVendor
);

router.get('/vendors',
  requirePermission('vendor_view'),
  purchaseOrderController.getVendors
);

router.get('/vendors/:vendorId',
  requirePermission('vendor_view'),
  purchaseOrderController.getVendor
);

router.put('/vendors/:vendorId',
  requirePermission('vendor_management'),
  validateTenantConsistency,
  auditLog('vendor_updated'),
  purchaseOrderController.updateVendor
);

router.get('/vendors/:vendorId/performance',
  requirePermission('vendor_view'),
  purchaseOrderController.getVendorPerformance
);

// Sales Order management
router.post('/sales-orders',
  validate(schemas.createSalesOrderSchema),
  requirePermission('sales_management'),
  validateTenantConsistency,
  auditLog('sales_order_created'),
  salesOrderController.createSalesOrder
);

router.get('/sales-orders',
  requirePermission('sales_view'),
  salesOrderController.getSalesOrders
);

router.get('/sales-orders/:soId',
  requirePermission('sales_view'),
  salesOrderController.getSalesOrder
);

// Reorder Level Management
router.post('/reorder-levels',
  requirePermission('inventory_management'),
  validateTenantConsistency,
  auditLog('reorder_level_set'),
  reorderLevelController.setReorderLevel
);

router.get('/reorder-levels',
  requirePermission('inventory_view'),
  reorderLevelController.getReorderLevels
);

router.get('/low-stock-alerts',
  requirePermission('inventory_view'),
  reorderLevelController.getLowStockAlerts
);

router.put('/low-stock-alerts/:alertId/acknowledge',
  requirePermission('inventory_management'),
  auditLog('alert_acknowledged'),
  reorderLevelController.acknowledgeAlert
);

router.get('/reorder-suggestions',
  requirePermission('inventory_view'),
  reorderLevelController.getReorderSuggestions
);

// Category Management
router.post('/categories',
  requirePermission('category_management'),
  validateTenantConsistency,
  auditLog('category_created'),
  categoryController.createCategory
);

router.get('/categories',
  requirePermission('category_view'),
  categoryController.getCategories
);

router.get('/categories/tree',
  requirePermission('category_view'),
  categoryController.getCategoryTree
);

router.put('/categories/:categoryId',
  requirePermission('category_management'),
  validateTenantConsistency,
  auditLog('category_updated'),
  categoryController.updateCategory
);

router.delete('/categories/:categoryId',
  requirePermission('category_management'),
  auditLog('category_deleted'),
  categoryController.deleteCategory
);

// Settings Management
router.get('/settings',
  settingsController.getTenantSettings
);

router.put('/settings',
  auditLog('settings_updated'),
  settingsController.updateTenantSettings
);

// Error handling middleware
router.use((error, req, res, next) => {
  const logger = require('../utils/logger');
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    tenantId: req.tenantId,
    userId: req.user?.userId
  });

  res.status(error.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
  });
});

// 404 handler
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

module.exports = router;