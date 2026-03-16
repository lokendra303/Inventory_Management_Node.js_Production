const purchaseOrderService = require('../../services/order/purchaseOrderService');
const vendorService = require('../../services/entity/vendorService');
const poConfirmationService = require('../../services/order/poConfirmationService');
const purchaseOrderPDFService = require('../../services/pdf/purchaseOrderPDFService');
const emailService = require('../../services/emailService');
const logger = require('../../utils/logger');

class PurchaseOrderController {
  async createPurchaseOrder(req, res) {
    try {
      // Ensure we have a valid user ID, or use null if not authenticated
      const userId = req.user?.userId || null;
      
      const poId = await purchaseOrderService.createPurchaseOrder(
        req.institutionId,
        req.body,
        userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Purchase order created successfully',
        data: { poId }
      });
    } catch (error) {
      logger.error('PO creation failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        userId: req.user?.userId || null
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPurchaseOrders(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const filters = {
        status: req.query.status,
        vendorId: req.query.vendorId
      };
      
      const pos = await purchaseOrderService.getPurchaseOrders(req.institutionId, filters, limit, offset);
      
      res.json({
        success: true,
        data: pos,
        pagination: { limit, offset, total: pos.length }
      });
    } catch (error) {
      logger.error('Failed to get purchase orders', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getPurchaseOrder(req, res) {
    try {
      const { id: poId } = req.params;
      const po = await purchaseOrderService.getPurchaseOrder(req.institutionId, poId);
      
      if (!po) {
        return res.status(404).json({
          success: false,
          error: 'Purchase order not found'
        });
      }
      
      res.json({
        success: true,
        data: po
      });
    } catch (error) {
      logger.error('Failed to get purchase order', { 
        error: error.message, 
        institutionId: req.institutionId,
        poId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async createGRN(req, res) {
    try {
      console.log('GRN request body:', JSON.stringify(req.body, null, 2));
      console.log('Institution ID:', req.institutionId);
      console.log('User ID:', req.user?.userId || null);
      
      // Ensure we have a valid user ID, or use null if not authenticated
      const userId = req.user?.userId || null;
      
      const grnId = await purchaseOrderService.createGRN(
        req.institutionId,
        req.body,
        userId
      );
      
      res.status(201).json({
        success: true,
        message: 'GRN created successfully',
        data: { grnId }
      });
    } catch (error) {
      logger.error('GRN creation failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        userId: req.user?.userId || null
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getGRN(req, res) {
    try {
      const { grnId } = req.params;
      const grn = await purchaseOrderService.getGRN(req.institutionId, grnId);
      
      if (!grn) {
        return res.status(404).json({
          success: false,
          error: 'GRN not found'
        });
      }
      
      res.json({
        success: true,
        data: grn
      });
    } catch (error) {
      logger.error('Failed to get GRN', { 
        error: error.message, 
        institutionId: req.institutionId,
        grnId: req.params.grnId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updatePOStatus(req, res) {
    try {
      const { id: poId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Status is required'
        });
      }

      // Always just update status — GRN is created manually via Receive Goods
      await purchaseOrderService.updatePOStatus(req.institutionId, poId, status, req.user.userId);
      
      return res.json({
        success: true,
        message: 'Purchase order status updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update PO status', {
        error: error.message,
        stack: error.stack,
        institutionId: req.institutionId,
        poId: req.params.id
      });
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async confirmPurchaseOrder(req, res) {
    try {
      const { id: poId } = req.params;
      
      const result = await poConfirmationService.processPOConfirmation(
        req.institutionId, 
        poId, 
        req.user.userId
      );
      
      res.json({
        success: true,
        message: 'Purchase order confirmed successfully. Inventory has been updated automatically.',
        data: result
      });
    } catch (error) {
      logger.error('Failed to confirm purchase order', {
        error: error.message,
        institutionId: req.institutionId,
        poId: req.params.id,
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
      const { id: poId } = req.params;
      
      const summary = await poConfirmationService.getConfirmationSummary(
        req.institutionId, 
        poId
      );
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Failed to get confirmation summary', {
        error: error.message,
        institutionId: req.institutionId,
        poId: req.params.id
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getPendingReceipts(req, res) {
    try {
      const { warehouseId } = req.query;
      const pendingReceipts = await purchaseOrderService.getPendingReceipts(req.institutionId, warehouseId);
      
      res.json({
        success: true,
        data: pendingReceipts
      });
    } catch (error) {
      logger.error('Failed to get pending receipts', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Vendor management
  async createVendor(req, res) {
    try {
      const vendorId = await vendorService.createVendor(
        req.institutionId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Vendor created successfully',
        data: { vendorId }
      });
    } catch (error) {
      logger.error('Vendor creation failed', { 
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

  async getVendors(req, res) {
    try {
      const filters = {
        status: req.query.status,
        search: req.query.search
      };
      
      const vendors = await vendorService.getVendors(req.institutionId, filters);
      
      res.json({
        success: true,
        data: vendors
      });
    } catch (error) {
      logger.error('Failed to get vendors', { message: error.message, stack: error.stack, institutionId: req.institutionId });
      const isProd = process.env.NODE_ENV === 'production';
      res.status(500).json({
        success: false,
        error: isProd ? 'Internal server error' : (error.message || 'Unknown error')
      });
    }
  }

  async getVendor(req, res) {
    try {
      const { id: vendorId } = req.params;
      const vendor = await vendorService.getVendor(req.institutionId, vendorId);
      
      if (!vendor) {
        return res.status(404).json({
          success: false,
          error: 'Vendor not found'
        });
      }
      
      res.json({
        success: true,
        data: vendor
      });
    } catch (error) {
      logger.error('Failed to get vendor', { 
        error: error.message, 
        institutionId: req.institutionId,
        vendorId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateVendor(req, res) {
    try {
      const { id: vendorId } = req.params;
      await vendorService.updateVendor(req.institutionId, vendorId, req.body, req.user.userId);
      
      res.json({
        success: true,
        message: 'Vendor updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update vendor', { 
        error: error.message, 
        institutionId: req.institutionId,
        vendorId: req.params.id 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getVendorPerformance(req, res) {
    try {
      const { id: vendorId } = req.params;
      const { startDate, endDate } = req.query;
      
      const performance = await vendorService.getVendorPerformance(
        req.institutionId, 
        vendorId, 
        startDate, 
        endDate
      );
      
      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      logger.error('Failed to get vendor performance', { 
        error: error.message, 
        institutionId: req.institutionId,
        vendorId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async downloadPOPDF(req, res) {
    try {
      const { id: poId } = req.params;
      const po = await purchaseOrderService.getPurchaseOrder(req.institutionId, poId);
      
      if (!po) {
        return res.status(404).json({
          success: false,
          error: 'Purchase order not found'
        });
      }
      
      const pdfBuffer = await purchaseOrderPDFService.generatePDFBuffer(po, req.institutionId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="PO_${po.po_number}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      logger.error('Failed to generate PO PDF', { 
        error: error.message, 
        institutionId: req.institutionId,
        poId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF'
      });
    }
  }

  async updatePurchaseOrder(req, res) {
    try {
      const { id: poId } = req.params;
      const userId = req.user?.userId || null;
      
      await purchaseOrderService.updatePurchaseOrder(
        req.institutionId,
        poId,
        req.body,
        userId
      );
      
      res.json({
        success: true,
        message: 'Purchase order updated successfully'
      });
    } catch (error) {
      logger.error('PO update failed', { 
        error: error.message, 
        institutionId: req.institutionId,
        poId: req.params.id,
        userId: req.user?.userId || null
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async emailPurchaseOrder(req, res) {
    try {
      const { id: poId } = req.params;
      const { to } = req.body;

      if (!to) {
        return res.status(400).json({
          success: false,
          error: 'Recipient email is required'
        });
      }

      const po = await purchaseOrderService.getPurchaseOrder(req.institutionId, poId);
      
      if (!po) {
        return res.status(404).json({
          success: false,
          error: 'Purchase order not found'
        });
      }

      const pdfBuffer = await purchaseOrderPDFService.generatePDFBuffer(po, req.institutionId);
      
      const result = await emailService.sendEmailWithAttachment({
        to,
        subject: `Purchase Order ${po.po_number}`,
        text: `Please find attached purchase order ${po.po_number}.`,
        html: `<h3>Purchase Order ${po.po_number}</h3><p>Please find your purchase order attached.</p><p>Thank you!</p>`,
        attachments: [{
          filename: `PO_${po.po_number}.pdf`,
          content: pdfBuffer
        }]
      });

      if (result.success) {
        res.json({
          success: true,
          message: 'Purchase order sent successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send email'
        });
      }
    } catch (error) {
      logger.error('Failed to email purchase order', { 
        error: error.message, 
        institutionId: req.institutionId,
        poId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to send email'
      });
    }
  }

  async cancelPurchaseOrder(req, res) {
    try {
      const { id: poId } = req.params;
      const { cancellationReason } = req.body;
      const userId = req.user?.userId || null;

      await purchaseOrderService.cancelPurchaseOrder(
        req.institutionId,
        poId,
        cancellationReason,
        userId
      );

      res.json({
        success: true,
        message: 'Purchase order cancelled successfully'
      });
    } catch (error) {
      logger.error('Failed to cancel purchase order', {
        error: error.message,
        institutionId: req.institutionId,
        poId: req.params.id
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new PurchaseOrderController();
