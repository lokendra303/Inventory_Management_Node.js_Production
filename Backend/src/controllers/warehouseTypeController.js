const warehouseTypeService = require('../services/warehouseTypeService');
const logger = require('../utils/logger');

class WarehouseTypeController {
  async createWarehouseType(req, res) {
    try {
      const typeId = await warehouseTypeService.createWarehouseType(
        req.institutionId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Warehouse type created successfully',
        data: { typeId }
      });
    } catch (error) {
      logger.error('Warehouse type creation failed', { 
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

  async getWarehouseTypes(req, res) {
    try {
      const filters = { status: req.query.status };
      const types = await warehouseTypeService.getWarehouseTypes(req.institutionId, filters);
      
      res.json({
        success: true,
        data: types
      });
    } catch (error) {
      logger.error('Failed to get warehouse types', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateWarehouseType(req, res) {
    try {
      const { typeId } = req.params;
      await warehouseTypeService.updateWarehouseType(req.institutionId, typeId, req.body, req.user.userId);
      
      res.json({
        success: true,
        message: 'Warehouse type updated successfully'
      });
    } catch (error) {
      logger.error('Warehouse type update failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        typeId: req.params.typeId,
        userId: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new WarehouseTypeController();