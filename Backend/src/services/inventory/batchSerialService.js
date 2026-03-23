const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

class BatchSerialService {
  // ─── BATCH ───────────────────────────────────────────────

  async createBatch(institutionId, data, userId) {
    const {
      itemId, warehouseId, batchNumber, lotNumber,
      manufactureDate, expiryDate, quantityReceived,
      unitCost, grnId, poId, notes
    } = data;

    const id = uuidv4();

    // Validate item and warehouse are active
    const [item] = await db.query('SELECT id FROM items WHERE id=? AND institution_id=? AND status=\'active\'', [itemId, institutionId]);
    if (!item) throw new Error('Item not found or inactive');
    const [wh] = await db.query('SELECT id FROM warehouses WHERE id=? AND institution_id=? AND status=\'active\'', [warehouseId, institutionId]);
    if (!wh) throw new Error('Warehouse not found or inactive');

    await db.query(
      `INSERT INTO item_batches
       (id, institution_id, item_id, warehouse_id, batch_number,
        manufacture_date, expiry_date, quantity_received, quantity_remaining,
        unit_cost, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [id, institutionId, itemId, warehouseId, batchNumber,
       manufactureDate || null, expiryDate || null, quantityReceived, quantityReceived,
       unitCost || 0]
    );

    // Auto-create expiry alert if expiry date is within 90 days
    if (expiryDate) {
      await this._checkAndCreateExpiryAlert(institutionId, itemId, warehouseId, id, expiryDate, quantityReceived);
    }

    logger.info('Batch created', { id, institutionId, itemId, batchNumber, userId });
    return id;
  }

  async getBatches(institutionId, filters = {}) {
    let query = `
      SELECT b.*, i.name as item_name, i.sku, w.name as warehouse_name
      FROM item_batches b
      JOIN items i ON b.item_id = i.id
      JOIN warehouses w ON b.warehouse_id = w.id
      WHERE b.institution_id = ? AND i.status = 'active' AND w.status = 'active'`;
    const params = [institutionId];

    if (filters.itemId)      { query += ' AND b.item_id = ?';      params.push(filters.itemId); }
    if (filters.warehouseId) { query += ' AND b.warehouse_id = ?'; params.push(filters.warehouseId); }
    if (filters.status)      { query += ' AND b.status = ?';       params.push(filters.status); }
    if (filters.expiringDays) {
      query += ' AND b.expiry_date IS NOT NULL AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)';
      params.push(parseInt(filters.expiringDays));
    }

    query += ' ORDER BY b.expiry_date ASC, b.created_at DESC';
    // Note: item_batches has created_at
    return db.query(query, params);
  }

  async consumeBatch(institutionId, batchId, quantity, userId) {
    const rows = await db.query(
      'SELECT * FROM item_batches WHERE institution_id = ? AND id = ?',
      [institutionId, batchId]
    );
    if (!rows.length) throw new Error('Batch not found');

    const batch = rows[0];
    const available = parseFloat(batch.quantity_remaining);
    const qty = parseFloat(quantity);

    if (qty > available) throw new Error(`Insufficient batch quantity: available ${available}, requested ${qty}`);

    const newAvailable = available - qty;
    const newStatus = newAvailable <= 0 ? 'consumed' : batch.status;

    await db.query(
      'UPDATE item_batches SET quantity_remaining = ?, status = ? WHERE id = ?',
      [newAvailable, newStatus, batchId]
    );

    logger.info('Batch consumed', { batchId, quantity, institutionId, userId });
    return true;
  }

  async updateBatchStatus(institutionId, batchId, status, userId) {
    const result = await db.query(
      'UPDATE item_batches SET status = ? WHERE institution_id = ? AND id = ?',
      [status, institutionId, batchId]
    );
    if (result.affectedRows === 0) throw new Error('Batch not found');
    logger.info('Batch status updated', { batchId, status, institutionId, userId });
    return true;
  }

  // ─── SERIAL ──────────────────────────────────────────────

  async createSerials(institutionId, data, userId) {
    const { itemId, warehouseId, serialNumbers, batchId, unitCost, grnId, receivedDate } = data;

    if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      throw new Error('serialNumbers array is required');
    }

    // Validate item and warehouse are active
    const [item] = await db.query('SELECT id FROM items WHERE id=? AND institution_id=? AND status=\'active\'', [itemId, institutionId]);
    if (!item) throw new Error('Item not found or inactive');
    const [wh] = await db.query('SELECT id FROM warehouses WHERE id=? AND institution_id=? AND status=\'active\'', [warehouseId, institutionId]);
    if (!wh) throw new Error('Warehouse not found or inactive');

    const created = [];
    for (const sn of serialNumbers) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO item_serials
         (id, institution_id, item_id, warehouse_id, serial_number, batch_id, received_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, institutionId, itemId, warehouseId, sn.trim(), batchId || null, receivedDate || null]
      );
      created.push(id);
    }

    logger.info('Serials created', { count: created.length, institutionId, itemId, userId });
    return created;
  }

  async getSerials(institutionId, filters = {}) {
    let query = `
      SELECT s.*, i.name as item_name, i.sku, w.name as warehouse_name
      FROM item_serials s
      JOIN items i ON s.item_id = i.id
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.institution_id = ? AND i.status = 'active'`;
    const params = [institutionId];

    if (filters.itemId)       { query += ' AND s.item_id = ?';       params.push(filters.itemId); }
    if (filters.warehouseId)  { query += ' AND s.warehouse_id = ?';  params.push(filters.warehouseId); }
    if (filters.status)       { query += ' AND s.status = ?';        params.push(filters.status); }
    if (filters.serialNumber) { query += ' AND s.serial_number LIKE ?'; params.push(`%${filters.serialNumber}%`); }

    query += ' ORDER BY s.received_date DESC';
    return db.query(query, params);
  }

  async updateSerialStatus(institutionId, serialId, status, soId, userId) {
    const updates = ['status = ?'];
    const params = [status];

    if (status === 'sold') {
      updates.push('sold_date = CURDATE()', 'customer_reference = ?');
      params.push(soId || null);
    }
    if (status === 'in_stock') {
      updates.push('sold_date = NULL', 'customer_reference = NULL');
    }

    params.push(institutionId, serialId);
    const result = await db.query(
      `UPDATE item_serials SET ${updates.join(', ')} WHERE institution_id = ? AND id = ?`,
      params
    );
    if (result.affectedRows === 0) throw new Error('Serial not found');
    return true;
  }

  // ─── EXPIRY ALERTS ───────────────────────────────────────

  async _checkAndCreateExpiryAlert(institutionId, itemId, warehouseId, batchId, expiryDate, quantity) {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (daysToExpiry > 90) return; // Only alert within 90 days

    await db.query(
      `INSERT INTO expiry_alerts
       (id, institution_id, item_id, warehouse_id, batch_id, expiry_date, days_to_expiry, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE days_to_expiry = ?, quantity = ?, status = 'active', updated_at = NOW()`,
      [uuidv4(), institutionId, itemId, warehouseId, batchId, expiryDate, daysToExpiry, quantity,
       daysToExpiry, quantity]
    );
  }

  async getExpiryAlerts(institutionId, filters = {}) {
    let query = `
      SELECT ea.*, i.name as item_name, i.sku, w.name as warehouse_name,
             b.batch_number
      FROM expiry_alerts ea
      JOIN items i ON ea.item_id = i.id
      JOIN warehouses w ON ea.warehouse_id = w.id
      LEFT JOIN item_batches b ON ea.batch_id = b.id
      WHERE ea.institution_id = ? AND i.status = 'active' AND w.status = 'active'`;
    const params = [institutionId];

    if (filters.status) { query += ' AND ea.status = ?'; params.push(filters.status); }
    else                { query += " AND ea.status != 'expired'"; }

    query += ' ORDER BY ea.expiry_date ASC';
    return db.query(query, params);
  }

  async acknowledgeExpiryAlert(institutionId, alertId, userId) {
    const result = await db.query(
      `UPDATE expiry_alerts SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = NOW()
       WHERE institution_id = ? AND id = ?`,
      [userId, institutionId, alertId]
    );
    if (result.affectedRows === 0) throw new Error('Alert not found');
    return true;
  }

  // Called by a scheduled job / cron
  async refreshExpiryAlerts(institutionId) {
    const batches = await db.query(
      `SELECT id, item_id, warehouse_id, expiry_date, quantity_remaining
       FROM item_batches
       WHERE institution_id = ? AND status = 'active' AND expiry_date IS NOT NULL
         AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)`,
      [institutionId]
    );

    for (const b of batches) {
      await this._checkAndCreateExpiryAlert(
        institutionId, b.item_id, b.warehouse_id, b.id, b.expiry_date, b.quantity_remaining
      );
    }

    // Mark past-expiry alerts
    await db.query(
      `UPDATE expiry_alerts SET status = 'expired'
       WHERE institution_id = ? AND expiry_date < CURDATE() AND status = 'active'`,
      [institutionId]
    );

    return batches.length;
  }
}

module.exports = new BatchSerialService();
