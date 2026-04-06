const purchaseReturnService = require('./purchaseReturn.service');
const logger = require('../../utils/logger');

class PurchaseReturnController {
  async createPurchaseReturn(req, res) {
    try {
      const result = await purchaseReturnService.createPurchaseReturn(
        req.institutionId, req.body, req.user.userId
      );
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      logger.error('createPurchaseReturn failed', { error: e.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async getPurchaseReturns(req, res) {
    try {
      const data = await purchaseReturnService.getPurchaseReturns(req.institutionId, req.query);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getPurchaseReturn(req, res) {
    try {
      const data = await purchaseReturnService.getPurchaseReturn(
        req.institutionId, req.params.returnId
      );
      if (!data) return res.status(404).json({ success: false, error: 'Purchase return not found' });
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async confirmPurchaseReturn(req, res) {
    try {
      const result = await purchaseReturnService.confirmPurchaseReturn(
        req.institutionId, req.params.returnId, req.user.userId
      );
      res.json({ success: true, message: 'Purchase return confirmed', data: result });
    } catch (e) {
      logger.error('confirmPurchaseReturn failed', { error: e.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async cancelPurchaseReturn(req, res) {
    try {
      await purchaseReturnService.cancelPurchaseReturn(
        req.institutionId, req.params.returnId, req.user.userId
      );
      res.json({ success: true, message: 'Purchase return cancelled' });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }
}

module.exports = new PurchaseReturnController();
