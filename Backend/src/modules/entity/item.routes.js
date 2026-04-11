const express = require('express');
const itemController = require('./item.controller');
const itemPriceHistoryController = require('./itemPriceHistory.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');

const router = express.Router();

// GET /api/items
router.get('/',
  requirePermission('item_view'),
  itemController.getItems
);

// GET /api/items/field-config/:itemType
router.get('/field-config/:itemType',
  requirePermission('item_view'),
  itemController.getItemFieldConfig
);

// POST /api/items/field-config
router.post('/field-config',
  requirePermission('item_management'),
  auditLog('field_config_created'),
  itemController.createItemFieldConfig
);

// Draft routes
router.get('/draft', requirePermission('item_management'), itemController.getDraft);
router.post('/draft', requirePermission('item_management'), itemController.saveDraft);
router.delete('/draft', requirePermission('item_management'), itemController.deleteDraft);

// POST /api/items
router.post('/',
  requirePermission('item_management'),
  auditLog('item_created'),
  itemController.createItem
);

// PUT /api/items/field-config/:itemType/:fieldName/options
router.put('/field-config/:itemType/:fieldName/options',
  requirePermission('item_management'),
  auditLog('field_options_updated'),
  itemController.updateItemFieldConfig
);

// GET /api/items/:id/price-history
router.get('/:id/price-history',
  requirePermission('item_view'),
  itemPriceHistoryController.getPriceHistory
);

// GET /api/items/:id
router.get('/:id',
  requirePermission('item_view'),
  itemController.getItem
);

// PUT /api/items/:id
router.put('/:id',
  requirePermission('item_management'),
  auditLog('item_updated'),
  itemController.updateItem
);

// DELETE /api/items/:id
router.delete('/:id',
  requirePermission('item_management'),
  auditLog('item_deleted'),
  itemController.deleteItem
);

module.exports = router;