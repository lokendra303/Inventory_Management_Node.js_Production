const batchSerialService = require('../../services/inventory/batchSerialService');
const logger = require('../../utils/logger');

class BatchSerialController {
  // ─── BATCH ───────────────────────────────────────────────
  async createBatch(req, res) {
    try {
      const id = await batchSerialService.createBatch(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, data: { id } });
    } catch (e) {
      logger.error('createBatch failed', { error: e.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async getBatches(req, res) {
    try {
      const data = await batchSerialService.getBatches(req.institutionId, req.query);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async consumeBatch(req, res) {
    try {
      await batchSerialService.consumeBatch(
        req.institutionId, req.params.batchId, req.body.quantity, req.user.userId
      );
      res.json({ success: true, message: 'Batch consumed' });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async updateBatchStatus(req, res) {
    try {
      await batchSerialService.updateBatchStatus(
        req.institutionId, req.params.batchId, req.body.status, req.user.userId
      );
      res.json({ success: true, message: 'Batch status updated' });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  // ─── SERIAL ──────────────────────────────────────────────
  async createSerials(req, res) {
    try {
      const ids = await batchSerialService.createSerials(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, data: { ids, count: ids.length } });
    } catch (e) {
      logger.error('createSerials failed', { error: e.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async getSerials(req, res) {
    try {
      const data = await batchSerialService.getSerials(req.institutionId, req.query);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async updateSerialStatus(req, res) {
    try {
      await batchSerialService.updateSerialStatus(
        req.institutionId, req.params.serialId,
        req.body.status, req.body.soId, req.user.userId
      );
      res.json({ success: true, message: 'Serial status updated' });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  // ─── EXPIRY ALERTS ───────────────────────────────────────
  async getExpiryAlerts(req, res) {
    try {
      const data = await batchSerialService.getExpiryAlerts(req.institutionId, req.query);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async acknowledgeExpiryAlert(req, res) {
    try {
      await batchSerialService.acknowledgeExpiryAlert(
        req.institutionId, req.params.alertId, req.user.userId
      );
      res.json({ success: true, message: 'Alert acknowledged' });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async refreshExpiryAlerts(req, res) {
    try {
      const count = await batchSerialService.refreshExpiryAlerts(req.institutionId);
      res.json({ success: true, data: { processed: count } });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }
}

module.exports = new BatchSerialController();
