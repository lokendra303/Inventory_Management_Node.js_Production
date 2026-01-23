const itemService = require('../services/itemService');
const logger = require('../utils/logger');

class ItemController {
  async createItem(req, res) {
    try {
      const itemId = await itemService.createItem(
        req.tenantId,
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
        tenantId: req.tenantId,
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
      
      const items = await itemService.getItems(req.tenantId, filters, limit, offset);
      
      res.json({
        success: true,
        data: items,
        pagination: { limit, offset, total: items.length }
      });
    } catch (error) {
      logger.error('Failed to get items', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getItem(req, res) {
    try {
      const { itemId } = req.params;
      const item = await itemService.getItem(req.tenantId, itemId);
      
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
        tenantId: req.tenantId,
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
        tenantId: req.tenantId
      });
      
      await itemService.updateItem(req.tenantId, itemId, req.body, req.user.userId);
      
      res.json({
        success: true,
        message: 'Item updated successfully'
      });
    } catch (error) {
      console.error('Item update error:', error);
      logger.error('Item update failed', { 
        error: error.message, 
        tenantId: req.tenantId,
        itemId: req.params.itemId,
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
      await itemService.deleteItem(req.tenantId, itemId, req.user.userId);
      
      res.json({
        success: true,
        message: 'Item deleted successfully'
      });
    } catch (error) {
      logger.error('Item deletion failed', { 
        error: error.message, 
        tenantId: req.tenantId,
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