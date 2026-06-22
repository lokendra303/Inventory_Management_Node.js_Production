const salesOrderService = require('./salesOrder.service');
const soConfirmationService = require('./soConfirmation.service');
const salesOrderPDFService = require('../invoice/salesOrderPDF.service');
const emailService = require('../../services/emailService');
const logger = require('../../utils/logger');

class SalesOrderController {
  async shipSalesOrder(req, res) {
    try {
      const result = await salesOrderService.shipSalesOrder(
        req.institutionId,
        req.params.id,
        req.body,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        message: 'Shipment created successfully',
        data: result
      });
    } catch (error) {
      logger.error('Failed to create SO shipment', {
        error: error.message,
        institutionId: req.institutionId,
        soId: req.params.id,
        userId: req.user?.userId
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

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
          req.user.userId,
          req.body || {}
        );
        
        res.json({
          success: true,
          message: 'Sales order confirmed. Ship stock to deduct inventory and generate invoice.',
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
        req.user.userId,
        req.body || {}
      );
      
      res.json({
        success: true,
        message: 'Sales order confirmed. Ship stock to deduct inventory and generate invoice.',
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

  async emailSalesOrder(req, res) {
    try {
      const { id: soId } = req.params;
      const { to } = req.body;

      if (!to) {
        return res.status(400).json({
          success: false,
          error: 'Recipient email is required'
        });
      }

      const so = await salesOrderService.getSalesOrder(req.institutionId, soId);
      
      if (!so) {
        return res.status(404).json({
          success: false,
          error: 'Sales order not found'
        });
      }

      const pdfBuffer = await salesOrderPDFService.generatePDFBuffer(so, req.institutionId);
      
      const result = await emailService.sendEmailWithAttachment({
        to,
        subject: `Sales Order ${so.so_number}`,
        text: `Please find attached sales order ${so.so_number}.`,
        html: `<h3>Sales Order ${so.so_number}</h3><p>Please find your sales order attached.</p><p>Thank you for your business!</p>`,
        attachments: [{
          filename: `SO_${so.so_number}.pdf`,
          content: pdfBuffer
        }]
      });

      if (result.success) {
        res.json({
          success: true,
          message: 'Sales order sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send email'
        });
      }
    } catch (error) {
      logger.error('Failed to email sales order', { 
        error: error.message, 
        institutionId: req.institutionId,
        soId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to send email'
      });
    }
  }

  async cancelSalesOrder(req, res) {
    try {
      const { id: soId } = req.params;
      const { cancellationReason } = req.body;

      if (!cancellationReason) {
        return res.status(400).json({
          success: false,
          error: 'Cancellation reason is required'
        });
      }

      await salesOrderService.cancelSalesOrder(
        req.institutionId,
        soId,
        cancellationReason,
        req.user.userId
      );

      res.json({
        success: true,
        message: 'Sales order cancelled and reserved stock released successfully'
      });
    } catch (error) {
      logger.error('Failed to cancel sales order', {
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
}

module.exports = new SalesOrderController();
