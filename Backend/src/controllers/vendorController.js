const vendorService = require('../services/vendorService');
const logger = require('../utils/logger');

class VendorController {
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

  async deleteVendor(req, res) {
    res.status(501).json({ success: false, error: 'Not implemented' });
  }
}

module.exports = new VendorController();