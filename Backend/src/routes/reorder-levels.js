const express = require('express');
const reorderLevelController = require('../controllers/reorderLevelController');
const { requirePermission, validateInstitutionConsistency, auditLog } = require('../middleware/auth');

const router = express.Router();

// GET /api/reorder-levels
router.get('/',
  requirePermission('inventory_view'),
  reorderLevelController.getReorderLevels
);

// POST /api/reorder-levels
router.post('/',
  requirePermission('inventory_management'),
  validateInstitutionConsistency,
  auditLog('reorder_level_set'),
  reorderLevelController.setReorderLevel
);

// GET /api/reorder-levels/low-stock-alerts
router.get('/low-stock-alerts',
  requirePermission('inventory_view'),
  reorderLevelController.getLowStockAlerts
);

// PUT /api/reorder-levels/alerts/:id/acknowledge
router.put('/alerts/:id/acknowledge',
  requirePermission('inventory_management'),
  auditLog('alert_acknowledged'),
  reorderLevelController.acknowledgeAlert
);

// GET /api/reorder-levels/suggestions
router.get('/suggestions',
  requirePermission('inventory_view'),
  reorderLevelController.getReorderSuggestions
);

module.exports = router;