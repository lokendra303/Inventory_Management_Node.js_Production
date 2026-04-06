const notificationService = require('./notification.service');
const logger = require('../../utils/logger');

class NotificationController {
  async getNotifications(req, res) {
    try {
      const { unreadOnly, limit } = req.query;
      const data = await notificationService.getForUser(
        req.institutionId, req.user.userId,
        { unreadOnly: unreadOnly === 'true', limit: parseInt(limit) || 50 }
      );
      res.json({ success: true, data });
    } catch (e) {
      logger.error('getNotifications failed', { error: e.message });
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async getUnreadCount(req, res) {
    try {
      const count = await notificationService.getUnreadCount(req.institutionId, req.user.userId);
      res.json({ success: true, data: { count } });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  async markRead(req, res) {
    try {
      await notificationService.markRead(req.institutionId, req.user.userId, req.params.notificationId);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async markAllRead(req, res) {
    try {
      await notificationService.markAllRead(req.institutionId, req.user.userId);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }
}

module.exports = new NotificationController();
