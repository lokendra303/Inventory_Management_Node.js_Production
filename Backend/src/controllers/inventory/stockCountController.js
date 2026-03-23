const stockCountService = require('../../services/inventory/stockCountService');
const logger = require('../../utils/logger');

class StockCountController {
  async createStockCount(req, res) {
    try {
      const result = await stockCountService.createStockCount(
        req.institutionId, req.body, req.user.userId
      );
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      logger.error('createStockCount failed', { error: e.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async getStockCounts(req, res) {
    try {
      const data = await stockCountService.getStockCounts(req.institutionId, req.query);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getStockCount(req, res) {
    try {
      const data = await stockCountService.getStockCount(req.institutionId, req.params.countId);
      if (!data) return res.status(404).json({ success: false, error: 'Stock count not found' });
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async submitCount(req, res) {
    try {
      await stockCountService.submitCount(
        req.institutionId, req.params.countId, req.body.lines, req.user.userId
      );
      res.json({ success: true, message: 'Count submitted' });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async approveAndPost(req, res) {
    try {
      await stockCountService.approveAndPost(
        req.institutionId, req.params.countId, req.user.userId
      );
      res.json({ success: true, message: 'Stock count approved and inventory updated' });
    } catch (e) {
      logger.error('approveAndPost failed', { error: e.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async cancelStockCount(req, res) {
    try {
      await stockCountService.cancelStockCount(
        req.institutionId, req.params.countId, req.user.userId
      );
      res.json({ success: true, message: 'Stock count cancelled' });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async getInventoryAgingReport(req, res) {
    try {
      const data = await stockCountService.getInventoryAgingReport(
        req.institutionId, req.query.warehouseId
      );
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }
}

module.exports = new StockCountController();
