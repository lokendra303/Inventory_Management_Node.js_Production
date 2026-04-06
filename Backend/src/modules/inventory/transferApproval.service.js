const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const notificationService = require('../notification/notification.service');

class TransferApprovalService {
  async requestTransfer(institutionId, data, userId) {
    const { itemId, fromWarehouseId, toWarehouseId, quantity, reason } = data;

    if (fromWarehouseId === toWarehouseId) throw new Error('Source and destination warehouses cannot be the same');

    // Validate item and warehouses are active
    const [item] = await db.query(
      'SELECT name FROM items WHERE id=? AND status=\'active\'', [itemId]
    );
    if (!item) throw new Error('Item not found or inactive');

    const [fromWh] = await db.query(
      'SELECT name FROM warehouses WHERE id=? AND status=\'active\'', [fromWarehouseId]
    );
    if (!fromWh) throw new Error('Source warehouse not found or inactive');

    const [toWh] = await db.query(
      'SELECT name FROM warehouses WHERE id=? AND status=\'active\'', [toWarehouseId]
    );
    if (!toWh) throw new Error('Destination warehouse not found or inactive');

    // Validate stock availability
    const [proj] = await db.query(
      'SELECT quantity_available FROM inventory_projections WHERE institution_id=? AND item_id=? AND warehouse_id=?',
      [institutionId, itemId, fromWarehouseId]
    );
    if (!proj || parseFloat(proj.quantity_available) < parseFloat(quantity)) {
      throw new Error(`Insufficient stock: available ${proj?.quantity_available || 0}, requested ${quantity}`);
    }

    const id = uuidv4();
    const transferNumber = `TR-${Date.now()}`;

    await db.query(
      `INSERT INTO transfer_requests
       (id, institution_id, transfer_number, item_id, from_warehouse_id, to_warehouse_id, quantity, reason, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, institutionId, transferNumber, itemId, fromWarehouseId, toWarehouseId, quantity, reason || null, userId]
    );

    await notificationService.notifyTransferRequest(
      institutionId, transferNumber,
      item.name, quantity,
      fromWh.name, toWh.name
    );

    // Get names for notification — already fetched above

    logger.info('Transfer request created', { id, institutionId, transferNumber, userId });
    return { id, transferNumber };
  }

  async approveTransfer(institutionId, requestId, userId) {
    const [req] = await db.query(
      'SELECT * FROM transfer_requests WHERE institution_id=? AND id=?',
      [institutionId, requestId]
    );
    if (!req) throw new Error('Transfer request not found');
    if (req.status !== 'pending') throw new Error(`Cannot approve request with status '${req.status}'`);

    // Execute the actual transfer
    const inventoryService = require('./inventory.service');
    const transferId = await inventoryService.transferStock(institutionId, {
      itemId: req.item_id,
      fromWarehouseId: req.from_warehouse_id,
      toWarehouseId: req.to_warehouse_id,
      quantity: req.quantity
    }, userId);

    await db.query(
      `UPDATE transfer_requests SET status='approved', approved_by=?, approved_at=NOW(), transfer_id=?, updated_at=NOW()
       WHERE id=?`,
      [userId, transferId, requestId]
    );

    await notificationService.broadcast(
      institutionId, 'transfer_request',
      `Transfer Approved: ${req.transfer_number}`,
      `Transfer request ${req.transfer_number} has been approved and executed`,
      'transfer_request', requestId
    );

    logger.info('Transfer request approved', { requestId, transferId, institutionId, userId });
    return transferId;
  }

  async rejectTransfer(institutionId, requestId, rejectionReason, userId) {
    if (!rejectionReason?.trim()) throw new Error('Rejection reason is required');

    const result = await db.query(
      `UPDATE transfer_requests SET status='rejected', approved_by=?, approved_at=NOW(), rejection_reason=?, updated_at=NOW()
       WHERE institution_id=? AND id=? AND status='pending'`,
      [userId, rejectionReason.trim(), institutionId, requestId]
    );
    if (result.affectedRows === 0) throw new Error('Request not found or already processed');

    logger.info('Transfer request rejected', { requestId, institutionId, userId });
    return true;
  }

  async getTransferRequests(institutionId, filters = {}) {
    let query = `
      SELECT tr.*, i.name as item_name, i.sku,
             fw.name as from_warehouse_name, tw.name as to_warehouse_name,
             CONCAT(u.first_name, ' ', COALESCE(u.last_name,'')) as requested_by_name
      FROM transfer_requests tr
      JOIN items i ON tr.item_id = i.id AND i.status = 'active'
      JOIN warehouses fw ON tr.from_warehouse_id = fw.id AND fw.status = 'active'
      JOIN warehouses tw ON tr.to_warehouse_id = tw.id AND tw.status = 'active'
      LEFT JOIN institution_users u ON tr.requested_by = u.id
      WHERE tr.institution_id = ?`;
    const params = [institutionId];

    if (filters.status) { query += ' AND tr.status = ?'; params.push(filters.status); }
    query += ' ORDER BY tr.created_at DESC';
    return db.query(query, params);
  }

  async cancelTransferRequest(institutionId, requestId, userId) {
    const result = await db.query(
      `UPDATE transfer_requests SET status='cancelled', updated_at=NOW()
       WHERE institution_id=? AND id=? AND status='pending' AND requested_by=?`,
      [institutionId, requestId, userId]
    );
    if (result.affectedRows === 0) throw new Error('Request not found or cannot be cancelled');
    return true;
  }
}

module.exports = new TransferApprovalService();
