const express = require('express');
const router = express.Router();
const profitLossController = require('./profitLoss.controller');
const { requirePermission } = require('../auth/auth.middleware');

router.get('/', requirePermission('inventory_view'), profitLossController.getProfitLoss);
router.get('/details', requirePermission('inventory_view'), profitLossController.getProfitLossDetails);
router.get('/movements', requirePermission('inventory_view'), profitLossController.getInventoryMovements);

module.exports = router;