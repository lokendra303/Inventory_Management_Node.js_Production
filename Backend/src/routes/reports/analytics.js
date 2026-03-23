const express = require('express');
const analyticsController = require('../../controllers/reports/analyticsController');
const { requirePermission } = require('../../middleware/auth');

const router = express.Router();

router.get('/abc-analysis',
  requirePermission('inventory_view'),
  analyticsController.getABCAnalysis
);

router.get('/slow-moving',
  requirePermission('inventory_view'),
  analyticsController.getSlowMovingStock
);

router.get('/dead-stock',
  requirePermission('inventory_view'),
  analyticsController.getDeadStock
);

router.get('/demand-forecast/:itemId/:warehouseId',
  requirePermission('inventory_view'),
  analyticsController.getDemandForecast
);

router.get('/profit-loss',
  requirePermission('inventory_view'),
  analyticsController.getProperProfitLoss
);

router.get('/valuation',
  requirePermission('inventory_view'),
  analyticsController.getValuationReport
);

router.get('/valuation/:itemId/:warehouseId',
  requirePermission('inventory_view'),
  analyticsController.getItemValuation
);

module.exports = router;
