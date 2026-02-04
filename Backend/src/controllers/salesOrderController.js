const salesOrderService = require('../services/salesOrderService');
const soConfirmationService = require('../services/soConfirmationService');
const logger = require('../utils/logger');

class SalesOrderController {
  async createSalesOrder(req, res) {
    try {
      const soId = await salesOrderService.createSalesOrder(
        req.institutionId,
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
        institutionId: req.institutionId,
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
      
      const sos = await salesOrderService.getSalesOrders(req.institutionId, filters);
      
      res.json({
        success: true,
        data: sos
      });
    } catch (error) {
      logger.error('Failed to get sales orders', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getSalesOrder(req, res) {
    try {
      const { id: soId } = req.params;
      const so = await salesOrderService.getSalesOrder(req.institutionId, soId);
      
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
        institutionId: req.institutionId,
        soId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  async updateSOStatus(req, res) {
    try {
      const { id: soId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Status is required'
        });
      }

      // If status is being changed to 'confirmed', use the enhanced confirmation service
      if (status === 'confirmed') {
        const result = await soConfirmationService.processSOConfirmation(
          req.institutionId, 
          soId, 
          req.user.userId
        );
        
        res.json({
          success: true,
          message: 'Sales order confirmed and inventory updated successfully',
          data: result
        });
      } else {
        await salesOrderService.updateSOStatus(req.institutionId, soId, status, req.user.userId);
        
        res.json({
          success: true,
          message: 'Sales order status updated successfully'
        });
      }
    } catch (error) {
      logger.error('Failed to update SO status', {
        error: error.message,
        institutionId: req.institutionId,
        soId: req.params.id
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async confirmSalesOrder(req, res) {
    try {
      const { id: soId } = req.params;
      
      const result = await soConfirmationService.processSOConfirmation(
        req.institutionId, 
        soId, 
        req.user.userId
      );
      
      res.json({
        success: true,
        message: 'Sales order confirmed successfully. Inventory has been updated automatically.',
        data: result
      });
    } catch (error) {
      logger.error('Failed to confirm sales order', {
        error: error.message,
        institutionId: req.institutionId,
        soId: req.params.id,
        userId: req.user.userId
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getConfirmationSummary(req, res) {
    try {
      const { id: soId } = req.params;
      
      const summary = await soConfirmationService.getConfirmationSummary(
        req.institutionId, 
        soId
      );
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Failed to get SO confirmation summary', {
        error: error.message,
        institutionId: req.institutionId,
        soId: req.params.id
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new SalesOrderController();