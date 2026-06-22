const batchGeneratorService = require('./batchGenerator.service');
const logger = require('../../utils/logger');

const BATCH_CTX_FIELDS = [
  'ruleId',
  'context',
  'itemId',
  'warehouseId',
  'category',
  'brand',
  'manufacturer',
  'name',
  'item',
  'sku',
  'variant',
  'type',
  'unit',
  'warehouse',
  'hsn',
  'hsnCode',
  'mpn',
  'barcode',
  'skuCode',
  'itemCode',
  'categoryCode',
  'typeCode',
  'unitCode',
  'warehouseCode',
  'size',
  'typeValue',
];

function buildBatchContext(primary = {}, fallback = {}) {
  const ctx = {};
  for (const key of BATCH_CTX_FIELDS) {
    const value = primary?.[key] ?? fallback?.[key];
    if (value !== undefined && value !== null && value !== '') {
      ctx[key] = value;
    }
  }
  return ctx;
}

class BatchGeneratorController {
  async listRules(req, res) {
    try {
      const context = req.query.context || null;
      const rules = await batchGeneratorService.listRules(req.institutionId, { context });
      res.json({ success: true, data: rules });
    } catch (error) {
      logger.error('Failed to list batch rules', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to list batch rules' });
    }
  }

  async getRule(req, res) {
    try {
      const rule = await batchGeneratorService.getRule(req.institutionId, req.params.id);
      if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
      res.json({ success: true, data: rule });
    } catch (error) {
      logger.error('Failed to fetch batch rule', { error: error.message });
      res.status(500).json({ success: false, error: 'Failed to fetch batch rule' });
    }
  }

  async upsertRule(req, res) {
    try {
      const id = await batchGeneratorService.upsertRule(
        req.institutionId,
        { ...req.body, id: req.params.id || req.body.id },
        req.user?.userId
      );
      res.status(req.params.id ? 200 : 201).json({ success: true, data: { id } });
    } catch (error) {
      logger.error('Failed to save batch rule', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteRule(req, res) {
    try {
      await batchGeneratorService.deleteRule(req.institutionId, req.params.id, req.user?.userId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete batch rule', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async previewBatch(req, res) {
    try {
      const ctx = buildBatchContext(req.query, req.body);
      const result = await batchGeneratorService.previewBatch(req.institutionId, ctx);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to preview batch number', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async generateBatch(req, res) {
    try {
      const ctx = buildBatchContext(req.body, req.query);
      const result = await batchGeneratorService.generateBatch(req.institutionId, ctx);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to generate batch number', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new BatchGeneratorController();
