const analyticsService = require('./analytics.service');
const valuationService = require('../inventory/valuation.service');const logger = require('../../utils/logger');

class AnalyticsController {
  async getABCAnalysis(req, res) {
    try {
      const data = await analyticsService.getABCAnalysis(req.institutionId, req.query);
      res.json({ success: true, data });
    } catch (e) {
      logger.error('getABCAnalysis failed', { error: e.message });
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getSlowMovingStock(req, res) {
    try {
      const days = parseInt(req.query.days) || 90;
      const data = await analyticsService.getSlowMovingStock(req.institutionId, days);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getDeadStock(req, res) {
    try {
      const data = await analyticsService.getDeadStock(req.institutionId);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getDemandForecast(req, res) {
    try {
      const { itemId, warehouseId } = req.params;
      const data = await analyticsService.getDemandForecast(req.institutionId, itemId, warehouseId);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getProperProfitLoss(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const data = await analyticsService.getProperProfitLoss(req.institutionId, startDate, endDate);
      res.json({ success: true, data });
    } catch (e) {
      logger.error('getProperProfitLoss failed', { error: e.message });
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getValuationReport(req, res) {
    try {
      const data = await valuationService.getValuationReport(req.institutionId, req.query.warehouseId);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getItemValuation(req, res) {
    try {
      const { itemId, warehouseId } = req.params;
      const data = await valuationService.getItemValuation(req.institutionId, itemId, warehouseId);
      if (!data) return res.status(404).json({ success: false, error: 'No valuation data found' });
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }
}

module.exports = new AnalyticsController();
