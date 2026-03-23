const express = require('express');
const ctrl = require('../../controllers/inventory/stockCountController');
const { requirePermission, auditLog } = require('../../middleware/auth');

const router = express.Router();

router.post('/',                          requirePermission('inventory_adjust'),     auditLog('stock_count_created'),   ctrl.createStockCount);
router.get('/',                           requirePermission('inventory_view'),                                          ctrl.getStockCounts);
router.get('/aging',                      requirePermission('inventory_view'),                                          ctrl.getInventoryAgingReport);
router.get('/:countId',                   requirePermission('inventory_view'),                                          ctrl.getStockCount);
router.post('/:countId/submit',           requirePermission('inventory_adjust'),     auditLog('stock_count_submitted'), ctrl.submitCount);
router.post('/:countId/approve',          requirePermission('inventory_management'), auditLog('stock_count_approved'),  ctrl.approveAndPost);
router.post('/:countId/cancel',           requirePermission('inventory_adjust'),     auditLog('stock_count_cancelled'), ctrl.cancelStockCount);

module.exports = router;
