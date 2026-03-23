const vendorPriceListService = require('../../services/entity/vendorPriceListService');
const logger = require('../../utils/logger');

class VendorPriceListController {
  async upsertPrice(req, res) {
    try {
      const id = await vendorPriceListService.upsertPrice(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, data: { id } });
    } catch (e) {
      logger.error('upsertPrice failed', { error: e.message });
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async getVendorPrices(req, res) {
    try {
      const data = await vendorPriceListService.getVendorPrices(req.institutionId, req.params.vendorId);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getItemVendorPrices(req, res) {
    try {
      const data = await vendorPriceListService.getItemVendorPrices(req.institutionId, req.params.itemId);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getBestPrice(req, res) {
    try {
      const data = await vendorPriceListService.getBestPrice(req.institutionId, req.params.vendorId, req.params.itemId);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async deletePrice(req, res) {
    try {
      await vendorPriceListService.deletePrice(req.institutionId, req.params.priceId, req.user.userId);
      res.json({ success: true, message: 'Price deleted' });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }
}

module.exports = new VendorPriceListController();
