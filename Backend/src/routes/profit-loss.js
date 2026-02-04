const express = require('express');
const router = express.Router();
const profitLossController = require('../controllers/profitLossController');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('inventory_view'), profitLossController.getProfitLoss);
router.get('/details', requirePermission('inventory_view'), profitLossController.getProfitLossDetails);
router.get('/movements', requirePermission('inventory_view'), profitLossController.getInventoryMovements);

module.exports = router;