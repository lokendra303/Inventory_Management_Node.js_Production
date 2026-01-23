const salesOrderService = require('../services/salesOrderService');
const logger = require('../utils/logger');

class SalesOrderController {
  async createSalesOrder(req, res) {
    try {
      const soId = await salesOrderService.createSalesOrder(
        req.tenantId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Sales order created successfully',
        data: { soId }
      });
    } catch (error) {
      logger.error('SO creation failed', { 
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

  async getSalesOrders(req, res) {
    try {
      const filters = {
        status: req.query.status,
        customerId: req.query.customerId
      };
      
      const sos = await salesOrderService.getSalesOrders(req.tenantId, filters);
      
      res.json({
        success: true,
        data: sos
      });
    } catch (error) {
      logger.error('Failed to get sales orders', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getSalesOrder(req, res) {
    try {
      const { soId } = req.params;
      const so = await salesOrderService.getSalesOrder(req.tenantId, soId);
      
      if (!so) {
        return res.status(404).json({
          success: false,
          error: 'Sales order not found'
        });
      }
      
      res.json({
        success: true,
        data: so
      });
    } catch (error) {
      logger.error('Failed to get sales order', { 
        error: error.message, 
        tenantId: req.tenantId,
        soId: req.params.soId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new SalesOrderController();