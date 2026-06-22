const express = require('express');
const productionController = require('./production.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');
const { validate, schemas } = require('../../utils/validation');
const { checkLimit } = require('../../middleware/subscriptionGate');

const router = express.Router();

// BOM drafts (create form — save & resume)
router.get('/bom-drafts', requirePermission('production_view'), productionController.getBomDrafts);
router.get('/bom-draft', requirePermission('production_view'), productionController.getBomDraft);
router.post('/bom-draft', requirePermission('production_management'), productionController.saveBomDraft);
router.delete('/bom-draft/:draftId', requirePermission('production_management'), productionController.deleteBomDraft);
router.delete('/bom-draft', requirePermission('production_management'), productionController.deleteBomDraft);

// GET /api/production/bom-items
router.get(
  '/bom-items',
  requirePermission('production_view'),
  productionController.listBomItems
);

// GET /api/production/bom-items/:id
router.get(
  '/bom-items/:id',
  requirePermission('production_view'),
  productionController.getBomItem
);

// POST /api/production/bom-items
router.post(
  '/bom-items',
  validate(schemas.createBomItemSchema),
  requirePermission('production_management'),
  checkLimit('items'),
  auditLog('bom_item_created'),
  productionController.createBomItem
);

// PUT /api/production/bom-items/:id
router.put(
  '/bom-items/:id',
  validate(schemas.updateBomItemSchema),
  requirePermission('production_management'),
  auditLog('bom_item_updated'),
  productionController.updateBomItem
);

// PUT /api/production/bom-items/:id/components
router.put(
  '/bom-items/:id/components',
  requirePermission('production_management'),
  auditLog('item_components_updated'),
  productionController.updateBomComponents
);

// GET /api/production/bom-items/:id/preview-batch-number?warehouseId=&ruleId=
router.get(
  '/bom-items/:id/preview-batch-number',
  requirePermission('production_view'),
  productionController.previewKitBatchNumber
);

// GET /api/production/bom-items/:id/availability/:warehouseId
router.get(
  '/bom-items/:id/availability/:warehouseId',
  requirePermission('production_view'),
  productionController.getAvailability
);

// GET /api/production/bom-items/:id/disassembly-preview/:warehouseId?quantity=
router.get(
  '/bom-items/:id/disassembly-preview/:warehouseId',
  requirePermission('production_view'),
  productionController.previewDisassembly
);

// Production operations (draft → confirm, history)
router.get(
  '/operations',
  requirePermission('production_view'),
  productionController.listOperations
);
router.post(
  '/operations/execute',
  validate(schemas.productionOperationExecuteSchema),
  requirePermission('production_management'),
  auditLog('production_operation_executed'),
  productionController.executeOperation
);
router.post(
  '/operations',
  validate(schemas.productionOperationDraftSchema),
  requirePermission('production_management'),
  productionController.saveOperationDraft
);
router.get(
  '/operations/:id',
  requirePermission('production_view'),
  productionController.getOperation
);
router.put(
  '/operations/:id',
  validate(schemas.productionOperationDraftSchema),
  requirePermission('production_management'),
  productionController.saveOperationDraft
);
router.post(
  '/operations/:id/confirm',
  requirePermission('production_management'),
  auditLog('production_operation_confirmed'),
  productionController.confirmOperation
);
router.delete(
  '/operations/:id',
  requirePermission('production_management'),
  productionController.cancelOperationDraft
);

// POST /api/production/assemble-kit
router.post(
  '/assemble-kit',
  validate(schemas.assembleKitSchema),
  requirePermission('production_management'),
  auditLog('kit_assembled'),
  productionController.assembleKit
);

// POST /api/production/disassemble-kit
router.post(
  '/disassemble-kit',
  validate(schemas.disassembleKitSchema),
  requirePermission('production_management'),
  auditLog('kit_disassembled'),
  productionController.disassembleKit
);

module.exports = router;
