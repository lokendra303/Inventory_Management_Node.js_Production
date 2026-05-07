const express = require('express');
const itemController = require('./item.controller');
const itemPriceHistoryController = require('./itemPriceHistory.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');
const { checkLimit } = require('../../middleware/subscriptionGate');

const router = express.Router();

// GET /api/items
router.get('/',
  requirePermission('item_view'),
  itemController.getItems
);

// GET /api/items/check-sku?sku=...&excludeItemId=...
router.get('/check-sku',
  requirePermission('item_view'),
  itemController.checkSkuAvailability
);

// GET /api/items/variant-library
router.get('/variant-library',
  requirePermission('item_view'),
  itemController.getVariantLibrary
);

// POST /api/items/variant-library
router.post('/variant-library',
  requirePermission('item_management'),
  auditLog('variant_library_saved'),
  itemController.saveVariantLibrary
);

router.put('/variant-library/entry',
  requirePermission('item_management'),
  auditLog('variant_library_entry_updated'),
  itemController.setVariantLibraryEntry
);

router.delete('/variant-library/entry',
  requirePermission('item_management'),
  auditLog('variant_library_entry_deleted'),
  itemController.deleteVariantLibraryEntryValue
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
router.get('/drafts', requirePermission('item_management'), itemController.getDrafts);
router.get('/draft', requirePermission('item_management'), itemController.getDraft);
router.post('/draft', requirePermission('item_management'), itemController.saveDraft);
router.delete('/draft/:draftId', requirePermission('item_management'), itemController.deleteDraft);
router.delete('/draft', requirePermission('item_management'), itemController.deleteDraft);

// POST /api/items
router.post('/',
  requirePermission('item_management'),
  checkLimit('items'),
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
  checkLimit('items'),
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