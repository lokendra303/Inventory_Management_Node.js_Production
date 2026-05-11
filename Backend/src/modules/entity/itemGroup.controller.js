const itemGroupService = require('./itemGroup.service');
const logger = require('../../utils/logger');

class ItemGroupController {
  async getItemGroups(req, res) {
    try {
      const groups = await itemGroupService.getItemGroups(req.institutionId, {
        activeOnly: req.query.active === 'true',
        search: req.query.search || ''
      });
      res.json({ success: true, data: groups });
    } catch (error) {
      logger.error('Failed to get item groups', {
        error: error.message,
        institutionId: req.institutionId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async createItemGroup(req, res) {
    try {
      const groupId = await itemGroupService.createItemGroup(
        req.institutionId,
        req.body,
        req.user?.userId
      );
      res.status(201).json({
        success: true,
        message: 'Item group created successfully',
        data: { groupId }
      });
    } catch (error) {
      logger.error('Item group creation failed', {
        error: error.message,
        institutionId: req.institutionId,
        userId: req.user?.userId
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateItemGroup(req, res) {
    try {
      await itemGroupService.updateItemGroup(
        req.institutionId,
        req.params.id,
        req.body,
        req.user?.userId
      );
      res.json({ success: true, message: 'Item group updated successfully' });
    } catch (error) {
      logger.error('Item group update failed', {
        error: error.message,
        institutionId: req.institutionId,
        groupId: req.params.id,
        userId: req.user?.userId
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteItemGroup(req, res) {
    try {
      await itemGroupService.deleteItemGroup(
        req.institutionId,
        req.params.id,
        req.user?.userId
      );
      res.json({ success: true, message: 'Item group deleted successfully' });
    } catch (error) {
      logger.error('Item group deletion failed', {
        error: error.message,
        institutionId: req.institutionId,
        groupId: req.params.id,
        userId: req.user?.userId
      });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ItemGroupController();
