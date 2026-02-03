const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

class ReorderLevelService {
  async setReorderLevel(institutionId, data, userId) {
    const { itemId, warehouseId, reorderLevel, reorderQuantity, maxStockLevel } = data;
    
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
      const [stockData] = await db.query(
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
    const result = await db.query(
      'UPDATE low_stock_alerts SET status = "acknowledged", acknowledged_by = ?, acknowledged_at = NOW() WHERE institution_id = ? AND id = ?',
      [userId, institutionId, alertId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Alert not found');
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
              ip.quantity_available as current_stock,
              (rl.reorder_level - ip.quantity_available) as shortage,
              rl.reorder_quantity as suggested_quantity,
              v.name as preferred_vendor, v.lead_time_days
       FROM reorder_levels rl
       JOIN items i ON rl.item_id = i.id
       JOIN warehouses w ON rl.warehouse_id = w.id
       JOIN inventory_projections ip ON rl.item_id = ip.item_id AND rl.warehouse_id = ip.warehouse_id
       LEFT JOIN (
         SELECT pol.item_id, po.vendor_id, v.name, v.lead_time_days,
                ROW_NUMBER() OVER (PARTITION BY pol.item_id ORDER BY po.created_at DESC) as rn
         FROM purchase_order_lines pol
         JOIN purchase_orders po ON pol.po_id = po.id
         JOIN vendors v ON po.vendor_id = v.id
         WHERE po.institution_id = ?
       ) v ON rl.item_id = v.item_id AND v.rn = 1
       WHERE rl.institution_id = ? AND rl.is_active = TRUE 
         AND ip.quantity_available <= rl.reorder_level
       ORDER BY (rl.reorder_level - ip.quantity_available) DESC`,
      [institutionId, institutionId]
    );
  }
}

module.exports = new ReorderLevelService();