const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

const BATCH_STATUSES = ['active', 'expired', 'damaged', 'recalled'];
const SERIAL_STATUSES = ['available', 'reserved', 'sold', 'damaged', 'returned'];

class BatchSerialService {
  // ─── BATCH ───────────────────────────────────────────────

  async createBatch(institutionId, data, userId) {
    const {
      itemId, warehouseId, batchNumber,
      manufactureDate, expiryDate, quantityReceived,
      unitCost
    } = data;
    const normalizedBatchNumber = String(batchNumber || '').trim().toUpperCase();
    if (!normalizedBatchNumber) throw new Error('Batch number is required');

    const qtyReceived = parseFloat(quantityReceived);
    if (!Number.isFinite(qtyReceived) || qtyReceived <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    const [item] = await db.query(
      'SELECT id FROM items WHERE id=? AND institution_id=? AND status=\'active\'',
      [itemId, institutionId]
    );
    if (!item) throw new Error('Item not found or inactive');

    const [wh] = await db.query(
      'SELECT id FROM warehouses WHERE id=? AND institution_id=? AND status=\'active\'',
      [warehouseId, institutionId]
    );
    if (!wh) throw new Error('Warehouse not found or inactive');

    const existing = await db.query(
      `SELECT id FROM item_batches
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND batch_number = ?`,
      [institutionId, itemId, warehouseId, normalizedBatchNumber]
    );
    if (existing.length > 0) {
      throw new Error(`Batch "${normalizedBatchNumber}" already exists for this item in this warehouse`);
    }

    const id = uuidv4();

    try {
      await db.query(
        `INSERT INTO item_batches
         (id, institution_id, item_id, warehouse_id, batch_number,
          manufacture_date, expiry_date, quantity_received, quantity_remaining,
          unit_cost, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [id, institutionId, itemId, warehouseId, normalizedBatchNumber,
          manufactureDate || null, expiryDate || null, qtyReceived, qtyReceived,
          unitCost || 0]
      );
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error(`Batch "${normalizedBatchNumber}" already exists for this item in this warehouse`);
      }
      throw error;
    }

    if (expiryDate) {
      await this._checkAndCreateExpiryAlert(institutionId, itemId, warehouseId, id, expiryDate, qtyReceived);
    }

    logger.info('Batch created', { id, institutionId, itemId, batchNumber: normalizedBatchNumber, userId });
    return id;
  }

  async getBatches(institutionId, filters = {}) {
    let query = `
      SELECT b.*,
             b.quantity_remaining AS quantity_available,
             i.name AS item_name, i.sku, w.name AS warehouse_name
      FROM item_batches b
      JOIN items i ON b.item_id = i.id
      JOIN warehouses w ON b.warehouse_id = w.id
      WHERE b.institution_id = ? AND i.status = 'active' AND w.status = 'active'`;
    const params = [institutionId];

    if (filters.itemId) {
      query += ' AND b.item_id = ?';
      params.push(filters.itemId);
    }
    if (filters.warehouseId) {
      query += ' AND b.warehouse_id = ?';
      params.push(filters.warehouseId);
    }
    if (filters.status) {
      query += ' AND b.status = ?';
      params.push(filters.status);
    }
    if (filters.batchNumber) {
      query += ' AND b.batch_number LIKE ?';
      params.push(`%${String(filters.batchNumber).trim().toUpperCase()}%`);
    }
    if (filters.hasStock === 'true') {
      query += ' AND b.quantity_remaining > 0';
    }
    if (filters.expiringDays) {
      query += ' AND b.expiry_date IS NOT NULL AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)';
      params.push(parseInt(filters.expiringDays, 10));
    }

    query += ' ORDER BY b.expiry_date ASC, b.created_at DESC';
    return db.query(query, params);
  }

  async consumeBatch(institutionId, batchId, quantity, userId) {
    const rows = await db.query(
      'SELECT * FROM item_batches WHERE institution_id = ? AND id = ?',
      [institutionId, batchId]
    );
    if (!rows.length) throw new Error('Batch not found');

    const batch = rows[0];
    if (batch.status !== 'active') {
      throw new Error(`Batch is ${batch.status} and cannot be consumed`);
    }

    const available = parseFloat(batch.quantity_remaining);
    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    if (qty > available) {
      throw new Error(`Insufficient batch quantity: available ${available}, requested ${qty}`);
    }

    const newAvailable = available - qty;

    await db.query(
      'UPDATE item_batches SET quantity_remaining = ? WHERE id = ?',
      [newAvailable, batchId]
    );

    if (batch.expiry_date) {
      await this._checkAndCreateExpiryAlert(
        institutionId, batch.item_id, batch.warehouse_id, batchId, batch.expiry_date, newAvailable
      );
    }

    logger.info('Batch consumed', { batchId, quantity: qty, remaining: newAvailable, institutionId, userId });
    return { quantityRemaining: newAvailable };
  }

  async updateBatchDates(institutionId, batchId, data, userId) {
    const rows = await db.query(
      'SELECT * FROM item_batches WHERE institution_id = ? AND id = ?',
      [institutionId, batchId]
    );
    if (!rows.length) throw new Error('Batch not found');

    const batch = rows[0];
    const manufactureDate = data.manufactureDate || null;
    const expiryDate = data.expiryDate || null;

    if (manufactureDate && expiryDate && new Date(manufactureDate) > new Date(expiryDate)) {
      throw new Error('Manufacture date cannot be after expiry date');
    }

    await db.query(
      `UPDATE item_batches
       SET manufacture_date = ?, expiry_date = ?
       WHERE institution_id = ? AND id = ?`,
      [manufactureDate, expiryDate, institutionId, batchId]
    );

    if (expiryDate) {
      await this._checkAndCreateExpiryAlert(
        institutionId,
        batch.item_id,
        batch.warehouse_id,
        batchId,
        expiryDate,
        parseFloat(batch.quantity_remaining || 0)
      );
    } else {
      await db.query(
        `UPDATE expiry_alerts SET status = 'expired', updated_at = NOW()
         WHERE institution_id = ? AND batch_id = ? AND status = 'active'`,
        [institutionId, batchId]
      );
    }

    logger.info('Batch dates updated', { batchId, manufactureDate, expiryDate, institutionId, userId });
    return true;
  }

  async updateBatchStatus(institutionId, batchId, status, userId) {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    if (!BATCH_STATUSES.includes(normalizedStatus)) {
      throw new Error(`Invalid batch status. Allowed: ${BATCH_STATUSES.join(', ')}`);
    }

    const result = await db.query(
      'UPDATE item_batches SET status = ? WHERE institution_id = ? AND id = ?',
      [normalizedStatus, institutionId, batchId]
    );
    if (result.affectedRows === 0) throw new Error('Batch not found');

    if (normalizedStatus === 'expired') {
      await db.query(
        `UPDATE expiry_alerts SET status = 'expired'
         WHERE institution_id = ? AND batch_id = ? AND status = 'active'`,
        [institutionId, batchId]
      );
    }

    logger.info('Batch status updated', { batchId, status: normalizedStatus, institutionId, userId });
    return true;
  }

  // ─── SERIAL ──────────────────────────────────────────────

  async createSerials(institutionId, data, userId) {
    const { itemId, warehouseId, serialNumbers, batchId, receivedDate } = data;

    if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      throw new Error('serialNumbers array is required');
    }

    const [item] = await db.query(
      'SELECT id FROM items WHERE id=? AND institution_id=? AND status=\'active\'',
      [itemId, institutionId]
    );
    if (!item) throw new Error('Item not found or inactive');

    const [wh] = await db.query(
      'SELECT id FROM warehouses WHERE id=? AND institution_id=? AND status=\'active\'',
      [warehouseId, institutionId]
    );
    if (!wh) throw new Error('Warehouse not found or inactive');

    if (batchId) {
      const [batch] = await db.query(
        'SELECT id FROM item_batches WHERE institution_id = ? AND id = ? AND item_id = ? AND warehouse_id = ?',
        [institutionId, batchId, itemId, warehouseId]
      );
      if (!batch) throw new Error('Batch not found for this item and warehouse');
    }

    const created = [];
    for (const sn of serialNumbers) {
      const serialNumber = String(sn || '').trim();
      if (!serialNumber) continue;

      const id = uuidv4();
      try {
        await db.query(
          `INSERT INTO item_serials
           (id, institution_id, item_id, warehouse_id, serial_number, batch_id, received_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, institutionId, itemId, warehouseId, serialNumber, batchId || null, receivedDate || null]
        );
        created.push(id);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          throw new Error(`Serial number "${serialNumber}" already exists for this item`);
        }
        throw error;
      }
    }

    if (created.length === 0) {
      throw new Error('No valid serial numbers provided');
    }

    logger.info('Serials created', { count: created.length, institutionId, itemId, userId });
    return created;
  }

  async getSerials(institutionId, filters = {}) {
    let query = `
      SELECT s.*, i.name AS item_name, i.sku, w.name AS warehouse_name, b.batch_number
      FROM item_serials s
      JOIN items i ON s.item_id = i.id
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      LEFT JOIN item_batches b ON s.batch_id = b.id
      WHERE s.institution_id = ? AND i.status = 'active'`;
    const params = [institutionId];

    if (filters.itemId) {
      query += ' AND s.item_id = ?';
      params.push(filters.itemId);
    }
    if (filters.warehouseId) {
      query += ' AND s.warehouse_id = ?';
      params.push(filters.warehouseId);
    }
    if (filters.batchId) {
      query += ' AND s.batch_id = ?';
      params.push(filters.batchId);
    }
    if (filters.status) {
      query += ' AND s.status = ?';
      params.push(filters.status);
    }
    if (filters.serialNumber) {
      query += ' AND s.serial_number LIKE ?';
      params.push(`%${filters.serialNumber}%`);
    }

    query += ' ORDER BY s.received_date DESC';
    return db.query(query, params);
  }

  async updateSerialStatus(institutionId, serialId, status, soId, userId) {
    const normalizedStatus = status === 'in_stock' ? 'available' : String(status || '').trim().toLowerCase();
    if (!SERIAL_STATUSES.includes(normalizedStatus)) {
      throw new Error(`Invalid serial status. Allowed: ${SERIAL_STATUSES.join(', ')}`);
    }

    const updates = ['status = ?'];
    const params = [normalizedStatus];

    if (normalizedStatus === 'sold') {
      updates.push('sold_date = CURDATE()', 'customer_reference = ?');
      params.push(soId || null);
    }
    if (normalizedStatus === 'available') {
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

    if (daysToExpiry > 90) return;

    const qty = parseFloat(quantity) || 0;
    if (qty <= 0) {
      await db.query(
        `UPDATE expiry_alerts SET quantity = 0, days_to_expiry = ?, status = 'expired', updated_at = NOW()
         WHERE institution_id = ? AND batch_id = ?`,
        [daysToExpiry, institutionId, batchId]
      );
      return;
    }

    await db.query(
      `INSERT INTO expiry_alerts
       (id, institution_id, item_id, warehouse_id, batch_id, expiry_date, days_to_expiry, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE days_to_expiry = ?, quantity = ?, status = 'active', updated_at = NOW()`,
      [uuidv4(), institutionId, itemId, warehouseId, batchId, expiryDate, daysToExpiry, qty,
        daysToExpiry, qty]
    );
  }

  async getExpiryAlerts(institutionId, filters = {}) {
    let query = `
      SELECT ea.*, i.name AS item_name, i.sku, w.name AS warehouse_name,
             b.batch_number
      FROM expiry_alerts ea
      JOIN items i ON ea.item_id = i.id
      JOIN warehouses w ON ea.warehouse_id = w.id
      LEFT JOIN item_batches b ON ea.batch_id = b.id
      WHERE ea.institution_id = ? AND i.status = 'active' AND w.status = 'active'`;
    const params = [institutionId];

    if (filters.status) {
      query += ' AND ea.status = ?';
      params.push(filters.status);
    } else {
      query += " AND ea.status != 'expired'";
    }

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

    await db.query(
      `UPDATE item_batches SET status = 'expired'
       WHERE institution_id = ? AND expiry_date IS NOT NULL AND expiry_date < CURDATE() AND status = 'active'`,
      [institutionId]
    );

    await db.query(
      `UPDATE expiry_alerts SET status = 'expired'
       WHERE institution_id = ? AND expiry_date < CURDATE() AND status = 'active'`,
      [institutionId]
    );

    return batches.length;
  }
}

module.exports = new BatchSerialService();
