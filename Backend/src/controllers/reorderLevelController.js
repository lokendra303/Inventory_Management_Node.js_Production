const reorderLevelService = require('../services/reorderLevelService');
const logger = require('../utils/logger');

class ReorderLevelController {
  async setReorderLevel(req, res) {
    try {
      await reorderLevelService.setReorderLevel(
        req.tenantId,
        req.body,
        req.user.userId
      );
      
      res.json({
        success: true,
        message: 'Reorder level set successfully'
      });
    } catch (error) {
      logger.error('Failed to set reorder level', { 
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

  async getReorderLevels(req, res) {
    try {
      const filters = {
        itemId: req.query.itemId,
        warehouseId: req.query.warehouseId,
        lowStockOnly: req.query.lowStockOnly === 'true'
      };
      
      const reorderLevels = await reorderLevelService.getReorderLevels(req.tenantId, filters);
      
      res.json({
        success: true,
        data: reorderLevels
      });
    } catch (error) {
      logger.error('Failed to get reorder levels', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getLowStockAlerts(req, res) {
    try {
      const status = req.query.status || 'active';
      const alerts = await reorderLevelService.getLowStockAlerts(req.tenantId, status);
      
      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      logger.error('Failed to get low stock alerts', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async acknowledgeAlert(req, res) {
    try {
      const { alertId } = req.params;
      await reorderLevelService.acknowledgeAlert(req.tenantId, alertId, req.user.userId);
      
      res.json({
        success: true,
        message: 'Alert acknowledged successfully'
      });
    } catch (error) {
      logger.error('Failed to acknowledge alert', { 
        error: error.message, 
        tenantId: req.tenantId,
        alertId: req.params.alertId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getReorderSuggestions(req, res) {
    try {
      const suggestions = await reorderLevelService.generateReorderSuggestions(req.tenantId);
      
      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      logger.error('Failed to get reorder suggestions', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new ReorderLevelController();