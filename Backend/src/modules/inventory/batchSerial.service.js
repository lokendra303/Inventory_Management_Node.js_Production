const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

const BATCH_STATUSES = ['active', 'expired', 'damaged', 'recalled'];
const SERIAL_STATUSES = ['available', 'reserved', 'sold', 'damaged', 'returned'];

class BatchSerialService {
  // ─── BATCH ───────────────────────────────────────────────

  async _assertActiveItemAndWarehouse(institutionId, itemId, warehouseId, connection = null) {
    const rows = await this._exec(
      connection,
      `SELECT i.id AS item_id, w.id AS warehouse_id
         FROM items i
         JOIN warehouses w ON w.id = ?
        WHERE i.id = ? AND i.institution_id = ? AND w.institution_id = ?
          AND i.status = 'active' AND w.status = 'active'`,
      [warehouseId, itemId, institutionId, institutionId]
    );
    if (!rows.length) {
      throw new Error('Item or warehouse not found or inactive');
    }
  }

  async _getBatchAllocationSummary(institutionId, itemId, warehouseId, connection = null) {
    const invRows = await this._exec(
      connection,
      `SELECT COALESCE(quantity_on_hand, 0) AS on_hand
         FROM inventory_projections
        WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
      [institutionId, itemId, warehouseId]
    );
    const batchRows = await this._exec(
      connection,
      `SELECT COALESCE(SUM(quantity_remaining), 0) AS batch_total
         FROM item_batches
        WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND status = 'active'`,
      [institutionId, itemId, warehouseId]
    );

    const onHand = parseFloat(invRows[0]?.on_hand || 0);
    const batchTotal = parseFloat(batchRows[0]?.batch_total || 0);
    return { onHand, batchTotal, unallocated: onHand - batchTotal };
  }

  async _validateBatchQuantityAgainstInventory(institutionId, itemId, warehouseId, quantity, connection = null) {
    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    const { onHand, batchTotal, unallocated } = await this._getBatchAllocationSummary(
      institutionId, itemId, warehouseId, connection
    );

    if (qty > unallocated + 0.0001) {
      throw new Error(
        `Cannot assign ${qty} to a batch — only ${Math.max(unallocated, 0).toFixed(2)} unallocated in warehouse stock `
        + `(${onHand.toFixed(2)} on hand, ${batchTotal.toFixed(2)} already in batches). `
        + 'Receive stock via GRN or set opening stock first.'
      );
    }
  }

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

    await this._assertActiveItemAndWarehouse(institutionId, itemId, warehouseId);
    await this._validateBatchQuantityAgainstInventory(
      institutionId, itemId, warehouseId, qtyReceived
    );

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

    await this._ensureItemTrackingFlags(institutionId, itemId, {
      batchTracked: true,
      hasExpiry: Boolean(expiryDate),
    });

    await this._logMovement(
      institutionId,
      {
        movementType: 'receive',
        referenceType: 'manual_batch',
        referenceId: id,
        itemId,
        warehouseId,
        batchId: id,
        quantity: qtyReceived,
      },
      userId
    );

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

    const inventoryService = require('./inventory.service');
    await inventoryService.adjustStock(
      institutionId,
      {
        itemId: batch.item_id,
        warehouseId: batch.warehouse_id,
        quantityChange: qty,
        adjustmentType: 'decrease',
        reason: `Manual batch consume (${batch.batch_number})`,
        lossType: 'MANUAL',
      },
      userId
    );

    await this._logMovement(
      institutionId,
      {
        movementType: 'ship',
        referenceType: 'manual_adjustment',
        referenceId: batchId,
        itemId: batch.item_id,
        warehouseId: batch.warehouse_id,
        batchId,
        quantity: qty,
      },
      userId
    );

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

    if (batch.manufacture_date && manufactureDate
      && String(batch.manufacture_date).slice(0, 10) !== manufactureDate) {
      throw new Error('Manufacture date cannot be changed once set');
    }
    if (batch.expiry_date && expiryDate
      && String(batch.expiry_date).slice(0, 10) !== expiryDate) {
      throw new Error('Expiry date cannot be changed once set');
    }

    const nextManufactureDate = batch.manufacture_date || manufactureDate;
    const nextExpiryDate = batch.expiry_date || expiryDate;

    if (nextManufactureDate && nextExpiryDate
      && new Date(nextManufactureDate) > new Date(nextExpiryDate)) {
      throw new Error('Manufacture date cannot be after expiry date');
    }

    await db.query(
      `UPDATE item_batches
       SET manufacture_date = ?, expiry_date = ?
       WHERE institution_id = ? AND id = ?`,
      [nextManufactureDate, nextExpiryDate, institutionId, batchId]
    );

    if (nextExpiryDate) {
      await this._checkAndCreateExpiryAlert(
        institutionId,
        batch.item_id,
        batch.warehouse_id,
        batchId,
        nextExpiryDate,
        parseFloat(batch.quantity_remaining || 0)
      );
    } else {
      await db.query(
        `UPDATE expiry_alerts SET status = 'expired', updated_at = NOW()
         WHERE institution_id = ? AND batch_id = ? AND status = 'active'`,
        [institutionId, batchId]
      );
    }

    logger.info('Batch dates updated', { batchId, manufactureDate: nextManufactureDate, expiryDate: nextExpiryDate, institutionId, userId });
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

    await this._assertActiveItemAndWarehouse(institutionId, itemId, warehouseId);

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

    await this._ensureItemTrackingFlags(institutionId, itemId, {
      serialized: true,
      batchTracked: Boolean(batchId),
    });

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

  // ─── LIFECYCLE (receives, shipments, returns) ────────────

  async _exec(connection, sql, params) {
    if (connection) {
      const [rows] = await connection.execute(sql, params);
      return rows;
    }
    return db.query(sql, params);
  }

  /**
   * Turn on item-level tracking flags when batches/serials are created so GRN,
   * ship, and return flows show the correct fields.
   */
  async _ensureItemTrackingFlags(institutionId, itemId, flags, connection = null) {
    const { batchTracked, serialized, hasExpiry } = flags;
    if (!batchTracked && !serialized && !hasExpiry) return;

    const rows = await this._exec(
      connection,
      'SELECT is_batch_tracked, is_serialized, has_expiry FROM items WHERE id = ? AND institution_id = ?',
      [itemId, institutionId]
    );
    if (!rows.length) return;

    const item = rows[0];
    const updates = [];
    if (batchTracked && !item.is_batch_tracked) updates.push('is_batch_tracked = 1');
    if (serialized && !item.is_serialized) updates.push('is_serialized = 1');
    if (hasExpiry && !item.has_expiry) updates.push('has_expiry = 1');
    if (!updates.length) return;

    updates.push('updated_at = NOW()');
    await this._exec(
      connection,
      `UPDATE items SET ${updates.join(', ')} WHERE id = ? AND institution_id = ?`,
      [itemId, institutionId]
    );
  }

  async _execResult(connection, sql, params) {
    if (connection) {
      const [result] = await connection.execute(sql, params);
      return result;
    }
    return db.query(sql, params);
  }

  _parseSerialNumbers(serialNumbers) {
    if (Array.isArray(serialNumbers)) {
      return serialNumbers.map((s) => String(s).trim()).filter(Boolean);
    }
    if (typeof serialNumbers === 'string') {
      return serialNumbers.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }

  async getItemTracking(institutionId, itemId) {
    const rows = await db.query(
      `SELECT is_batch_tracked, is_serialized, has_expiry
         FROM items
        WHERE id = ? AND institution_id = ? AND status = 'active'`,
      [itemId, institutionId]
    );
    if (!rows.length) {
      return { isBatchTracked: false, isSerialized: false, hasExpiry: false };
    }
    const item = rows[0];
    return {
      isBatchTracked: Boolean(item.is_batch_tracked),
      isSerialized: Boolean(item.is_serialized),
      hasExpiry: Boolean(item.has_expiry),
    };
  }

  async _logMovement(institutionId, data, userId, connection = null) {
    const {
      movementType, referenceType, referenceId, itemId, warehouseId,
      batchId, serialId, quantity,
    } = data;
    await this._exec(
      connection,
      `INSERT INTO batch_serial_movements
       (id, institution_id, movement_type, reference_type, reference_id,
        item_id, warehouse_id, batch_id, serial_id, quantity, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), institutionId, movementType, referenceType, referenceId,
        itemId, warehouseId, batchId || null, serialId || null, quantity || 0, userId || null,
      ]
    );
  }

  async _receiveIntoBatch(institutionId, data, userId, connection = null) {
    const {
      itemId, warehouseId, batchNumber, manufactureDate, expiryDate, quantity, unitCost,
    } = data;
    const normalized = String(batchNumber || '').trim().toUpperCase();
    if (!normalized) throw new Error('Batch number is required');
    await this._assertActiveItemAndWarehouse(institutionId, itemId, warehouseId, connection);
    await this._validateBatchQuantityAgainstInventory(
      institutionId, itemId, warehouseId, quantity, connection
    );

    const existing = await this._exec(
      connection,
      `SELECT id, quantity_received, quantity_remaining, unit_cost, expiry_date, status
       FROM item_batches
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND batch_number = ?`,
      [institutionId, itemId, warehouseId, normalized]
    );

    if (existing.length) {
      const batch = existing[0];
      if (batch.status !== 'active') {
        throw new Error(`Batch "${normalized}" is ${batch.status} and cannot receive more stock`);
      }
      const qty = parseFloat(quantity);
      const newReceived = parseFloat(batch.quantity_received) + qty;
      const newRemaining = parseFloat(batch.quantity_remaining) + qty;
      await this._exec(
        connection,
        `UPDATE item_batches
         SET quantity_received = ?, quantity_remaining = ?, unit_cost = ?
         WHERE id = ?`,
        [newReceived, newRemaining, unitCost ?? batch.unit_cost, batch.id]
      );
      const expiry = batch.expiry_date || expiryDate;
      if (expiry) {
        await this._checkAndCreateExpiryAlert(
          institutionId, itemId, warehouseId, batch.id, expiry, newRemaining
        );
      }
      await this._ensureItemTrackingFlags(institutionId, itemId, {
        batchTracked: true,
        hasExpiry: Boolean(expiry),
      }, connection);
      return batch.id;
    }

    const id = uuidv4();
    const qty = parseFloat(quantity);
    await this._exec(
      connection,
      `INSERT INTO item_batches
       (id, institution_id, item_id, warehouse_id, batch_number,
        manufacture_date, expiry_date, quantity_received, quantity_remaining, unit_cost, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        id, institutionId, itemId, warehouseId, normalized,
        manufactureDate || null, expiryDate || null, qty, qty, unitCost || 0,
      ]
    );
    if (expiryDate) {
      await this._checkAndCreateExpiryAlert(institutionId, itemId, warehouseId, id, expiryDate, qty);
    }
    await this._ensureItemTrackingFlags(institutionId, itemId, {
      batchTracked: true,
      hasExpiry: Boolean(expiryDate),
    }, connection);
    logger.info('Batch received into stock', { id, institutionId, itemId, batchNumber: normalized, userId });
    return id;
  }

  async _allocateFefo(institutionId, itemId, warehouseId, quantity, connection = null) {
    const batches = await this._exec(
      connection,
      `SELECT id, batch_number, quantity_remaining, expiry_date
       FROM item_batches
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?
         AND status = 'active' AND quantity_remaining > 0
       ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date ASC, created_at ASC`,
      [institutionId, itemId, warehouseId]
    );

    let remaining = parseFloat(quantity);
    const allocations = [];
    for (const batch of batches) {
      if (remaining <= 0) break;
      const available = parseFloat(batch.quantity_remaining);
      const take = Math.min(available, remaining);
      allocations.push({ batchId: batch.id, batchNumber: batch.batch_number, quantity: take });
      remaining -= take;
    }
    if (remaining > 0.0001) {
      throw new Error(`Insufficient batch stock: short by ${remaining.toFixed(2)}`);
    }
    return allocations;
  }

  async previewFefoAllocations(institutionId, itemId, warehouseId, quantity) {
    return this._allocateFefo(institutionId, itemId, warehouseId, quantity, null);
  }

  async _consumeBatchInternal(institutionId, batchId, quantity, connection = null) {
    const rows = await this._exec(
      connection,
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
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity must be greater than 0');
    if (qty > available) {
      throw new Error(`Insufficient batch quantity: available ${available}, requested ${qty}`);
    }

    const newAvailable = available - qty;
    await this._exec(
      connection,
      'UPDATE item_batches SET quantity_remaining = ? WHERE id = ?',
      [newAvailable, batchId]
    );

    if (batch.expiry_date) {
      await this._checkAndCreateExpiryAlert(
        institutionId, batch.item_id, batch.warehouse_id, batchId, batch.expiry_date, newAvailable
      );
    }
    return { quantityRemaining: newAvailable };
  }

  async receiveOnGrnLine(institutionId, lineData, userId, connection = null) {
    const {
      itemId, warehouseId, quantityReceived, unitCost,
      batchNumber, manufactureDate, expiryDate, serialNumbers,
      grnLineId, receiptDate,
    } = lineData;

    const tracking = await this.getItemTracking(institutionId, itemId);
    if (!tracking.isBatchTracked && !tracking.isSerialized) return null;

    const qty = parseFloat(quantityReceived);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Invalid receive quantity for batch/serial tracking');
    }

    let batchId = null;

    if (tracking.isBatchTracked) {
      if (!String(batchNumber || '').trim()) {
        throw new Error('Batch number is required for batch-tracked items');
      }
      if (tracking.hasExpiry && !expiryDate) {
        throw new Error('Expiry date is required for items with expiry tracking');
      }
      batchId = await this._receiveIntoBatch(
        institutionId,
        {
          itemId, warehouseId, batchNumber, manufactureDate, expiryDate,
          quantity: qty, unitCost,
        },
        userId,
        connection
      );
      await this._logMovement(
        institutionId,
        {
          movementType: 'receive',
          referenceType: 'grn_line',
          referenceId: grnLineId,
          itemId,
          warehouseId,
          batchId,
          quantity: qty,
        },
        userId,
        connection
      );
    }

    if (tracking.isSerialized) {
      const serials = this._parseSerialNumbers(serialNumbers);
      const expectedCount = Math.round(qty);
      if (serials.length !== expectedCount) {
        throw new Error(
          `Serial count (${serials.length}) must match receive quantity (${expectedCount}) for serialized items`
        );
      }

      for (const sn of serials) {
        const serialId = uuidv4();
        try {
          await this._exec(
            connection,
            `INSERT INTO item_serials
             (id, institution_id, item_id, warehouse_id, serial_number, batch_id, received_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              serialId, institutionId, itemId, warehouseId, sn,
              batchId || null, receiptDate || null,
            ]
          );
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') {
            throw new Error(`Serial number "${sn}" already exists for this item`);
          }
          throw error;
        }
        await this._logMovement(
          institutionId,
          {
            movementType: 'receive',
            referenceType: 'grn_line',
            referenceId: grnLineId,
            itemId,
            warehouseId,
            batchId,
            serialId,
            quantity: 1,
          },
          userId,
          connection
        );
      }
    }

    return { batchId };
  }

  async shipForLine(institutionId, lineData, userId, connection = null) {
    const {
      itemId, warehouseId, quantity, batchAllocations, serialIds, soId, soLineId,
    } = lineData;

    const tracking = await this.getItemTracking(institutionId, itemId);
    if (!tracking.isBatchTracked && !tracking.isSerialized) return null;

    const qty = parseFloat(quantity);
    const refId = soLineId;

    if (tracking.isBatchTracked) {
      let allocations = batchAllocations;
      if (!allocations?.length) {
        allocations = await this._allocateFefo(institutionId, itemId, warehouseId, qty, connection);
      } else {
        const total = allocations.reduce((sum, row) => sum + parseFloat(row.quantity), 0);
        if (Math.abs(total - qty) > 0.0001) {
          throw new Error(`Batch allocation total (${total}) must equal ship quantity (${qty})`);
        }
      }

      for (const alloc of allocations) {
        await this._consumeBatchInternal(institutionId, alloc.batchId, alloc.quantity, connection);
        await this._logMovement(
          institutionId,
          {
            movementType: 'ship',
            referenceType: 'so_line',
            referenceId: refId,
            itemId,
            warehouseId,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
          },
          userId,
          connection
        );
      }
    }

    if (tracking.isSerialized) {
      let ids = serialIds;
      if (!ids?.length) {
        const serials = await this._exec(
          connection,
          `SELECT id FROM item_serials
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND status = 'available'
           ORDER BY received_date ASC
           LIMIT ${Math.max(1, Math.round(qty))}`,
          [institutionId, itemId, warehouseId]
        );
        ids = serials.map((row) => row.id);
      }
      if (ids.length !== Math.round(qty)) {
        throw new Error(`Need ${Math.round(qty)} serial(s) for shipment, got ${ids.length}`);
      }

      for (const serialId of ids) {
        await this._exec(
          connection,
          `UPDATE item_serials SET status = 'sold', sold_date = CURDATE(), customer_reference = ?
           WHERE institution_id = ? AND id = ?`,
          [soId || null, institutionId, serialId]
        );
        const serialRows = await this._exec(
          connection,
          'SELECT batch_id FROM item_serials WHERE id = ?',
          [serialId]
        );
        await this._logMovement(
          institutionId,
          {
            movementType: 'ship',
            referenceType: 'so_line',
            referenceId: refId,
            itemId,
            warehouseId,
            batchId: serialRows[0]?.batch_id || null,
            serialId,
            quantity: 1,
          },
          userId,
          connection
        );
      }
    }

    return true;
  }

  async deductForPurchaseReturn(institutionId, lineData, userId, connection = null) {
    const {
      itemId, warehouseId, quantity, batchAllocations, serialIds, returnLineId, returnNumber,
    } = lineData;

    const tracking = await this.getItemTracking(institutionId, itemId);
    if (!tracking.isBatchTracked && !tracking.isSerialized) return null;

    const qty = parseFloat(quantity);

    if (tracking.isBatchTracked) {
      let allocations = batchAllocations;
      if (!allocations?.length) {
        allocations = await this._allocateFefo(institutionId, itemId, warehouseId, qty, connection);
      }
      for (const alloc of allocations) {
        await this._consumeBatchInternal(institutionId, alloc.batchId, alloc.quantity, connection);
        await this._logMovement(
          institutionId,
          {
            movementType: 'purchase_return',
            referenceType: 'purchase_return_line',
            referenceId: returnLineId,
            itemId,
            warehouseId,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
          },
          userId,
          connection
        );
      }
    }

    if (tracking.isSerialized) {
      let ids = serialIds;
      if (!ids?.length) {
        const serials = await this._exec(
          connection,
          `SELECT id FROM item_serials
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND status = 'available'
           ORDER BY received_date ASC
           LIMIT ${Math.max(1, Math.round(qty))}`,
          [institutionId, itemId, warehouseId]
        );
        ids = serials.map((row) => row.id);
      }
      if (ids.length !== Math.round(qty)) {
        throw new Error(`Need ${Math.round(qty)} serial(s) for purchase return, got ${ids.length}`);
      }
      for (const serialId of ids) {
        await this._exec(
          connection,
          'DELETE FROM item_serials WHERE institution_id = ? AND id = ?',
          [institutionId, serialId]
        );
        await this._logMovement(
          institutionId,
          {
            movementType: 'purchase_return',
            referenceType: 'purchase_return_line',
            referenceId: returnLineId,
            itemId,
            warehouseId,
            serialId,
            quantity: 1,
          },
          userId,
          connection
        );
      }
    }

    logger.info('Batch/serial deducted for purchase return', { returnNumber, itemId, quantity: qty, userId });
    return true;
  }

  async restoreForSalesReturn(institutionId, lineData, userId, connection = null) {
    const {
      itemId, warehouseId, quantity, unitCost,
      batchNumber, manufactureDate, expiryDate, serialNumbers, serialIds,
      returnLineId,
    } = lineData;

    const tracking = await this.getItemTracking(institutionId, itemId);
    if (!tracking.isBatchTracked && !tracking.isSerialized) return null;

    const qty = parseFloat(quantity);
    let batchId = null;

    if (tracking.isBatchTracked) {
      const normalizedBatch = String(batchNumber || `RTN-${Date.now()}`).trim().toUpperCase();
      batchId = await this._receiveIntoBatch(
        institutionId,
        {
          itemId,
          warehouseId,
          batchNumber: normalizedBatch,
          manufactureDate,
          expiryDate,
          quantity: qty,
          unitCost: unitCost || 0,
        },
        userId,
        connection
      );
      await this._logMovement(
        institutionId,
        {
          movementType: 'sales_return',
          referenceType: 'sales_return_line',
          referenceId: returnLineId,
          itemId,
          warehouseId,
          batchId,
          quantity: qty,
        },
        userId,
        connection
      );
    }

    if (tracking.isSerialized) {
      if (serialIds?.length) {
        for (const serialId of serialIds) {
          await this._exec(
            connection,
            `UPDATE item_serials
             SET status = 'available', sold_date = NULL, customer_reference = NULL, warehouse_id = ?
             WHERE institution_id = ? AND id = ?`,
            [warehouseId, institutionId, serialId]
          );
          await this._logMovement(
            institutionId,
            {
              movementType: 'sales_return',
              referenceType: 'sales_return_line',
              referenceId: returnLineId,
              itemId,
              warehouseId,
              serialId,
              quantity: 1,
            },
            userId,
            connection
          );
        }
      } else {
        const serials = this._parseSerialNumbers(serialNumbers);
        const expectedCount = Math.round(qty);
        if (serials.length !== expectedCount) {
          throw new Error(
            `Serial count (${serials.length}) must match return quantity (${expectedCount}) for serialized items`
          );
        }
        for (const sn of serials) {
          const existing = await this._exec(
            connection,
            `SELECT id, status FROM item_serials
             WHERE institution_id = ? AND item_id = ? AND serial_number = ?`,
            [institutionId, itemId, sn]
          );
          if (existing.length) {
            await this._exec(
              connection,
              `UPDATE item_serials
               SET status = 'available', sold_date = NULL, customer_reference = NULL,
                   warehouse_id = ?, batch_id = ?
               WHERE id = ?`,
              [warehouseId, batchId, existing[0].id]
            );
            await this._logMovement(
              institutionId,
              {
                movementType: 'sales_return',
                referenceType: 'sales_return_line',
                referenceId: returnLineId,
                itemId,
                warehouseId,
                batchId,
                serialId: existing[0].id,
                quantity: 1,
              },
              userId,
              connection
            );
          } else {
            const serialId = uuidv4();
            await this._exec(
              connection,
              `INSERT INTO item_serials
               (id, institution_id, item_id, warehouse_id, serial_number, batch_id, status, received_date)
               VALUES (?, ?, ?, ?, ?, ?, 'available', NOW())`,
              [serialId, institutionId, itemId, warehouseId, sn, batchId]
            );
            await this._logMovement(
              institutionId,
              {
                movementType: 'sales_return',
                referenceType: 'sales_return_line',
                referenceId: returnLineId,
                itemId,
                warehouseId,
                batchId,
                serialId,
                quantity: 1,
              },
              userId,
              connection
            );
          }
        }
      }
    }

    return { batchId };
  }

  // ─── KIT ASSEMBLY / DISASSEMBLY ───────────────────────────

  async _kitBatchContext(institutionId, itemId, warehouseId, connection = null) {
    const batchGeneratorService = require('../settings/batchGenerator.service');
    return batchGeneratorService.buildContextFromItem(institutionId, itemId, warehouseId, connection);
  }

  async _generateBatchByContext(institutionId, itemId, connection = null, options = {}) {
    const batchGeneratorService = require('../settings/batchGenerator.service');
    const {
      warehouseId,
      consume = true,
      ruleId,
      context = 'kit_assembly',
    } = options;
    if (!warehouseId) {
      throw new Error('Warehouse is required to generate batch number');
    }

    const ctx = await this._kitBatchContext(institutionId, itemId, warehouseId, connection);
    ctx.context = context;
    if (ruleId) ctx.ruleId = ruleId;

    if (!consume) {
      const preview = await batchGeneratorService.previewBatch(institutionId, ctx, { connection });
      return preview.preview;
    }

    const result = await batchGeneratorService.generateBatch(institutionId, ctx, { connection });
    return result.batchNumber;
  }

  async generateKitAssemblyBatchNumber(institutionId, itemId, connection = null, options = {}) {
    return this._generateBatchByContext(institutionId, itemId, connection, {
      ...options,
      context: 'kit_assembly',
    });
  }

  async generateOpeningStockBatchNumber(institutionId, itemId, connection = null, options = {}) {
    return this._generateBatchByContext(institutionId, itemId, connection, {
      ...options,
      context: 'opening_stock',
    });
  }

  async generateKitDisassemblyComponentBatchNumber(institutionId, itemId, connection = null, options = {}) {
    const batchGeneratorService = require('../settings/batchGenerator.service');
    const { warehouseId, consume = true, ruleId } = options;
    if (!warehouseId) {
      throw new Error('Warehouse is required to generate disassembly batch number');
    }

    const ctx = await this._kitBatchContext(institutionId, itemId, warehouseId, connection);
    ctx.context = 'kit_disassembly';
    if (ruleId) ctx.ruleId = ruleId;

    if (!consume) {
      const preview = await batchGeneratorService.previewBatch(institutionId, ctx, { connection });
      return preview.preview;
    }

    const result = await batchGeneratorService.generateBatch(institutionId, ctx, { connection });
    return result.batchNumber;
  }

  async getBatchStockTotal(institutionId, itemId, warehouseId, connection = null) {
    const batchRows = await this._exec(
      connection,
      `SELECT COALESCE(SUM(quantity_remaining), 0) AS batch_total
         FROM item_batches
        WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND status = 'active'`,
      [institutionId, itemId, warehouseId]
    );
    return parseFloat(batchRows[0]?.batch_total || 0);
  }

  async _restoreBatchQuantity(institutionId, batchId, quantity, connection = null) {
    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return;
    await this._exec(
      connection,
      'UPDATE item_batches SET quantity_remaining = quantity_remaining + ? WHERE institution_id = ? AND id = ?',
      [qty, institutionId, batchId]
    );
  }

  async consumeForKitAssembly(institutionId, lineData, userId, connection = null) {
    const {
      itemId, warehouseId, quantity, batchAllocations, assemblyRefId,
    } = lineData;

    const tracking = await this.getItemTracking(institutionId, itemId);
    if (!tracking.isBatchTracked) return { allocations: [] };

    const qty = parseFloat(quantity);
    let allocations = batchAllocations;
    if (!allocations?.length) {
      allocations = await this._allocateFefo(institutionId, itemId, warehouseId, qty, connection);
    } else {
      const total = allocations.reduce((sum, row) => sum + parseFloat(row.quantity), 0);
      if (Math.abs(total - qty) > 0.0001) {
        throw new Error(`Batch allocation total (${total}) must equal assembly consumption (${qty})`);
      }
    }

    for (const alloc of allocations) {
      await this._consumeBatchInternal(institutionId, alloc.batchId, alloc.quantity, connection);
      await this._logMovement(
        institutionId,
        {
          movementType: 'ship',
          referenceType: 'kit_assembly_component',
          referenceId: assemblyRefId,
          itemId,
          warehouseId,
          batchId: alloc.batchId,
          quantity: alloc.quantity,
        },
        userId,
        connection
      );
    }

    return { allocations };
  }

  async receiveForKitAssembly(institutionId, lineData, userId, connection = null) {
    const {
      itemId, warehouseId, quantity, unitCost,
      batchNumber, manufactureDate, expiryDate, assemblyRefId, batchRuleId,
    } = lineData;

    const tracking = await this.getItemTracking(institutionId, itemId);
    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Invalid kit assembly quantity for batch receive');
    }

    if (tracking.hasExpiry && !expiryDate) {
      throw new Error('Expiry date is required for batch-tracked kits with expiry tracking');
    }

    let normalizedBatch = String(batchNumber || '').trim().toUpperCase();
    if (!normalizedBatch) {
      normalizedBatch = await this.generateKitAssemblyBatchNumber(
        institutionId,
        itemId,
        connection,
        { warehouseId, consume: true, ruleId: batchRuleId }
      );
    }

    const dup = await this._exec(
      connection,
      `SELECT id FROM item_batches
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND batch_number = ?`,
      [institutionId, itemId, warehouseId, normalizedBatch]
    );
    if (dup.length) {
      throw new Error(`Batch number "${normalizedBatch}" already exists for this kit in this warehouse`);
    }

    const batchId = await this._receiveIntoBatch(
      institutionId,
      {
        itemId,
        warehouseId,
        batchNumber: normalizedBatch,
        manufactureDate,
        expiryDate,
        quantity: qty,
        unitCost: unitCost || 0,
      },
      userId,
      connection
    );

    await this._logMovement(
      institutionId,
      {
        movementType: 'receive',
        referenceType: 'kit_assembly_output',
        referenceId: assemblyRefId,
        itemId,
        warehouseId,
        batchId,
        quantity: qty,
      },
      userId,
      connection
    );

    return { batchId, batchNumber: normalizedBatch, quantity: qty };
  }

  async receiveForOpeningStock(institutionId, lineData, userId, connection = null) {
    const {
      itemId, warehouseId, quantity, unitCost,
      batchNumber, manufactureDate, expiryDate, batchRuleId, openingRefId,
      forceBatch = false,
    } = lineData;

    const tracking = await this.getItemTracking(institutionId, itemId);
    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Invalid opening stock quantity for batch receive');
    }

    if (!tracking.isBatchTracked && !forceBatch) {
      return null;
    }

    if (tracking.hasExpiry && !expiryDate) {
      throw new Error('Expiry date is required for batch-tracked items with expiry tracking');
    }

    let normalizedBatch = String(batchNumber || '').trim().toUpperCase();
    if (!normalizedBatch) {
      try {
        normalizedBatch = await this.generateOpeningStockBatchNumber(
          institutionId,
          itemId,
          connection,
          { warehouseId, consume: true, ruleId: batchRuleId }
        );
      } catch (genErr) {
        const rows = await this._exec(
          connection,
          'SELECT sku FROM items WHERE id = ? AND institution_id = ? LIMIT 1',
          [itemId, institutionId]
        );
        const sku = String(rows[0]?.sku || 'KIT').replace(/[^A-Z0-9-]/gi, '').toUpperCase() || 'KIT';
        normalizedBatch = `OPEN-${sku}-${Date.now()}`;
        logger.warn('Opening batch rule generation failed; using fallback lot number', {
          institutionId,
          itemId,
          error: genErr.message,
          fallback: normalizedBatch,
        });
      }
    }

    const dup = await this._exec(
      connection,
      `SELECT id FROM item_batches
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND batch_number = ?`,
      [institutionId, itemId, warehouseId, normalizedBatch]
    );
    if (dup.length) {
      throw new Error(`Batch number "${normalizedBatch}" already exists for this item in this warehouse`);
    }

    const batchId = await this._receiveIntoBatch(
      institutionId,
      {
        itemId,
        warehouseId,
        batchNumber: normalizedBatch,
        manufactureDate,
        expiryDate,
        quantity: qty,
        unitCost: unitCost || 0,
      },
      userId,
      connection
    );

    await this._logMovement(
      institutionId,
      {
        movementType: 'receive',
        referenceType: 'opening_stock',
        referenceId: openingRefId || `OPEN-${itemId}`,
        itemId,
        warehouseId,
        batchId,
        quantity: qty,
      },
      userId,
      connection
    );

    return { batchId, batchNumber: normalizedBatch, quantity: qty };
  }

  async rollbackKitAssemblyBatches(institutionId, batchOps, userId, connection = null) {
    const { componentAllocations = [], outputBatch } = batchOps || {};

    for (const alloc of componentAllocations) {
      try {
        await this._restoreBatchQuantity(institutionId, alloc.batchId, alloc.quantity, connection);
      } catch (err) {
        logger.error('Kit assembly batch rollback failed (component)', {
          institutionId,
          batchId: alloc.batchId,
          error: err.message,
        });
      }
    }

    if (outputBatch?.batchId && outputBatch?.quantity) {
      try {
        await this._consumeBatchInternal(
          institutionId,
          outputBatch.batchId,
          outputBatch.quantity,
          connection
        );
      } catch (err) {
        logger.error('Kit assembly batch rollback failed (output)', {
          institutionId,
          batchId: outputBatch.batchId,
          error: err.message,
        });
      }
    }
  }

  async processKitDisassemblyBatches(institutionId, data, userId, connection = null) {
    const {
      compositeItemId, warehouseId, quantity, components, disassemblyRefId, componentUnitCosts = {},
    } = data;

    const qty = parseFloat(quantity);
    const kitTracking = await this.getItemTracking(institutionId, compositeItemId);
    const kitAllocations = [];

    if (kitTracking.isBatchTracked) {
      const allocations = await this._allocateFefo(
        institutionId, compositeItemId, warehouseId, qty, connection
      );
      for (const alloc of allocations) {
        await this._consumeBatchInternal(institutionId, alloc.batchId, alloc.quantity, connection);
        await this._logMovement(
          institutionId,
          {
            movementType: 'ship',
            referenceType: 'kit_disassembly_output',
            referenceId: disassemblyRefId,
            itemId: compositeItemId,
            warehouseId,
            batchId: alloc.batchId,
            quantity: alloc.quantity,
          },
          userId,
          connection
        );
        kitAllocations.push(alloc);
      }
    }

    const componentBatches = [];
    for (const c of components) {
      const compTracking = await this.getItemTracking(institutionId, c.component_item_id);
      if (!compTracking.isBatchTracked) continue;

      const lineQty = qty * Number(c.quantity_required);
      const batchNumber = await this.generateKitDisassemblyComponentBatchNumber(
        institutionId, c.component_item_id, connection, { warehouseId, consume: true }
      );
      const unitCost = Number(componentUnitCosts[c.component_item_id]) || 0;

      const batchId = await this._receiveIntoBatch(
        institutionId,
        {
          itemId: c.component_item_id,
          warehouseId,
          batchNumber,
          quantity: lineQty,
          unitCost,
        },
        userId,
        connection
      );

      await this._logMovement(
        institutionId,
        {
          movementType: 'receive',
          referenceType: 'kit_disassembly_component',
          referenceId: disassemblyRefId,
          itemId: c.component_item_id,
          warehouseId,
          batchId,
          quantity: lineQty,
        },
        userId,
        connection
      );

      componentBatches.push({
        itemId: c.component_item_id,
        batchId,
        batchNumber,
        quantity: lineQty,
        itemName: c.component_name || null,
        itemSku: c.sku || null,
      });
    }

    return { kitAllocations, componentBatches };
  }

  async getMovements(institutionId, filters = {}) {
    let query = `
      SELECT m.*, i.name AS item_name, i.sku, w.name AS warehouse_name,
             b.batch_number, s.serial_number
      FROM batch_serial_movements m
      JOIN items i ON m.item_id = i.id
      JOIN warehouses w ON m.warehouse_id = w.id
      LEFT JOIN item_batches b ON m.batch_id = b.id
      LEFT JOIN item_serials s ON m.serial_id = s.id
      WHERE m.institution_id = ?`;
    const params = [institutionId];

    if (filters.itemId) {
      query += ' AND m.item_id = ?';
      params.push(filters.itemId);
    }
    if (filters.referenceId) {
      query += ' AND m.reference_id = ?';
      params.push(filters.referenceId);
    }
    if (filters.movementType) {
      query += ' AND m.movement_type = ?';
      params.push(filters.movementType);
    }

    query += ' ORDER BY m.created_at DESC LIMIT 500';
    return db.query(query, params);
  }
}

module.exports = new BatchSerialService();
