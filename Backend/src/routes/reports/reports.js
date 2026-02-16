const express = require('express');
const reportsController = require('../../controllers/reports/reportsController');
const { requirePermission } = require('../../middleware/auth');

const router = express.Router();

// Inventory Reports
router.get('/inventory', requirePermission('inventory_view'), reportsController.getInventoryReport);
router.get('/inventory-movement', requirePermission('inventory_view'), reportsController.getInventoryMovementReport);
router.get('/inventory-adjustments', requirePermission('inventory_view'), reportsController.getInventoryAdjustmentReport);
router.get('/stock-transfers', requirePermission('inventory_view'), reportsController.getStockTransferReport);
router.get('/inventory-valuation', requirePermission('inventory_view'), reportsController.getInventoryValuationReport);
router.get('/low-stock', requirePermission('inventory_view'), reportsController.getLowStockReport);

// Purchase Reports
router.get('/purchases', requirePermission('purchase_view'), reportsController.getPurchaseReport);
router.get('/grn', requirePermission('purchase_view'), reportsController.getGRNReport);
router.get('/vendor-performance', requirePermission('purchase_view'), reportsController.getVendorPerformanceReport);

// Sales Reports
router.get('/sales', requirePermission('sales_view'), reportsController.getSalesReport);
router.get('/top-selling', requirePermission('sales_view'), reportsController.getTopSellingItems);

// Financial Reports
router.get('/profit-loss', requirePermission('inventory_view'), reportsController.getProfitLossReport);
router.get('/receivables', requirePermission('sales_view'), reportsController.getReceivablesReport);
router.get('/payments-received', requirePermission('sales_view'), reportsController.getPaymentsReceivedReport);

// Dashboard
router.get('/dashboard', reportsController.getDashboardSummary);

module.exports = router;