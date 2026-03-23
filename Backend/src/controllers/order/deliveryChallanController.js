const deliveryChallanService = require('../../services/order/deliveryChallanService');
const logger = require('../../utils/logger');

class DeliveryChallanController {
  async createChallan(req, res) {
    try {
      const result = await deliveryChallanService.createChallan(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      logger.error('createChallan failed', { error: e.message });
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async getChallans(req, res) {
    try {
      const data = await deliveryChallanService.getChallans(req.institutionId, req.query);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getChallan(req, res) {
    try {
      const data = await deliveryChallanService.getChallan(req.institutionId, req.params.challanId);
      if (!data) return res.status(404).json({ success: false, error: 'Challan not found' });
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async updateStatus(req, res) {
    try {
      await deliveryChallanService.updateStatus(req.institutionId, req.params.challanId, req.body.status, req.user.userId);
      res.json({ success: true, message: 'Status updated' });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async convertToInvoice(req, res) {
    try {
      const invoiceId = await deliveryChallanService.convertToInvoice(req.institutionId, req.params.challanId, req.user.userId);
      res.json({ success: true, message: 'Challan converted to invoice', data: { invoiceId } });
    } catch (e) {
      logger.error('convertToInvoice failed', { error: e.message });
      res.status(400).json({ success: false, error: e.message });
    }
  }
}

module.exports = new DeliveryChallanController();
