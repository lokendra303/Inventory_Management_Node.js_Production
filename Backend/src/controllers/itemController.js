const itemService = require('../services/itemService');
const logger = require('../utils/logger');

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
        search: req.query.search
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
      const { itemId } = req.params;
      const item = await itemService.getItem(req.institutionId, itemId);
      
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }
      
      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      logger.error('Failed to get item', { 
        error: error.message, 
        institutionId: req.institutionId,
        itemId: req.params.itemId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateItem(req, res) {
    try {
      const { itemId } = req.params;
      
      console.log('Update item request:', {
        itemId,
        body: req.body,
        institutionId: req.institutionId
      });
      
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
        itemId: req.params.itemId,
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
      const { itemId } = req.params;
      await itemService.deleteItem(req.institutionId, itemId, req.user.userId);
      
      res.json({
        success: true,
        message: 'Item deleted successfully'
      });
    } catch (error) {
      logger.error('Item deletion failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        itemId: req.params.itemId,
        userId: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ItemController();