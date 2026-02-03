const reportsService = require('../services/reportsService');
const logger = require('../utils/logger');

class ReportsController {
  // Inventory Reports
  async getInventoryReport(req, res) {
    try {
      const filters = {
        warehouseId: req.query.warehouseId,
        category: req.query.category
      };
      
      const report = await reportsService.getInventoryReport(req.institutionId, filters);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate inventory report', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
  }

  async getInventoryMovementReport(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        itemId: req.query.itemId
      };
      
      const report = await reportsService.getInventoryMovementReport(req.institutionId, filters);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate inventory movement report', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
  }

  // Purchase Reports
  async getPurchaseReport(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status,
        vendorId: req.query.vendorId
      };
      
      const report = await reportsService.getPurchaseReport(req.institutionId, filters);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate purchase report', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
  }

  async getGRNReport(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };
      
      const report = await reportsService.getGRNReport(req.institutionId, filters);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate GRN report', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
  }

  // Sales Reports
  async getSalesReport(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        status: req.query.status
      };
      
      const report = await reportsService.getSalesReport(req.institutionId, filters);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate sales report', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
  }

  // Financial Reports
  async getProfitLossReport(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };
      
      const report = await reportsService.getProfitLossReport(req.institutionId, filters);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate P&L report', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
  }

  async getInventoryValuationReport(req, res) {
    try {
      const filters = {
        warehouseId: req.query.warehouseId
      };
      
      const report = await reportsService.getInventoryValuationReport(req.institutionId, filters);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate inventory valuation report', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
  }

  // Analytics Reports
  async getTopSellingItems(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };
      
      const report = await reportsService.getTopSellingItems(req.institutionId, filters);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate top selling items report', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
  }

  async getLowStockReport(req, res) {
    try {
      const threshold = parseInt(req.query.threshold) || 10;
      const report = await reportsService.getLowStockReport(req.institutionId, threshold);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate low stock report', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
  }

  async getVendorPerformanceReport(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };
      
      const report = await reportsService.getVendorPerformanceReport(req.institutionId, filters);
      
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to generate vendor performance report', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
  }

  // Dashboard
  async getDashboardSummary(req, res) {
    try {
      const summary = await reportsService.getDashboardSummary(req.institutionId);
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Failed to generate dashboard summary', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Failed to generate summary' });
    }
  }
}

module.exports = new ReportsController();