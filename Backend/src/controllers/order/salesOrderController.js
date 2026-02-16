const salesOrderService = require('../../services/order/salesOrderService');
const soConfirmationService = require('../../services/order/soConfirmationService');
const salesOrderPDFService = require('../../services/pdf/salesOrderPDFService');
const logger = require('../../utils/logger');

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

  async getWarehouseRecommendations(req, res) {
    try {
      const { customerId, items, customerAddress } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Items are required'
        });
      }

      const recommendations = await salesOrderService.getWarehouseRecommendations(
        req.institutionId,
        { customerId, items, customerAddress }
      );

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      logger.error('Failed to get warehouse recommendations', {
        error: error.message,
        institutionId: req.institutionId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getStockAvailability(req, res) {
    try {
      const { items } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Items are required'
        });
      }

      const availability = await salesOrderService.getStockAvailability(
        req.institutionId,
        items
      );

      res.json({
        success: true,
        data: availability
      });
    } catch (error) {
      logger.error('Failed to get stock availability', {
        error: error.message,
        institutionId: req.institutionId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async calculateOrderCost(req, res) {
    try {
      const { warehouseId, items, customerAddress, shippingMethod } = req.body;

      if (!warehouseId || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Warehouse ID and items are required'
        });
      }

      const cost = await salesOrderService.calculateOrderCost(
        req.institutionId,
        warehouseId,
        { items, customerAddress, shippingMethod }
      );

      res.json({
        success: true,
        data: cost
      });
    } catch (error) {
      logger.error('Failed to calculate order cost', {
        error: error.message,
        institutionId: req.institutionId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async downloadSOPDF(req, res) {
    try {
      const { id: soId } = req.params;
      const so = await salesOrderService.getSalesOrder(req.institutionId, soId);
      
      if (!so) {
        return res.status(404).json({
          success: false,
          error: 'Sales order not found'
        });
      }
      
      const pdfBuffer = await salesOrderPDFService.generatePDFBuffer(so, req.institutionId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="SO_${so.so_number}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      logger.error('Failed to generate SO PDF', { 
        error: error.message, 
        institutionId: req.institutionId,
        soId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF'
      });
    }
  }
}

module.exports = new SalesOrderController();
