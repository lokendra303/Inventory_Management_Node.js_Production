const purchaseOrderService = require('../services/purchaseOrderService');
const vendorService = require('../services/vendorService');
const logger = require('../utils/logger');

class PurchaseOrderController {
  async createPurchaseOrder(req, res) {
    try {
      const poId = await purchaseOrderService.createPurchaseOrder(
        req.tenantId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Purchase order created successfully',
        data: { poId }
      });
    } catch (error) {
      logger.error('PO creation failed', { 
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

  async getPurchaseOrders(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const filters = {
        status: req.query.status,
        vendorId: req.query.vendorId
      };
      
      const pos = await purchaseOrderService.getPurchaseOrders(req.tenantId, filters, limit, offset);
      
      res.json({
        success: true,
        data: pos,
        pagination: { limit, offset, total: pos.length }
      });
    } catch (error) {
      logger.error('Failed to get purchase orders', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getPurchaseOrder(req, res) {
    try {
      const { id: poId } = req.params;
      const po = await purchaseOrderService.getPurchaseOrder(req.tenantId, poId);
      
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
        tenantId: req.tenantId,
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
      console.log('Tenant ID:', req.tenantId);
      console.log('User ID:', req.user.userId);
      
      const grnId = await purchaseOrderService.createGRN(
        req.tenantId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'GRN created successfully',
        data: { grnId }
      });
    } catch (error) {
      logger.error('GRN creation failed', { 
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

  async getGRN(req, res) {
    try {
      const { grnId } = req.params;
      const grn = await purchaseOrderService.getGRN(req.tenantId, grnId);
      
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
        tenantId: req.tenantId,
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

      // Additional validation (already handled by middleware, but keeping for safety)
      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Status is required'
        });
      }

      await purchaseOrderService.updatePOStatus(req.tenantId, poId, status, req.user.userId);

      res.json({
        success: true,
        message: 'Purchase order status updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update PO status', {
        error: error.message,
        tenantId: req.tenantId,
        poId: req.params.id
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getPendingReceipts(req, res) {
    try {
      const { warehouseId } = req.query;
      const pendingReceipts = await purchaseOrderService.getPendingReceipts(req.tenantId, warehouseId);
      
      res.json({
        success: true,
        data: pendingReceipts
      });
    } catch (error) {
      logger.error('Failed to get pending receipts', { error: error.message, tenantId: req.tenantId });
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
        req.tenantId,
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
        tenantId: req.tenantId,
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
      
      const vendors = await vendorService.getVendors(req.tenantId, filters);
      
      res.json({
        success: true,
        data: vendors
      });
    } catch (error) {
      logger.error('Failed to get vendors', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getVendor(req, res) {
    try {
      const { vendorId } = req.params;
      const vendor = await vendorService.getVendor(req.tenantId, vendorId);
      
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
        tenantId: req.tenantId,
        vendorId: req.params.vendorId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateVendor(req, res) {
    try {
      const { vendorId } = req.params;
      await vendorService.updateVendor(req.tenantId, vendorId, req.body, req.user.userId);
      
      res.json({
        success: true,
        message: 'Vendor updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update vendor', { 
        error: error.message, 
        tenantId: req.tenantId,
        vendorId: req.params.vendorId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getVendorPerformance(req, res) {
    try {
      const { vendorId } = req.params;
      const { startDate, endDate } = req.query;
      
      const performance = await vendorService.getVendorPerformance(
        req.tenantId, 
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
        tenantId: req.tenantId,
        vendorId: req.params.vendorId 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new PurchaseOrderController();