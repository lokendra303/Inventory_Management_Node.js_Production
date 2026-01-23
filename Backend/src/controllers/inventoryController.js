const inventoryService = require('../services/inventoryService');
const logger = require('../utils/logger');

class InventoryController {
  async receiveStock(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const eventId = await inventoryService.receiveStock(req.tenantId, req.body, req.user.userId);
      
      res.status(201).json({
        success: true,
        message: 'Stock received successfully',
        data: { eventId }
      });
    } catch (error) {
      logger.error('Stock receipt failed', { 
        error: error.message, 
        tenantId: req.tenantId,
        userId: req.user?.userId,
        data: req.body 
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  hasWarehouseAccess(user, warehouseId) {
    // Admin has access to all warehouses
    if (user.role === 'admin') return true;
    
    // Empty warehouse access means access to all warehouses
    const warehouseAccess = user.warehouseAccess || [];
    if (warehouseAccess.length === 0) return true;
    
    // Check if user has access to specific warehouse
    return warehouseAccess.includes(warehouseId);
  }

  async reserveStock(req, res) {
    try {
      const eventId = await inventoryService.reserveStock(
        req.tenantId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Stock reserved successfully',
        data: { eventId }
      });
    } catch (error) {
      logger.error('Stock reservation failed', { 
        error: error.message, 
        tenantId: req.tenantId,
        userId: req.user.userId,
        data: req.body 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async shipStock(req, res) {
    try {
      const eventId = await inventoryService.shipStock(
        req.tenantId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Stock shipped successfully',
        data: { eventId }
      });
    } catch (error) {
      logger.error('Stock shipment failed', { 
        error: error.message, 
        tenantId: req.tenantId,
        userId: req.user.userId,
        data: req.body 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async adjustStock(req, res) {
    try {
      // Check if user exists
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const eventId = await inventoryService.adjustStock(
        req.tenantId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Stock adjusted successfully',
        data: { eventId }
      });
    } catch (error) {
      logger.error('Stock adjustment failed', { 
        error: error.message, 
        tenantId: req.tenantId,
        userId: req.user?.userId,
        data: req.body 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async transferStock(req, res) {
    try {
      // Check if user exists
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const transferId = await inventoryService.transferStock(
        req.tenantId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Stock transferred successfully',
        data: { transferId }
      });
    } catch (error) {
      logger.error('Stock transfer failed', { 
        error: error.message, 
        tenantId: req.tenantId,
        userId: req.user?.userId,
        data: req.body 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getInventoryHistory(req, res) {
    try {
      const { itemId, warehouseId } = req.params;
      const history = await inventoryService.getInventoryHistory(req.tenantId, itemId, warehouseId);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Failed to get inventory history', { 
        error: error.message, 
        tenantId: req.tenantId,
        itemId: req.params.itemId,
        warehouseId: req.params.warehouseId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getCurrentStock(req, res) {
    try {
      const { itemId, warehouseId } = req.params;
      const stock = await inventoryService.getCurrentStock(req.tenantId, itemId, warehouseId);
      
      if (!stock) {
        return res.status(404).json({
          success: false,
          error: 'Stock record not found'
        });
      }
      
      res.json({
        success: true,
        data: stock
      });
    } catch (error) {
      logger.error('Failed to get current stock', { 
        error: error.message, 
        tenantId: req.tenantId,
        itemId: req.params.itemId,
        warehouseId: req.params.warehouseId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getWarehouseStock(req, res) {
    try {
      const { warehouseId } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      
      const stock = await inventoryService.getWarehouseStock(req.tenantId, warehouseId);
      
      res.json({
        success: true,
        data: stock,
        pagination: { limit, offset, total: stock.length }
      });
    } catch (error) {
      logger.error('Failed to get warehouse stock', { 
        error: error.message, 
        tenantId: req.tenantId,
        warehouseId: req.params.warehouseId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getTenantInventory(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      
      const projectionService = require('../projections/inventoryProjections');
      const inventory = await projectionService.getTenantInventory(req.tenantId, limit, offset);
      
      res.json({
        success: true,
        data: inventory,
        pagination: { limit, offset, total: inventory.length }
      });
    } catch (error) {
      logger.error('Failed to get tenant inventory', { 
        error: error.message, 
        tenantId: req.tenantId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getLowStockItems(req, res) {
    try {
      const threshold = parseInt(req.query.threshold) || 10;
      
      const projectionService = require('../projections/inventoryProjections');
      const lowStockItems = await projectionService.getLowStockItems(req.tenantId, threshold);
      
      res.json({
        success: true,
        data: lowStockItems
      });
    } catch (error) {
      logger.error('Failed to get low stock items', { 
        error: error.message, 
        tenantId: req.tenantId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getDashboardStats(req, res) {
    try {
      const projectionService = require('../projections/inventoryProjections');
      const stats = await projectionService.getDashboardStats(req.tenantId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get dashboard stats', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new InventoryController();