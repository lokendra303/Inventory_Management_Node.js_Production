const customerService = require('../services/customerService');
const logger = require('../utils/logger');

class CustomerController {
  async createCustomer(req, res) {
    try {
      const customerId = await customerService.createCustomer(
        req.tenantId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: { customerId }
      });
    } catch (error) {
      logger.error('Customer creation failed', { 
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

  async getCustomers(req, res) {
    try {
      const filters = {
        status: req.query.status,
        search: req.query.search
      };
      
      const customers = await customerService.getCustomers(req.tenantId, filters);
      
      res.json({
        success: true,
        data: customers
      });
    } catch (error) {
      logger.error('Failed to get customers', { message: error.message, stack: error.stack, tenantId: req.tenantId });
      const isProd = process.env.NODE_ENV === 'production';
      res.status(500).json({
        success: false,
        error: isProd ? 'Internal server error' : (error.message || 'Unknown error')
      });
    }
  }

  async getCustomer(req, res) {
    try {
      const { id: customerId } = req.params;
      const customer = await customerService.getCustomer(req.tenantId, customerId);
      
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }
      
      res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      logger.error('Failed to get customer', { 
        error: error.message, 
        tenantId: req.tenantId,
        customerId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateCustomer(req, res) {
    try {
      const { id: customerId } = req.params;
      await customerService.updateCustomer(req.tenantId, customerId, req.body, req.user.userId);
      
      res.json({
        success: true,
        message: 'Customer updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update customer', { 
        error: error.message, 
        tenantId: req.tenantId,
        customerId: req.params.id 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getCustomerPerformance(req, res) {
    try {
      const { id: customerId } = req.params;
      const { startDate, endDate } = req.query;
      
      const performance = await customerService.getCustomerPerformance(
        req.tenantId, 
        customerId, 
        startDate, 
        endDate
      );
      
      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      logger.error('Failed to get customer performance', { 
        error: error.message, 
        tenantId: req.tenantId,
        customerId: req.params.id 
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async addBankDetails(req, res) {
    try {
      const { customerId } = req.params;
      const bankDetailId = await customerService.addCustomerBankDetails(
        req.tenantId,
        customerId,
        req.body
      );

      res.status(201).json({
        success: true,
        message: 'Bank details added successfully',
        data: { bankDetailId }
      });
    } catch (error) {
      logger.error('Failed to add bank details', { 
        error: error.message,
        customerId: req.params.customerId,
        tenantId: req.tenantId
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getBankDetails(req, res) {
    try {
      const { customerId } = req.params;
      const bankDetails = await customerService.getCustomerBankDetails(
        req.tenantId,
        customerId
      );

      res.json({
        success: true,
        data: bankDetails
      });
    } catch (error) {
      logger.error('Failed to get bank details', { 
        error: error.message,
        customerId: req.params.customerId,
        tenantId: req.tenantId
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateBankDetails(req, res) {
    try {
      const { customerId, bankDetailId } = req.params;
      
      await customerService.updateCustomerBankDetails(
        req.tenantId,
        bankDetailId,
        req.body
      );

      res.json({
        success: true,
        message: 'Bank details updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update bank details', { 
        error: error.message,
        bankDetailId: req.params.bankDetailId,
        tenantId: req.tenantId
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteBankDetails(req, res) {
    try {
      const { customerId, bankDetailId } = req.params;

      await customerService.deleteCustomerBankDetails(
        req.tenantId,
        bankDetailId
      );

      res.json({
        success: true,
        message: 'Bank details deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete bank details', { 
        error: error.message,
        bankDetailId: req.params.bankDetailId,
        tenantId: req.tenantId
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new CustomerController();