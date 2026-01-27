const express = require('express');
const reportsController = require('../controllers/reportsController');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

// Inventory Reports
router.get('/inventory', requirePermission('reports_view'), reportsController.getInventoryReport);
router.get('/inventory-movement', requirePermission('reports_view'), reportsController.getInventoryMovementReport);
router.get('/inventory-valuation', requirePermission('reports_view'), reportsController.getInventoryValuationReport);
router.get('/low-stock', requirePermission('reports_view'), reportsController.getLowStockReport);

// Purchase Reports
router.get('/purchases', requirePermission('reports_view'), reportsController.getPurchaseReport);
router.get('/grn', requirePermission('reports_view'), reportsController.getGRNReport);
router.get('/vendor-performance', requirePermission('reports_view'), reportsController.getVendorPerformanceReport);

// Sales Reports
router.get('/sales', requirePermission('reports_view'), reportsController.getSalesReport);
router.get('/top-selling', requirePermission('reports_view'), reportsController.getTopSellingItems);

// Financial Reports
router.get('/profit-loss', requirePermission('reports_view'), reportsController.getProfitLossReport);

// Dashboard
router.get('/dashboard', requirePermission('reports_view'), reportsController.getDashboardSummary);

module.exports = router;