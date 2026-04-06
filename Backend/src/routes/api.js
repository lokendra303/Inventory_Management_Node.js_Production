const express = require('express');
const { requireAuth, validateInstitutionConsistency } = require('../middleware/auth');

const router = express.Router();

<<<<<<< Updated upstream
// Public barcode route
=======
// Public routes — no auth required
>>>>>>> Stashed changes
router.use('/barcode', require('./barcode'));

// Protected routes — auth required below this line
router.use(requireAuth);
router.use(validateInstitutionConsistency);

<<<<<<< Updated upstream
// Auth sub-routes
router.use('/users', require('../modules/auth/user.routes'));
router.use('/roles', require('../modules/auth/role.routes'));
router.use('/service-accounts', require('../modules/auth/serviceAccount.routes'));

// Entity module
router.use('/items', require('../modules/entity/item.routes'));
router.use('/categories', require('../modules/entity/category.routes'));
router.use('/brands', require('../modules/entity/brand.routes'));
router.use('/manufacturers', require('../modules/entity/manufacturer.routes'));
router.use('/vendors', require('../modules/entity/vendor.routes'));
router.use('/customers', require('../modules/entity/customer.routes'));

// Warehouse module
router.use('/warehouses', require('../modules/warehouse/warehouse.routes'));
router.use('/warehouse-types', require('../modules/warehouse/warehouseType.routes'));

// Inventory module
router.use('/inventory', require('../modules/inventory/inventory.routes'));
router.use('/inventory', require('../modules/inventory/batchSerial.routes'));
router.use('/batch-serial', require('../modules/inventory/batchSerial.routes'));
router.use('/reorder-levels', require('../modules/inventory/reorderLevel.routes'));
router.use('/stock-counts', require('../modules/inventory/stockCount.routes'));
router.use('/transfer-approvals', require('../modules/inventory/transferApproval.routes'));

// Order module
router.use('/purchase-orders', require('../modules/order/purchaseOrder.routes'));
router.use('/sales-orders', require('../modules/order/salesOrder.routes'));
router.use('/delivery-challans', require('../modules/order/deliveryChallan.routes'));
router.use('/purchase-returns', require('../modules/order/purchaseReturn.routes'));
router.use('/grn', require('../modules/order/grn.routes'));

// Invoice module
router.use('/invoices', require('../modules/invoice/invoice.routes'));
router.use('/purchase-invoices', require('../modules/invoice/purchaseInvoice.routes'));
router.use('/sales-invoices', require('../modules/invoice/salesInvoice.routes'));

// Master data module
router.use('/units', require('../modules/master-data/units.routes'));
router.use('/dropdown-options', require('../modules/master-data/dropdownOptions.routes'));
router.use('/data', require('../modules/master-data/allData.routes'));

// Reports module
router.use('/reports', require('../modules/reports/reports.routes'));
router.use('/analytics', require('../modules/reports/analytics.routes'));
router.use('/profit-loss', require('../modules/reports/profitLoss.routes'));

// Settings module
router.use('/settings', require('../modules/settings/settings.routes'));
router.use('/company-settings', require('../modules/settings/companySettings.routes'));

// Documents module
router.use('/documents', require('../modules/documents/document.routes'));

// Notification module
router.use('/notifications', require('../modules/notification/notification.routes'));

// Audit module
router.use('/audit', require('../modules/audit/audit.routes'));

// Error handling
=======
// Resource routes
router.use('/users', require('./auth/users'));
router.use('/roles', require('./auth/roles'));
router.use('/items', require('./entity/items'));
router.use('/manufacturers', require('./entity/manufacturers'));
router.use('/brands', require('./entity/brands'));
router.use('/units', require('./master-data/units'));
router.use('/dropdown-options', require('./master-data/dropdown-options'));
router.use('/categories', require('./entity/categories'));
router.use('/warehouses', require('./warehouse/warehouses'));
router.use('/warehouse-types', require('./warehouse/warehouse-types'));
router.use('/inventory', require('./inventory/inventory'));
router.use('/purchase-orders', require('./order/purchase-orders'));
router.use('/vendors', require('./entity/vendors'));
router.use('/customers', require('./entity/customers'));
router.use('/sales-orders', require('./order/sales-orders'));
router.use('/invoices', require('./invoice/invoices'));
router.use('/purchase-invoices', require('./invoice/purchase-invoices'));
router.use('/sales-invoices', require('./invoice/sales-invoices'));
router.use('/grn', require('./order/grn'));
router.use('/reorder-levels', require('./inventory/reorder-levels'));
router.use('/batch-serial', require('./inventory/batch-serial'));
router.use('/inventory', require('./inventory/batch-serial'));
router.use('/stock-counts', require('./inventory/stock-counts'));
router.use('/purchase-returns', require('./order/purchase-returns'));
router.use('/data', require('./master-data/all-data'));
router.use('/reports', require('./reports/reports'));
router.use('/profit-loss', require('./reports/profit-loss'));
router.use('/settings', require('./settings/settings'));
router.use('/company-settings', require('./settings/company-settings'));
router.use('/documents', require('./documents/documents'));
router.use('/delivery-challans', require('./order/delivery-challans'));
router.use('/transfer-approvals', require('./inventory/transfer-approvals'));
router.use('/analytics', require('./reports/analytics'));
router.use('/notifications', require('./notification/notifications'));
router.use('/audit', require('./audit/audit'));

// Error handling middleware
>>>>>>> Stashed changes
router.use((error, req, res, next) => {
  const logger = require('../utils/logger');
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    institutionId: req.institutionId,
    userId: req.user?.userId
  });

  res.status(error.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
  });
});

<<<<<<< Updated upstream
router.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
=======
// 404 handler
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
>>>>>>> Stashed changes
});

module.exports = router;