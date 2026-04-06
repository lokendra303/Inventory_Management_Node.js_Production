const itemPriceHistoryService = require('./itemPriceHistory.service');
const logger = require('../../utils/logger');

class ItemPriceHistoryController {
  async getPriceHistory(req, res) {
    try {
      const { id: itemId } = req.params;
      const { priceType, limit, offset } = req.query;

      const history = await itemPriceHistoryService.getPriceHistory(
        req.institutionId,
        itemId,
        { priceType, limit: parseInt(limit) || 50, offset: parseInt(offset) || 0 }
      );

      res.json({ success: true, data: history });
    } catch (error) {
      logger.error('Failed to get price history', { error: error.message, itemId: req.params.id });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

module.exports = new ItemPriceHistoryController();
