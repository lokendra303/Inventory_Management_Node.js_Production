const express = require('express');
const batchController = require('./batchGenerator.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');

const router = express.Router();

// GET  /api/batch-rules
router.get('/', requirePermission('production_view'), batchController.listRules);

// GET  /api/batch-rules/preview
router.get('/preview', requirePermission('production_view'), batchController.previewBatch);

// POST /api/batch-rules/generate
router.post(
  '/generate',
  requirePermission('production_management'),
  auditLog('batch_number_generated'),
  batchController.generateBatch
);

// GET  /api/batch-rules/:id
router.get('/:id', requirePermission('production_view'), batchController.getRule);

// POST /api/batch-rules
router.post(
  '/',
  requirePermission('production_management'),
  auditLog('batch_rule_created'),
  batchController.upsertRule
);

// PUT  /api/batch-rules/:id
router.put(
  '/:id',
  requirePermission('production_management'),
  auditLog('batch_rule_updated'),
  batchController.upsertRule
);

// DELETE /api/batch-rules/:id
router.delete(
  '/:id',
  requirePermission('production_management'),
  auditLog('batch_rule_deleted'),
  batchController.deleteRule
);

module.exports = router;
