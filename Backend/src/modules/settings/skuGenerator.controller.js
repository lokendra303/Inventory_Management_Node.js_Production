const skuGeneratorService = require('./skuGenerator.service');
const logger = require('../../utils/logger');

class SkuGeneratorController {
  async listRules(req, res) {
    try {
      const rules = await skuGeneratorService.listRules(req.institutionId);
      res.json({ success: true, data: rules });
    } catch (error) {
      logger.error('Failed to list SKU rules', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to list SKU rules' });
    }
  }

  async getRule(req, res) {
    try {
      const rule = await skuGeneratorService.getRule(req.institutionId, req.params.id);
      if (!rule) return res.status(404).json({ success: false, error: 'Rule not found' });
      res.json({ success: true, data: rule });
    } catch (error) {
      logger.error('Failed to fetch SKU rule', { error: error.message });
      res.status(500).json({ success: false, error: 'Failed to fetch SKU rule' });
    }
  }

  async upsertRule(req, res) {
    try {
      const id = await skuGeneratorService.upsertRule(
        req.institutionId,
        { ...req.body, id: req.params.id || req.body.id },
        req.user?.userId
      );
      res.status(req.params.id ? 200 : 201).json({ success: true, data: { id } });
    } catch (error) {
      logger.error('Failed to save SKU rule', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteRule(req, res) {
    try {
      await skuGeneratorService.deleteRule(req.institutionId, req.params.id, req.user?.userId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete SKU rule', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async previewSku(req, res) {
    try {
      const ctx = {
        category: req.query.category || req.body?.category,
        brand: req.query.brand || req.body?.brand,
        name: req.query.name || req.body?.name
      };
      const result = await skuGeneratorService.previewSku(req.institutionId, ctx);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to preview SKU', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async generateSku(req, res) {
    try {
      const ctx = {
        category: req.body?.category,
        brand: req.body?.brand,
        name: req.body?.name
      };
      const result = await skuGeneratorService.generateSku(req.institutionId, ctx);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to generate SKU', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new SkuGeneratorController();
