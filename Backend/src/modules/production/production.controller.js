const productionService = require('./production.service');
const itemService = require('../entity/item.service');
const logger = require('../../utils/logger');

class ProductionController {
  async listBomItems(req, res) {
    try {
      const limit = req.query.limit != null && req.query.limit !== ''
        ? parseInt(req.query.limit, 10)
        : null;
      const offset = parseInt(req.query.offset, 10) || 0;
      const filters = {
        category: req.query.category,
        itemGroupId: req.query.itemGroupId,
        status: req.query.status,
        search: req.query.search,
      };
      const { items, total } = await productionService.listBomItems(
        req.institutionId,
        filters,
        limit,
        offset
      );
      res.json({
        success: true,
        data: items,
        pagination: { limit: limit ?? total, offset, total },
      });
    } catch (error) {
      logger.error('Failed to list BOM items', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getBomItem(req, res) {
    try {
      const item = await productionService.getBomItem(req.institutionId, req.params.id);
      if (!item) {
        return res.status(404).json({ success: false, error: 'BOM item not found' });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      logger.error('Failed to get BOM item', {
        error: error.message,
        institutionId: req.institutionId,
        itemId: req.params.id,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async createBomItem(req, res) {
    try {
      const itemId = await productionService.createBomItem(
        req.institutionId,
        req.body || {},
        req.user.userId
      );
      res.status(201).json({
        success: true,
        message: 'BOM item created successfully',
        data: { itemId },
      });
    } catch (error) {
      logger.error('BOM item creation failed', {
        error: error.message,
        institutionId: req.institutionId,
        userId: req.user?.userId,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateBomItem(req, res) {
    try {
      const before = await itemService.getItemAuditSnapshot(req.institutionId, req.params.id);
      const itemId = await productionService.updateBomItem(
        req.institutionId,
        req.params.id,
        req.body || {},
        req.user.userId
      );
      const after = await itemService.getItemAuditSnapshot(req.institutionId, req.params.id);
      res.locals.auditExtra = { before, after, submitted: req.body };
      res.json({
        success: true,
        message: 'BOM item updated successfully',
        data: { itemId },
      });
    } catch (error) {
      logger.error('BOM item update failed', {
        error: error.message,
        institutionId: req.institutionId,
        itemId: req.params.id,
        userId: req.user?.userId,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateBomComponents(req, res) {
    try {
      const before = await itemService.getItemAuditSnapshot(req.institutionId, req.params.id);
      const updatedCount = await productionService.updateBomComponents(
        req.institutionId,
        req.params.id,
        req.body?.components || [],
        req.user.userId
      );
      const after = await itemService.getItemAuditSnapshot(req.institutionId, req.params.id);
      res.locals.auditExtra = { before, after, submitted: req.body };
      res.json({
        success: true,
        message: 'BOM components updated successfully',
        data: { updatedCount },
      });
    } catch (error) {
      logger.error('Failed to update BOM components', {
        error: error.message,
        institutionId: req.institutionId,
        itemId: req.params.id,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getAvailability(req, res) {
    try {
      const { id: compositeItemId, warehouseId } = req.params;
      const data = await productionService.getAvailability(
        req.institutionId,
        compositeItemId,
        warehouseId
      );
      res.json({ success: true, data });
    } catch (error) {
      logger.error('BOM availability failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async previewKitBatchNumber(req, res) {
    try {
      const data = await productionService.previewKitBatchNumber(
        req.institutionId,
        req.params.id,
        req.query.warehouseId,
        req.query.ruleId || null
      );
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Kit batch number preview failed', {
        error: error.message,
        institutionId: req.institutionId,
        itemId: req.params.id,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async assembleKit(req, res) {
    try {
      const result = await productionService.assembleKit(
        req.institutionId,
        req.body,
        req.user.userId
      );
      res.status(201).json({ success: true, message: 'Kit assembled successfully', data: result });
    } catch (error) {
      logger.error('Kit assembly failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async disassembleKit(req, res) {
    try {
      const result = await productionService.disassembleKit(
        req.institutionId,
        req.body,
        req.user.userId
      );
      res.status(201).json({ success: true, message: 'Kit disassembled successfully', data: result });
    } catch (error) {
      logger.error('Kit disassembly failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async listOperations(req, res) {
    try {
      const data = await productionService.listOperations(req.institutionId, {
        status: req.query.status,
        operationType: req.query.operationType,
        compositeItemId: req.query.compositeItemId,
        search: req.query.search,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to list production operations', {
        error: error.message,
        institutionId: req.institutionId,
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getOperation(req, res) {
    try {
      const order = await productionService.getOperation(req.institutionId, req.params.id);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Operation not found' });
      }
      res.json({ success: true, data: order });
    } catch (error) {
      logger.error('Failed to get production operation', {
        error: error.message,
        institutionId: req.institutionId,
        orderId: req.params.id,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async saveOperationDraft(req, res) {
    try {
      const body = { ...(req.body || {}), id: req.params.id || req.body?.id };
      const orderId = await productionService.saveOperationDraft(
        req.institutionId,
        req.user.userId,
        body
      );
      const order = await productionService.getOperation(req.institutionId, orderId);
      res.json({ success: true, data: order });
    } catch (error) {
      logger.error('Failed to save operation draft', {
        error: error.message,
        institutionId: req.institutionId,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async confirmOperation(req, res) {
    try {
      const result = await productionService.confirmOperation(
        req.institutionId,
        req.params.id,
        req.user.userId
      );
      res.json({ success: true, message: 'Operation completed', data: result });
    } catch (error) {
      logger.error('Failed to confirm operation', {
        error: error.message,
        institutionId: req.institutionId,
        orderId: req.params.id,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async cancelOperationDraft(req, res) {
    try {
      await productionService.cancelOperationDraft(
        req.institutionId,
        req.params.id,
        req.user.userId
      );
      res.json({ success: true, message: 'Draft cancelled' });
    } catch (error) {
      logger.error('Failed to cancel operation draft', {
        error: error.message,
        institutionId: req.institutionId,
        orderId: req.params.id,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async executeOperation(req, res) {
    try {
      const result = await productionService.executeOperation(
        req.institutionId,
        req.user.userId,
        req.body || {}
      );
      res.status(201).json({ success: true, message: 'Operation completed', data: result });
    } catch (error) {
      logger.error('Failed to execute operation', {
        error: error.message,
        institutionId: req.institutionId,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async previewDisassembly(req, res) {
    try {
      const data = await productionService.previewDisassembly(
        req.institutionId,
        req.params.id,
        req.params.warehouseId,
        req.query.quantity
      );
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Disassembly preview failed', {
        error: error.message,
        institutionId: req.institutionId,
        itemId: req.params.id,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async saveBomDraft(req, res) {
    try {
      const draftId = await productionService.saveBomDraft(
        req.institutionId,
        req.user.userId,
        req.body || {}
      );
      res.json({ success: true, data: { draftId } });
    } catch (error) {
      logger.error('Failed to save BOM draft', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getBomDrafts(req, res) {
    try {
      const drafts = await productionService.getBomDrafts(req.institutionId, req.user.userId);
      res.json({ success: true, data: drafts });
    } catch (error) {
      logger.error('Failed to list BOM drafts', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to list BOM drafts' });
    }
  }

  async getBomDraft(req, res) {
    try {
      const draft = await productionService.getBomDraft(req.institutionId, req.user.userId);
      res.json({ success: true, data: draft });
    } catch (error) {
      logger.error('Failed to get BOM draft', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to get BOM draft' });
    }
  }

  async deleteBomDraft(req, res) {
    try {
      await productionService.deleteBomDraft(
        req.institutionId,
        req.user.userId,
        req.params.draftId || null
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete BOM draft', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProductionController();
