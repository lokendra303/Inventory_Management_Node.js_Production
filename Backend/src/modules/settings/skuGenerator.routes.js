const express = require('express');
const skuController = require('./skuGenerator.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');

const router = express.Router();

// Rule management — all gated behind item_management so the same folks who
// can create items can also shape the SKU format.

// GET  /api/sku-rules          -> list active rules for the institution
router.get('/', requirePermission('item_view'), skuController.listRules);

// GET  /api/sku-rules/preview  -> non-consuming preview for the UI
router.get('/preview', requirePermission('item_view'), skuController.previewSku);

// POST /api/sku-rules/generate -> consume next counter, return a fresh SKU
router.post('/generate',
  requirePermission('item_management'),
  auditLog('sku_generated'),
  skuController.generateSku
);

// GET  /api/sku-rules/:id
router.get('/:id', requirePermission('item_view'), skuController.getRule);

// POST /api/sku-rules          -> create
router.post('/',
  requirePermission('item_management'),
  auditLog('sku_rule_created'),
  skuController.upsertRule
);

// PUT  /api/sku-rules/:id      -> update
router.put('/:id',
  requirePermission('item_management'),
  auditLog('sku_rule_updated'),
  skuController.upsertRule
);

// DELETE /api/sku-rules/:id    -> soft delete
router.delete('/:id',
  requirePermission('item_management'),
  auditLog('sku_rule_deleted'),
  skuController.deleteRule
);

module.exports = router;
