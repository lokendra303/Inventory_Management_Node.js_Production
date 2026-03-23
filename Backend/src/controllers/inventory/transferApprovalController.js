const transferApprovalService = require('../../services/inventory/transferApprovalService');
const logger = require('../../utils/logger');

class TransferApprovalController {
  async requestTransfer(req, res) {
    try {
      const result = await transferApprovalService.requestTransfer(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      logger.error('requestTransfer failed', { error: e.message });
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async getTransferRequests(req, res) {
    try {
      const data = await transferApprovalService.getTransferRequests(req.institutionId, req.query);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async approveTransfer(req, res) {
    try {
      const transferId = await transferApprovalService.approveTransfer(req.institutionId, req.params.requestId, req.user.userId);
      res.json({ success: true, message: 'Transfer approved and executed', data: { transferId } });
    } catch (e) {
      logger.error('approveTransfer failed', { error: e.message });
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async rejectTransfer(req, res) {
    try {
      await transferApprovalService.rejectTransfer(req.institutionId, req.params.requestId, req.body.rejectionReason, req.user.userId);
      res.json({ success: true, message: 'Transfer request rejected' });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async cancelTransferRequest(req, res) {
    try {
      await transferApprovalService.cancelTransferRequest(req.institutionId, req.params.requestId, req.user.userId);
      res.json({ success: true, message: 'Transfer request cancelled' });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }
}

module.exports = new TransferApprovalController();
