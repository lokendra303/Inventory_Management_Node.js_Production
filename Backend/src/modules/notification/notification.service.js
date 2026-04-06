const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

class NotificationService {
  async create(institutionId, { userId = null, type, title, message, referenceType, referenceId }) {
    const id = uuidv4();
    await db.query(
      `INSERT INTO notifications (id, institution_id, user_id, type, title, message, reference_type, reference_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, institutionId, userId, type, title, message, referenceType || null, referenceId || null]
    );
    return id;
  }

  async broadcast(institutionId, type, title, message, referenceType = null, referenceId = null) {
    return this.create(institutionId, { userId: null, type, title, message, referenceType, referenceId });
  }

  async getForUser(institutionId, userId, { unreadOnly = false, limit = 50 } = {}) {
    let query = `
      SELECT * FROM notifications
      WHERE institution_id = ? AND (user_id = ? OR user_id IS NULL)`;
    const params = [institutionId, userId];
    if (unreadOnly) query += ' AND is_read = 0';
    query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)}`;
    return db.query(query, params);
  }

  async getUnreadCount(institutionId, userId) {
    const rows = await db.query(
      'SELECT COUNT(*) as cnt FROM notifications WHERE institution_id=? AND (user_id=? OR user_id IS NULL) AND is_read=0',
      [institutionId, userId]
    );
    return parseInt(rows[0]?.cnt || 0);
  }

  async markRead(institutionId, userId, notificationId) {
    await db.query(
      'UPDATE notifications SET is_read=1, read_at=NOW() WHERE institution_id=? AND id=? AND (user_id=? OR user_id IS NULL)',
      [institutionId, notificationId, userId]
    );
    return true;
  }

  async markAllRead(institutionId, userId) {
    await db.query(
      'UPDATE notifications SET is_read=1, read_at=NOW() WHERE institution_id=? AND (user_id=? OR user_id IS NULL) AND is_read=0',
      [institutionId, userId]
    );
    return true;
  }

  async notifyLowStock(institutionId, itemName, warehouseName, currentStock, reorderLevel) {
    return this.broadcast(
      institutionId, 'low_stock',
      `Low Stock: ${itemName}`,
      `${itemName} at ${warehouseName} is below reorder level. Current: ${currentStock}, Reorder at: ${reorderLevel}`,
      'inventory', null
    );
  }

  async notifyExpiry(institutionId, itemName, batchNumber, expiryDate, daysLeft) {
    return this.broadcast(
      institutionId, 'expiry',
      `Expiring Soon: ${itemName}`,
      `Batch ${batchNumber} of ${itemName} expires on ${expiryDate} (${daysLeft} days remaining)`,
      'batch', null
    );
  }

  async notifyTransferRequest(institutionId, transferNumber, itemName, qty, fromWh, toWh) {
    return this.broadcast(
      institutionId, 'transfer_request',
      `Transfer Approval Required: ${transferNumber}`,
      `Transfer of ${qty} units of ${itemName} from ${fromWh} to ${toWh} requires approval`,
      'transfer_request', null
    );
  }
}

module.exports = new NotificationService();
