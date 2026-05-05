const express = require('express');
const productionController = require('./production.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');

const router = express.Router();

router.get('/masters', requirePermission('production_view'), productionController.listMasters);
router.post('/masters', requirePermission('production_management'), auditLog('production_master_created'), productionController.createMaster);
router.post('/masters/:masterId/bom-versions', requirePermission('production_management'), auditLog('production_bom_created'), productionController.createBomVersion);

router.get('/orders', requirePermission('production_view'), productionController.listOrders);
router.get('/orders/:orderId/availability-summary', requirePermission('production_view'), productionController.getAvailabilitySummary);
router.post('/orders', requirePermission('production_management'), auditLog('production_order_created'), productionController.createOrder);
router.post('/orders/:orderId/check-availability', requirePermission('production_view'), productionController.checkAvailability);
router.post('/orders/:orderId/complete', requirePermission('production_management'), auditLog('production_order_completed'), productionController.completeOrder);

module.exports = router;
