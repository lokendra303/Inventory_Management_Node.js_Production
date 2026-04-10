const express = require('express');
const { requireAuth, validateInstitutionConsistency } = require('../middleware/auth');

const router = express.Router();

// Public routes — no auth required
router.use('/barcode', require('./barcode'));

// Protected routes — auth required below this line
router.use(requireAuth);
router.use(validateInstitutionConsistency);

// Resource routes
router.use('/users', require('../modules/auth/user.routes'));
router.use('/roles', require('../modules/auth/role.routes'));
router.use('/items', require('../modules/entity/item.routes'));
router.use('/manufacturers', require('../modules/entity/manufacturer.routes'));
router.use('/brands', require('../modules/entity/brand.routes'));
router.use('/units', require('../modules/master-data/units.routes'));
router.use('/dropdown-options', require('../modules/master-data/dropdownOptions.routes'));
router.use('/categories', require('../modules/entity/category.routes'));
router.use('/warehouses', require('../modules/warehouse/warehouse.routes'));
router.use('/warehouse-types', require('../modules/warehouse/warehouseType.routes'));
router.use('/inventory', require('../modules/inventory/inventory.routes'));
router.use('/purchase-orders', require('../modules/order/purchaseOrder.routes'));
router.use('/vendors', require('../modules/entity/vendor.routes'));
router.use('/customers', require('../modules/entity/customer.routes'));
router.use('/sales-orders', require('../modules/order/salesOrder.routes'));
router.use('/invoices', require('../modules/invoice/invoice.routes'));
router.use('/purchase-invoices', require('../modules/invoice/purchaseInvoice.routes'));
router.use('/accounting', require('../modules/invoice/accounting.routes'));
router.use('/sales-invoices', require('../modules/invoice/salesInvoice.routes'));
router.use('/grn', require('../modules/order/grn.routes'));
router.use('/reorder-levels', require('../modules/inventory/reorderLevel.routes'));
router.use('/batch-serial', require('../modules/inventory/batchSerial.routes'));
router.use('/stock-counts', require('../modules/inventory/stockCount.routes'));
router.use('/purchase-returns', require('../modules/order/purchaseReturn.routes'));
router.use('/data', require('../modules/master-data/allData.routes'));
router.use('/reports', require('../modules/reports/reports.routes'));
router.use('/profit-loss', require('../modules/reports/profitLoss.routes'));
router.use('/settings', require('../modules/settings/settings.routes'));
router.use('/company-settings', require('../modules/settings/companySettings.routes'));
router.use('/documents', require('../modules/documents/document.routes'));
router.use('/delivery-challans', require('../modules/order/deliveryChallan.routes'));
router.use('/transfer-approvals', require('../modules/inventory/transferApproval.routes'));
router.use('/analytics', require('../modules/reports/analytics.routes'));
router.use('/notifications', require('../modules/notification/notification.routes'));
router.use('/audit', require('../modules/audit/audit.routes'));

// Error handling middleware
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

// 404 handler
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

module.exports = router;