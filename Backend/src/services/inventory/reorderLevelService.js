const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

class ReorderLevelService {
  async setReorderLevel(institutionId, data, userId) {
    const { itemId, warehouseId, reorderLevel, reorderQuantity } = data;
    const maxStockLevel = data.maxStockLevel ?? null;
    
    try {
      // Check if reorder level already exists
      const existing = await db.query(
        'SELECT id FROM reorder_levels WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
        [institutionId, itemId, warehouseId]
      );

      if (existing.length > 0) {
        // Update existing
        await db.query(
          `UPDATE reorder_levels 
           SET reorder_level = ?, reorder_quantity = ?, max_stock_level = ?, updated_at = NOW()
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
          [reorderLevel, reorderQuantity, maxStockLevel, institutionId, itemId, warehouseId]
        );
      } else {
        // Create new
        const id = uuidv4();
        await db.query(
          `INSERT INTO reorder_levels 
           (id, institution_id, item_id, warehouse_id, reorder_level, reorder_quantity, max_stock_level)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, institutionId, itemId, warehouseId, reorderLevel, reorderQuantity, maxStockLevel]
        );
      }

      // Check if this creates a low stock alert
      await this.checkLowStock(institutionId, itemId, warehouseId);

      logger.info('Reorder level set', { institutionId, itemId, warehouseId, reorderLevel, userId });
    } catch (error) {
      logger.error('Failed to set reorder level', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async checkLowStock(institutionId, itemId, warehouseId) {
    try {
      // Get current stock and reorder level
      const stockData = await db.query(
        `SELECT ip.quantity_available, rl.reorder_level, i.name as item_name, w.name as warehouse_name
         FROM inventory_projections ip
         JOIN reorder_levels rl ON ip.item_id = rl.item_id AND ip.warehouse_id = rl.warehouse_id
         JOIN items i ON ip.item_id = i.id
         JOIN warehouses w ON ip.warehouse_id = w.id
         WHERE ip.institution_id = ? AND ip.item_id = ? AND ip.warehouse_id = ? AND rl.is_active = TRUE`,
        [institutionId, itemId, warehouseId]
      );

      if (stockData.length > 0) {
        const { quantity_available, reorder_level, item_name, warehouse_name } = stockData[0];
        
        if (quantity_available <= reorder_level) {
          // Check if alert already exists
          const existingAlert = await db.query(
            'SELECT id FROM low_stock_alerts WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND status = "active"',
            [institutionId, itemId, warehouseId]
          );

          if (existingAlert.length === 0) {
            // Create new alert
            const alertId = uuidv4();
            await db.query(
              `INSERT INTO low_stock_alerts 
               (id, institution_id, item_id, warehouse_id, current_stock, reorder_level)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [alertId, institutionId, itemId, warehouseId, quantity_available, reorder_level]
            );

            logger.warn('Low stock alert created', { 
              institutionId, itemId, warehouseId, item_name, warehouse_name, 
              current_stock: quantity_available, reorder_level 
            });
          }
        } else {
          // Resolve existing alerts if stock is above reorder level
          await db.query(
            'UPDATE low_stock_alerts SET status = "resolved", resolved_at = NOW() WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND status = "active"',
            [institutionId, itemId, warehouseId]
          );
        }
      }
    } catch (error) {
      logger.error('Failed to check low stock', { institutionId, itemId, warehouseId, error: error.message });
    }
  }

  async getLowStockAlerts(institutionId, status = 'active') {
    // If querying active alerts, derive them live from reorder_levels vs inventory_projections
    // so the tab always shows current low stock even if checkLowStock hasn't fired yet
    if (status === 'active') {
      return await db.query(
        `SELECT 
           rl.id, rl.institution_id, rl.item_id, rl.warehouse_id,
           COALESCE(ip.quantity_available, 0) as current_stock,
           rl.reorder_level, rl.reorder_quantity,
           i.sku, i.name as item_name, w.name as warehouse_name,
           'active' as status, rl.updated_at as alert_date
         FROM reorder_levels rl
         JOIN items i ON rl.item_id = i.id
         JOIN warehouses w ON rl.warehouse_id = w.id
         LEFT JOIN inventory_projections ip ON rl.item_id = ip.item_id AND rl.warehouse_id = ip.warehouse_id
         WHERE rl.institution_id = ? AND rl.is_active = TRUE
           AND COALESCE(ip.quantity_available, 0) <= rl.reorder_level
         ORDER BY COALESCE(ip.quantity_available, 0) ASC`,
        [institutionId]
      );
    }
    // For acknowledged/resolved, use the actual alerts table
    return await db.query(
      `SELECT lsa.*, i.sku, i.name as item_name, w.name as warehouse_name, rl.reorder_quantity
       FROM low_stock_alerts lsa
       JOIN items i ON lsa.item_id = i.id
       JOIN warehouses w ON lsa.warehouse_id = w.id
       LEFT JOIN reorder_levels rl ON lsa.item_id = rl.item_id AND lsa.warehouse_id = rl.warehouse_id
       WHERE lsa.institution_id = ? AND lsa.status = ?
       ORDER BY lsa.alert_date DESC`,
      [institutionId, status]
    );
  }

  async acknowledgeAlert(institutionId, alertId, userId) {
    // alertId is a reorder_level id (since active alerts are derived live from reorder_levels)
    // Look up the item_id and warehouse_id from reorder_levels
    const rlRows = await db.query(
      'SELECT item_id, warehouse_id FROM reorder_levels WHERE id = ? AND institution_id = ?',
      [alertId, institutionId]
    );

    if (rlRows.length === 0) {
      throw new Error('Alert not found');
    }

    const { item_id, warehouse_id } = rlRows[0];

    // Get current stock for snapshot
    const stockRows = await db.query(
      'SELECT COALESCE(quantity_available, 0) as qty FROM inventory_projections WHERE item_id = ? AND warehouse_id = ?',
      [item_id, warehouse_id]
    );
    const currentStock = stockRows.length > 0 ? stockRows[0].qty : 0;

    // Get reorder level for snapshot
    const reorderLevel = rlRows[0].reorder_level;

    // Upsert into low_stock_alerts and mark as acknowledged
    const existingAlert = await db.query(
      'SELECT id FROM low_stock_alerts WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND status IN ("active", "acknowledged")',
      [institutionId, item_id, warehouse_id]
    );

    if (existingAlert.length > 0) {
      await db.query(
        'UPDATE low_stock_alerts SET status = "acknowledged", acknowledged_by = ?, acknowledged_at = NOW() WHERE id = ?',
        [userId, existingAlert[0].id]
      );
    } else {
      const newAlertId = uuidv4();
      await db.query(
        `INSERT INTO low_stock_alerts (id, institution_id, item_id, warehouse_id, current_stock, reorder_level, status, acknowledged_by, acknowledged_at)
         VALUES (?, ?, ?, ?, ?, ?, 'acknowledged', ?, NOW())`,
        [newAlertId, institutionId, item_id, warehouse_id, currentStock, reorderLevel ?? 0, userId]
      );
    }

    logger.info('Low stock alert acknowledged', { institutionId, alertId, userId });
  }

  async getReorderLevels(institutionId, filters = {}) {
    let query = `
      SELECT rl.*, i.sku, i.name as item_name, w.name as warehouse_name, 
             ip.quantity_available as current_stock,
             CASE WHEN ip.quantity_available <= rl.reorder_level THEN 'low' ELSE 'ok' END as stock_status
      FROM reorder_levels rl
      JOIN items i ON rl.item_id = i.id
      JOIN warehouses w ON rl.warehouse_id = w.id
      LEFT JOIN inventory_projections ip ON rl.item_id = ip.item_id AND rl.warehouse_id = ip.warehouse_id
      WHERE rl.institution_id = ? AND rl.is_active = TRUE
    `;
    const params = [institutionId];

    if (filters.itemId) {
      query += ' AND rl.item_id = ?';
      params.push(filters.itemId);
    }

    if (filters.warehouseId) {
      query += ' AND rl.warehouse_id = ?';
      params.push(filters.warehouseId);
    }

    if (filters.lowStockOnly) {
      query += ' AND ip.quantity_available <= rl.reorder_level';
    }

    query += ' ORDER BY i.name, w.name';

    return await db.query(query, params);
  }

  async generateReorderSuggestions(institutionId) {
    return await db.query(
      `SELECT rl.*, i.sku, i.name as item_name, w.name as warehouse_name,
              COALESCE(ip.quantity_available, 0) as current_stock,
              (rl.reorder_level - COALESCE(ip.quantity_available, 0)) as shortage,
              rl.reorder_quantity as suggested_quantity,
              v.display_name as preferred_vendor, v.lead_time_days
       FROM reorder_levels rl
       JOIN items i ON rl.item_id = i.id
       JOIN warehouses w ON rl.warehouse_id = w.id
       LEFT JOIN inventory_projections ip ON rl.item_id = ip.item_id AND rl.warehouse_id = ip.warehouse_id
       LEFT JOIN (
         SELECT pol.item_id, vn.display_name, vn.lead_time_days
         FROM purchase_order_lines pol
         JOIN purchase_orders po ON pol.po_id = po.id
         JOIN vendors vn ON po.vendor_id = vn.id
         WHERE po.institution_id = ?
         GROUP BY pol.item_id, vn.id
       ) v ON rl.item_id = v.item_id
       WHERE rl.institution_id = ? AND rl.is_active = TRUE 
         AND COALESCE(ip.quantity_available, 0) <= rl.reorder_level
       ORDER BY (rl.reorder_level - COALESCE(ip.quantity_available, 0)) DESC`,
      [institutionId, institutionId]
    );
  }
}

module.exports = new ReorderLevelService();