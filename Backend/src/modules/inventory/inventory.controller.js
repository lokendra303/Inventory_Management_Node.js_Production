const inventoryService = require('./inventory.service');
const itemActivityService = require('./itemActivity.service');
const logger = require('../../utils/logger');

class InventoryController {
  async receiveStock(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'User not authenticated' });
      }

      const eventId = await inventoryService.receiveStock(req.institutionId, req.body, req.user.userId);
      
      res.status(201).json({
        success: true,
        message: 'Stock received successfully',
        data: { eventId }
      });
    } catch (error) {
      logger.error('Stock receipt failed', { 
        error: error.message, 
        institutionId: req.institutionId,
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
        req.institutionId,
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
        institutionId: req.institutionId,
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
        req.institutionId,
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
        institutionId: req.institutionId,
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
        req.institutionId,
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
        institutionId: req.institutionId,
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
        req.institutionId,
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
        institutionId: req.institutionId,
        userId: req.user?.userId,
        data: req.body 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getTransferHistory(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const data = await inventoryService.getTransferHistory(req.institutionId, limit, offset);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to get transfer history', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getInventoryHistory(req, res) {
    try {
      const { itemId, warehouseId } = req.params;
      const history = await inventoryService.getInventoryHistory(req.institutionId, itemId, warehouseId);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Failed to get inventory history', { 
        error: error.message, 
        institutionId: req.institutionId,
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
      const stock = await inventoryService.getCurrentStock(req.institutionId, itemId, warehouseId);
      
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
        institutionId: req.institutionId,
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
      
      // Check warehouse access
      const warehouseService = require('../warehouse/warehouse.service');
      const hasAccess = await warehouseService.checkWarehouseAccess(req.institutionId, req.user.userId, warehouseId);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this warehouse'
        });
      }
      
      const stock = await inventoryService.getWarehouseStock(req.institutionId, warehouseId);
      
      res.json({
        success: true,
        data: stock,
        pagination: { total: stock.length }
      });
    } catch (error) {
      logger.error('Failed to get warehouse stock', { 
        error: error.message, 
        institutionId: req.institutionId,
        warehouseId: req.params.warehouseId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getInstitutionInventory(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const warehouseId = req.query.warehouseId;
      
      // Get user's accessible warehouses
      const warehouseService = require('../warehouse/warehouse.service');
      const userWarehouses = await warehouseService.getUserWarehouses(req.institutionId, req.user.userId);
      const accessibleWarehouseIds = userWarehouses.map(w => w.id);
      
      const projectionService = require('../../projections/inventoryProjections');
      const inventory = await projectionService.getInstitutionInventory(
        req.institutionId, 
        limit, 
        offset, 
        warehouseId, 
        accessibleWarehouseIds
      );
      
      res.json({
        success: true,
        data: inventory,
        pagination: { limit, offset, total: inventory.length }
      });
    } catch (error) {
      logger.error('Failed to get institution inventory', { 
        error: error.message, 
        institutionId: req.institutionId 
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
      const warehouseId = req.query.warehouseId;
      
      // Get user's accessible warehouses
      const warehouseService = require('../warehouse/warehouse.service');
      const userWarehouses = await warehouseService.getUserWarehouses(req.institutionId, req.user.userId);
      const accessibleWarehouseIds = userWarehouses.map(w => w.id);
      
      const projectionService = require('../../projections/inventoryProjections');
      const lowStockItems = await projectionService.getLowStockItems(
        req.institutionId, 
        threshold, 
        warehouseId, 
        accessibleWarehouseIds
      );
      
      res.json({
        success: true,
        data: lowStockItems
      });
    } catch (error) {
      logger.error('Failed to get low stock items', { 
        error: error.message, 
        institutionId: req.institutionId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getDashboardStats(req, res) {
    try {
      const projectionService = require('../../projections/inventoryProjections');
      const stats = await projectionService.getDashboardStats(req.institutionId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get dashboard stats', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  async deleteInventory(req, res) {
    try {
      const { itemId, warehouseId } = req.params;
      await inventoryService.deleteInventory(req.institutionId, itemId, warehouseId, req.user.userId);
      
      res.json({
        success: true,
        message: 'Inventory deleted successfully'
      });
    } catch (error) {
      logger.error('Inventory deletion failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        itemId: req.params.itemId,
        warehouseId: req.params.warehouseId,
        userId: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Backward compatibility
  async getinstitutionInventory(req, res) {
    return this.getInstitutionInventory(req, res);
  }

  async getAdjustments(req, res) {
    try {
      const { itemId, warehouseId, limit, offset } = req.query;
      const data = await inventoryService.getAdjustments(req.institutionId, {
        itemId, warehouseId,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to get adjustments', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getItemActivitySummary(req, res) {
    try {
      const { itemId, warehouseId } = req.params;
      const summary = await itemActivityService.getItemActivitySummary(
        req.institutionId, 
        itemId, 
        warehouseId || null
      );
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Failed to get item activity summary', { 
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

  async getDetailedItemLogs(req, res) {
    try {
      const { itemId } = req.params;
      const { warehouseId, startDate, endDate, operationType } = req.query;
      
      const logs = await itemActivityService.getDetailedItemLogs(
        req.institutionId, 
        itemId, 
        warehouseId || null,
        { startDate, endDate, operationType }
      );
      
      res.json({
        success: true,
        data: logs,
        pagination: { total: logs.length }
      });
    } catch (error) {
      logger.error('Failed to get detailed item logs', { 
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
}

module.exports = new InventoryController();
