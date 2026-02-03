const warehouseService = require('../services/warehouseService');
const logger = require('../utils/logger');

class WarehouseController {
  async createWarehouse(req, res) {
    try {
      const warehouseId = await warehouseService.createWarehouse(
        req.institutionId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Warehouse created successfully',
        data: { warehouseId }
      });
    } catch (error) {
      logger.error('Warehouse creation failed', { 
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

  async getWarehouses(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const filters = {
        status: req.query.status,
        search: req.query.search
      };
      
      let warehouses = await warehouseService.getWarehouses(req.institutionId, filters, limit, offset);
      
      // Filter warehouses based on user's warehouse access
      const userWarehouseAccess = req.user.warehouseAccess || [];
      
      // Admin or institution_users with empty warehouse access can see all warehouses
      if (req.user.role !== 'admin' && userWarehouseAccess.length > 0) {
        warehouses = warehouses.filter(warehouse => 
          userWarehouseAccess.includes(warehouse.id)
        );
      }
      
      res.json({
        success: true,
        data: warehouses,
        pagination: { limit, offset, total: warehouses.length }
      });
    } catch (error) {
      logger.error('Failed to get warehouses', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getWarehouse(req, res) {
    try {
      const { warehouseId } = req.params;
      const warehouse = await warehouseService.getWarehouse(req.institutionId, warehouseId);
      
      if (!warehouse) {
        return res.status(404).json({
          success: false,
          error: 'Warehouse not found'
        });
      }
      
      res.json({
        success: true,
        data: warehouse
      });
    } catch (error) {
      logger.error('Failed to get warehouse', { 
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

  async getWarehouseDetails(req, res) {
    try {
      const { warehouseId } = req.params;
      
      if (!warehouseId || warehouseId === 'undefined' || warehouseId === 'null') {
        return res.status(400).json({
          success: false,
          error: 'Warehouse ID is required'
        });
      }
      
      const details = await warehouseService.getWarehouseDetails(req.institutionId, warehouseId);
      
      res.json({
        success: true,
        data: details
      });
    } catch (error) {
      logger.error('Failed to get warehouse details', { 
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

  async updateWarehouse(req, res) {
    try {
      const { warehouseId } = req.params;
      await warehouseService.updateWarehouse(req.institutionId, warehouseId, req.body, req.user.userId);
      
      res.json({
        success: true,
        message: 'Warehouse updated successfully'
      });
    } catch (error) {
      logger.error('Warehouse update failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        warehouseId: req.params.warehouseId,
        userId: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteWarehouse(req, res) {
    try {
      const { warehouseId } = req.params;
      await warehouseService.deleteWarehouse(req.institutionId, warehouseId, req.user.userId);
      
      res.json({
        success: true,
        message: 'Warehouse deleted successfully'
      });
    } catch (error) {
      logger.error('Warehouse deletion failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        warehouseId: req.params.warehouseId,
        userId: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new WarehouseController();