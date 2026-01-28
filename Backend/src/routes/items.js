const express = require('express');
const itemController = require('../controllers/itemController');
const { requirePermission, auditLog } = require('../middleware/auth');

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