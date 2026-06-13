const putawayService = require('./putaway.service');
const logger = require('../../utils/logger');

class PutawayController {
  async getPendingPutaways(req, res) {
    try {
      const data = await putawayService.getPendingPutaways(req.institutionId, {
        warehouseId: req.query.warehouseId,
      });

      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to get pending putaways', {
        error: error.message,
        institutionId: req.institutionId,
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getPutawayHistory(req, res) {
    try {
      const data = await putawayService.getPutawayHistory(req.institutionId, {
        warehouseId: req.query.warehouseId,
        limit: req.query.limit,
      });

      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to get putaway history', {
        error: error.message,
        institutionId: req.institutionId,
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async completePutaway(req, res) {
    try {
      const result = await putawayService.completePutaway(
        req.institutionId,
        req.body,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        message: 'Putaway completed successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Putaway failed', {
        error: error.message,
        institutionId: req.institutionId,
        userId: req.user?.userId,
        body: req.body,
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new PutawayController();
