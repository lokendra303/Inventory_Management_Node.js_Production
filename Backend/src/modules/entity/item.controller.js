const itemService = require('./item.service');
const itemActivityService = require('../inventory/itemActivity.service');
const logger = require('../../utils/logger');

class ItemController {
  async createItem(req, res) {
    try {
      const itemId = await itemService.createItem(
        req.institutionId,
        req.body,
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
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const filters = {
        type: req.query.type,
        category: req.query.category,
        status: req.query.status,
        search: req.query.search,
        productionOnly: ['true', '1', 'yes'].includes(String(req.query.productionOnly || '').toLowerCase())
      };
      
      const items = await itemService.getItems(req.institutionId, filters, limit, offset);
      
      res.json({
        success: true,
        data: items,
        pagination: { limit, offset, total: items.length }
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
      
      await itemService.updateItem(req.institutionId, itemId, req.body, req.user.userId);
      
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
      await itemService.deleteItem(req.institutionId, itemId, req.user.userId);
      
      res.json({
        success: true,
        message: 'Item deleted successfully'
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

  async deleteDraft(req, res) {
    try {
      await itemService.deleteDraft(req.institutionId, req.user.userId);
      res.json({ success: true, message: 'Draft deleted' });
    } catch (error) {
      logger.error('Draft delete failed', { error: error.message, userId: req.user.userId });
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ItemController();
