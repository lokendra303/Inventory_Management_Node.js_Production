const itemTypeService = require('./itemType.service');
const logger = require('../../utils/logger');

class ItemTypeController {
  async getItemTypes(req, res) {
    try {
      const activeOnly = req.query.active === 'true';
      const types = await itemTypeService.getItemTypes(req.institutionId, { activeOnly });
      res.json({ success: true, data: types });
    } catch (error) {
      logger.error('Failed to get item types', {
        error: error.message,
        institutionId: req.institutionId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async createItemType(req, res) {
    try {
      const typeId = await itemTypeService.createItemType(
        req.institutionId,
        req.body,
        req.user?.userId
      );
      res.status(201).json({
        success: true,
        message: 'Item type created successfully',
        data: { typeId }
      });
    } catch (error) {
      logger.error('Item type creation failed', {
        error: error.message,
        institutionId: req.institutionId,
        userId: req.user?.userId
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteItemType(req, res) {
    try {
      await itemTypeService.deleteItemType(req.institutionId, req.params.id);
      res.json({ success: true, message: 'Item type deleted successfully' });
    } catch (error) {
      logger.error('Item type deletion failed', {
        error: error.message,
        institutionId: req.institutionId,
        typeId: req.params.id
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ItemTypeController();
