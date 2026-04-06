const autoPOService = require('./autoPO.service');
const logger = require('../../utils/logger');

class AutoPOController {
  async previewAutoPOs(req, res) {
    try {
      const result = await autoPOService.previewAutoPOs(
        req.institutionId, req.query.warehouseId
      );
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async generateAutoPOs(req, res) {
    try {
      const result = await autoPOService.generatePOsFromReorderSuggestions(
        req.institutionId, req.user.userId,
        { warehouseId: req.body.warehouseId }
      );
      res.status(201).json({ success: true, data: result });
    } catch (e) {
      logger.error('generateAutoPOs failed', { error: e.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: e.message });
    }
  }
}

module.exports = new AutoPOController();
