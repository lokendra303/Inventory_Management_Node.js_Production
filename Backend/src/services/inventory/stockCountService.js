const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

class StockCountService {
  async createStockCount(institutionId, data, userId) {
    const { warehouseId, countType = 'full', scheduledDate, notes, itemIds } = data;

    const id = uuidv4();
    const countNumber = `SC-${Date.now()}`;

    // Validate warehouse is active
    const [wh] = await db.query(
      'SELECT id FROM warehouses WHERE id = ? AND status = \'active\'',
      [warehouseId]
    );
    if (!wh) throw new Error('Warehouse not found or inactive');

    await db.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO stock_counts
         (id, institution_id, count_number, warehouse_id, count_type, scheduled_date, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, institutionId, countNumber, warehouseId, countType, scheduledDate || null, notes || null, userId]
      );

      // Build line items from current inventory snapshot
      let query = `
        SELECT ip.item_id, ip.quantity_on_hand, ip.average_cost
        FROM inventory_projections ip
        JOIN items i ON ip.item_id = i.id AND i.status = 'active'
        WHERE ip.institution_id = ? AND ip.warehouse_id = ?`;
      const params = [institutionId, warehouseId];

      if (itemIds && itemIds.length > 0) {
        query += ` AND ip.item_id IN (${itemIds.map(() => '?').join(',')})`;
        params.push(...itemIds);
      }

      const items = await conn.execute(query, params);
      const rows = items[0];

      for (const row of rows) {
        await conn.execute(
          `INSERT INTO stock_count_lines
           (id, institution_id, stock_count_id, item_id, system_qty, unit_cost)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), institutionId, id, row.item_id, row.quantity_on_hand, row.average_cost]
        );
      }
    });

    logger.info('Stock count created', { id, institutionId, warehouseId, countType, userId });
    return { id, countNumber };
  }

  async getStockCounts(institutionId, filters = {}) {
    let query = `
      SELECT sc.*, w.name as warehouse_name,
             COUNT(scl.id) as total_lines,
             SUM(CASE WHEN scl.status = 'counted' THEN 1 ELSE 0 END) as counted_lines
      FROM stock_counts sc
      JOIN warehouses w ON sc.warehouse_id = w.id AND w.status = 'active'
      LEFT JOIN stock_count_lines scl ON sc.id = scl.stock_count_id
      WHERE sc.institution_id = ?`;
    const params = [institutionId];

    if (filters.status)      { query += ' AND sc.status = ?';       params.push(filters.status); }
    if (filters.warehouseId) { query += ' AND sc.warehouse_id = ?'; params.push(filters.warehouseId); }

    query += ' GROUP BY sc.id ORDER BY sc.created_at DESC';
    return db.query(query, params);
  }

  async getStockCount(institutionId, countId) {
    const counts = await db.query(
      `SELECT sc.*, w.name as warehouse_name
       FROM stock_counts sc
       JOIN warehouses w ON sc.warehouse_id = w.id AND w.status = 'active'
       WHERE sc.institution_id = ? AND sc.id = ?`,
      [institutionId, countId]
    );
    if (!counts.length) return null;

    const lines = await db.query(
      `SELECT scl.*, i.name as item_name, i.sku, i.unit
       FROM stock_count_lines scl
       JOIN items i ON scl.item_id = i.id AND i.status = 'active'
       WHERE scl.institution_id = ? AND scl.stock_count_id = ?
       ORDER BY i.name`,
      [institutionId, countId]
    );

    return { ...counts[0], lines };
  }

  async submitCount(institutionId, countId, lines, userId) {
    // lines: [{ lineId, countedQty, notes }]
    for (const line of lines) {
      await db.query(
        `UPDATE stock_count_lines
         SET counted_qty = ?, status = 'counted', counted_by = ?, counted_at = NOW(), notes = ?
         WHERE institution_id = ? AND id = ? AND stock_count_id = ?`,
        [line.countedQty, userId, line.notes || null, institutionId, line.lineId, countId]
      );
    }

    // Check if all lines counted → move to pending_approval
    const [pending] = await db.query(
      `SELECT COUNT(*) as cnt FROM stock_count_lines
       WHERE stock_count_id = ? AND status = 'pending'`,
      [countId]
    );

    if (pending.cnt === 0) {
      await db.query(
        `UPDATE stock_counts SET status = 'pending_approval', updated_at = NOW() WHERE id = ?`,
        [countId]
      );
    }

    logger.info('Stock count lines submitted', { countId, institutionId, userId });
    return true;
  }

  async approveAndPost(institutionId, countId, userId) {
    const count = await this.getStockCount(institutionId, countId);
    if (!count) throw new Error('Stock count not found');
    if (count.status !== 'pending_approval') {
      throw new Error(`Cannot approve count with status '${count.status}'`);
    }

    await db.transaction(async (conn) => {
      for (const line of count.lines) {
        if (line.counted_qty === null) continue;

        const variance = parseFloat(line.counted_qty) - parseFloat(line.system_qty);
        if (Math.abs(variance) < 0.0001) continue; // No variance, skip

        // Post adjustment to inventory_projections
        const [proj] = await conn.execute(
          'SELECT * FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
          [institutionId, line.item_id, count.warehouse_id]
        );

        if (proj.length > 0) {
          const current = proj[0];
          const newOnHand = parseFloat(current.quantity_on_hand) + variance;
          const newAvailable = Math.max(newOnHand - parseFloat(current.quantity_reserved || 0), 0);
          const newValue = newOnHand * parseFloat(current.average_cost);

          await conn.execute(
            `UPDATE inventory_projections
             SET quantity_on_hand = ?, quantity_available = ?, total_value = ?, last_movement_date = NOW()
             WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
            [newOnHand, newAvailable, newValue, institutionId, line.item_id, count.warehouse_id]
          );
        }

        // Record in inventory_adjustments for audit trail
        await conn.execute(
          `INSERT INTO inventory_adjustments
           (id, institution_id, item_id, warehouse_id, adjustment_type, quantity_change,
            reason, loss_type, adjusted_by, reference_number)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'OTHER', ?, ?)`,
          [uuidv4(), institutionId, line.item_id, count.warehouse_id,
           variance >= 0 ? 'increase' : 'decrease',
           Math.abs(variance), `Stock Count: ${count.count_number}`,
           userId, count.count_number]
        );

        await conn.execute(
          'UPDATE stock_count_lines SET status = ? WHERE id = ?',
          ['approved', line.id]
        );
      }

      await conn.execute(
        `UPDATE stock_counts
         SET status = 'approved', approved_by = ?, approved_at = NOW(), completed_at = NOW()
         WHERE id = ?`,
        [userId, countId]
      );
    });

    logger.info('Stock count approved and posted', { countId, institutionId, userId });
    return true;
  }

  async cancelStockCount(institutionId, countId, userId) {
    const result = await db.query(
      `UPDATE stock_counts SET status = 'cancelled', updated_at = NOW()
       WHERE institution_id = ? AND id = ? AND status IN ('draft','in_progress')`,
      [institutionId, countId]
    );
    if (result.affectedRows === 0) throw new Error('Stock count not found or cannot be cancelled');
    logger.info('Stock count cancelled', { countId, institutionId, userId });
    return true;
  }

  async getInventoryAgingReport(institutionId, warehouseId) {
    const query = `
      SELECT
        i.id as item_id, i.sku, i.name as item_name, i.category,
        w.name as warehouse_name,
        ip.quantity_on_hand, ip.average_cost,
        ip.total_value,
        ip.last_movement_date,
        COALESCE(DATEDIFF(CURDATE(), ip.last_movement_date), 9999) as days_since_movement,
        CASE
          WHEN ip.last_movement_date IS NULL                      THEN '120+'
          WHEN DATEDIFF(CURDATE(), ip.last_movement_date) <= 30  THEN '0-30'
          WHEN DATEDIFF(CURDATE(), ip.last_movement_date) <= 60  THEN '31-60'
          WHEN DATEDIFF(CURDATE(), ip.last_movement_date) <= 90  THEN '61-90'
          WHEN DATEDIFF(CURDATE(), ip.last_movement_date) <= 120 THEN '91-120'
          ELSE '120+'
        END as aging_bucket
      FROM inventory_projections ip
      JOIN items i ON ip.item_id = i.id AND i.status = 'active'
      JOIN warehouses w ON ip.warehouse_id = w.id AND w.status = 'active'
      WHERE ip.institution_id = ? AND ip.quantity_on_hand > 0
        ${warehouseId ? 'AND ip.warehouse_id = ?' : ''}
      ORDER BY days_since_movement DESC`;

    const params = warehouseId ? [institutionId, warehouseId] : [institutionId];
    return db.query(query, params);
  }
}

module.exports = new StockCountService();
