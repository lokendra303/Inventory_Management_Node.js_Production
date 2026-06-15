const itemService = require('./item.service');
const itemActivityService = require('../inventory/itemActivity.service');
const logger = require('../../utils/logger');

class ItemController {
  async getVariantLibrary(req, res) {
    try {
      const data = await itemService.listVariantLibrary(req.institutionId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to fetch variant library', {
        error: error.message,
        institutionId: req.institutionId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async saveVariantLibrary(req, res) {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      const affected = await itemService.saveVariantLibrary(req.institutionId, rows, req.user?.userId);
      res.json({ success: true, message: 'Variant library saved', data: { affected } });
    } catch (error) {
      logger.error('Failed to save variant library', {
        error: error.message,
        institutionId: req.institutionId,
        userId: req.user?.userId
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async setVariantLibraryEntry(req, res) {
    try {
      const name = req.body?.name;
      const values = req.body?.values;
      await itemService.setVariantLibraryEntry(req.institutionId, name, values, req.user?.userId);
      res.json({ success: true, message: 'Variant value saved' });
    } catch (error) {
      logger.error('Failed to set variant library entry', {
        error: error.message,
        institutionId: req.institutionId,
        userId: req.user?.userId
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteVariantLibraryEntryValue(req, res) {
    try {
      const { name, value } = req.query;
      await itemService.deleteVariantLibraryEntryValue(req.institutionId, name, value);
      res.json({ success: true, message: 'Variant value deleted' });
    } catch (error) {
      logger.error('Failed to delete variant library value', {
        error: error.message,
        institutionId: req.institutionId
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async checkSkuAvailability(req, res) {
    try {
      const sku = req.query.sku;
      const excludeItemId = req.query.excludeItemId || null;
      const result = await itemService.checkSkuAvailability(req.institutionId, sku, excludeItemId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to check SKU availability', {
        error: error.message,
        institutionId: req.institutionId
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async createItem(req, res) {
    try {
      const body = req.body || {};
      const itemId = body.type === 'composite'
        ? await itemService.createCompositeItem(
          req.institutionId,
          { itemData: body, components: body.components || [] },
          req.user.userId
        )
        : await itemService.createItem(
          req.institutionId,
          body,
          req.user.userId
        );
      
      res.status(201).json({
        success: true,
        message: 'Item created successfully',
        data: { itemId }
      });
    } catch (error) {
      logger.error('Item creation failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        userId: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getItems(req, res) {
    try {
      const limit = req.query.limit != null && req.query.limit !== ''
        ? parseInt(req.query.limit, 10)
        : null;
      const offset = parseInt(req.query.offset, 10) || 0;
      const filters = {
        type: req.query.type,
        category: req.query.category,
        itemGroupId: req.query.itemGroupId,
        status: req.query.status,
        search: req.query.search,
        includeVariants: req.query.includeVariants === '1' || req.query.includeVariants === 'true'
      };
      
      const { items, total } = await itemService.getItems(req.institutionId, filters, limit, offset);
      
      res.json({
        success: true,
        data: items,
        pagination: { limit: limit ?? total, offset, total }
      });
    } catch (error) {
      logger.error('Failed to get items', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getItemFieldConfig(req, res) {
    try {
      const { itemType } = req.params;
      const fieldConfig = await itemService.getItemFieldConfig(req.institutionId, itemType);
      
      res.json({
        success: true,
        data: fieldConfig
      });
    } catch (error) {
      logger.error('Failed to get item field config', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async createItemFieldConfig(req, res) {
    try {
      const configId = await itemService.createItemFieldConfig(
        req.institutionId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Field configuration created successfully',
        data: { configId }
      });
    } catch (error) {
      logger.error('Field config creation failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        userId: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getItem(req, res) {
    try {
      const { id: itemId } = req.params;
      const item = await itemService.getItem(req.institutionId, itemId);
      
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }
      
      // Get full audit trail for this item
      const activitySummary = await itemActivityService.getItemActivitySummary(req.institutionId, itemId);
      const auditLogs = await itemActivityService.getDetailedItemLogs(req.institutionId, itemId);
      
      res.json({
        success: true,
        data: {
          ...item,
          inventory_activity: activitySummary,
          audit_logs: auditLogs
        }
      });
    } catch (error) {
      logger.error('Failed to get item', { 
        error: error.message, 
        institutionId: req.institutionId,
        itemId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateItem(req, res) {
    try {
      const { id: itemId } = req.params;
      
      console.log('Update item request:', {
        itemId,
        params: req.params,
        body: req.body,
        institutionId: req.institutionId
      });
      
      if (!itemId) {
        return res.status(400).json({
          success: false,
          error: 'Item ID is required'
        });
      }

      const before = await itemService.getItemAuditSnapshot(req.institutionId, itemId);
      await itemService.updateItem(req.institutionId, itemId, req.body, req.user.userId);
      const after = await itemService.getItemAuditSnapshot(req.institutionId, itemId);
      res.locals.auditExtra = { before, after, submitted: req.body };

      res.json({
        success: true,
        message: 'Item updated successfully'
      });
    } catch (error) {
      console.error('Item update error:', error);
      logger.error('Item update failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        itemId: req.params.id,
        userId: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getCompositeComponents(req, res) {
    try {
      const { id: itemId } = req.params;
      const components = await itemService.getCompositeComponents(req.institutionId, itemId);
      res.json({ success: true, data: components });
    } catch (error) {
      logger.error('Failed to get composite components', {
        error: error.message,
        institutionId: req.institutionId,
        itemId: req.params.id
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateCompositeComponents(req, res) {
    try {
      const { id: itemId } = req.params;
      const before = await itemService.getItemAuditSnapshot(req.institutionId, itemId);
      const updatedCount = await itemService.updateCompositeComponents(
        req.institutionId,
        itemId,
        req.body?.components || [],
        req.user.userId
      );
      const after = await itemService.getItemAuditSnapshot(req.institutionId, itemId);
      res.locals.auditExtra = { before, after, submitted: req.body };
      res.json({
        success: true,
        message: 'Composite components updated successfully',
        data: { updatedCount }
      });
    } catch (error) {
      logger.error('Failed to update composite components', {
        error: error.message,
        institutionId: req.institutionId,
        itemId: req.params.id,
        userId: req.user?.userId
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateItemFieldConfig(req, res) {
    try {
      const { itemType, fieldName } = req.params;
      const { options } = req.body;
      
      await itemService.updateItemFieldOptions(
        req.institutionId,
        itemType,
        fieldName,
        options,
        req.user.userId
      );
      
      res.json({
        success: true,
        message: 'Field options updated successfully'
      });
    } catch (error) {
      logger.error('Field options update failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        userId: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteItem(req, res) {
    try {
      const { id: itemId } = req.params;
      await itemService.permanentlyDeleteInactiveItem(req.institutionId, itemId, req.user.userId);

      res.json({
        success: true,
        message: 'Inactive item permanently deleted'
      });
    } catch (error) {
      logger.error('Item deletion failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        itemId: req.params.id,
        userId: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  async saveDraft(req, res) {
    try {
      const draftId = await itemService.saveDraft(req.institutionId, req.user.userId, req.body);
      res.json({ success: true, data: { draftId } });
    } catch (error) {
      logger.error('Draft save failed', { error: error.message, userId: req.user.userId });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getDraft(req, res) {
    try {
      const draft = await itemService.getDraft(req.institutionId, req.user.userId);
      res.json({ success: true, data: draft });
    } catch (error) {
      logger.error('Draft fetch failed', { error: error.message, userId: req.user.userId });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getDrafts(req, res) {
    try {
      const drafts = await itemService.getDrafts(req.institutionId, req.user.userId);
      res.json({ success: true, data: drafts });
    } catch (error) {
      logger.error('Draft list fetch failed', { error: error.message, userId: req.user.userId });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deleteDraft(req, res) {
    try {
      await itemService.deleteDraft(req.institutionId, req.user.userId, req.params.draftId || null);
      res.json({ success: true, message: 'Draft deleted' });
    } catch (error) {
      logger.error('Draft delete failed', { error: error.message, userId: req.user.userId });
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ItemController();
