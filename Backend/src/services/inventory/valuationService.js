const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

/**
 * Handles FIFO, LIFO, and Weighted Average Cost (WAC) inventory valuation.
 * Maintains cost layers for FIFO/LIFO; WAC uses inventory_projections.average_cost.
 */
class ValuationService {
  /**
   * Add a cost layer when stock is received (all methods).
   */
  async addCostLayer(institutionId, itemId, warehouseId, quantity, unitCost, referenceType, referenceId) {
    await db.query(
      `INSERT INTO inventory_cost_layers
       (id, institution_id, item_id, warehouse_id, layer_date, quantity_in, quantity_remaining, unit_cost, reference_type, reference_id)
       VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
      [uuidv4(), institutionId, itemId, warehouseId, quantity, quantity, unitCost, referenceType || 'grn', referenceId || null]
    );
  }

  /**
   * Consume stock from layers using FIFO or LIFO.
   * Returns the total cost consumed (for COGS calculation).
   */
  async consumeFromLayers(institutionId, itemId, warehouseId, quantity, method = 'fifo') {
    const orderDir = method === 'fifo' ? 'ASC' : 'DESC';
    const layers = await db.query(
      `SELECT * FROM inventory_cost_layers
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND quantity_remaining > 0
       ORDER BY layer_date ${orderDir}`,
      [institutionId, itemId, warehouseId]
    );

    let remaining = parseFloat(quantity);
    let totalCost = 0;

    for (const layer of layers) {
      if (remaining <= 0) break;
      const available = parseFloat(layer.quantity_remaining);
      const consume = Math.min(available, remaining);
      totalCost += consume * parseFloat(layer.unit_cost);
      remaining -= consume;

      const newRemaining = available - consume;
      await db.query(
        'UPDATE inventory_cost_layers SET quantity_remaining = ? WHERE id = ?',
        [newRemaining, layer.id]
      );
    }

    if (remaining > 0.0001) {
      logger.warn('ValuationService: insufficient layers for consumption', {
        institutionId, itemId, warehouseId, shortfall: remaining
      });
    }

    return totalCost;
  }

  /**
   * Get current valuation for an item/warehouse using its configured method.
   */
  async getItemValuation(institutionId, itemId, warehouseId) {
    const [item] = await db.query(
      'SELECT valuation_method FROM items WHERE institution_id = ? AND id = ?',
      [institutionId, itemId]
    );
    if (!item) return null;

    const method = item.valuation_method || 'average';

    if (method === 'average') {
      const [proj] = await db.query(
        'SELECT quantity_on_hand, average_cost, total_value FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
        [institutionId, itemId, warehouseId]
      );
      return proj ? { method, ...proj } : null;
    }

    // FIFO/LIFO: sum remaining layers
    const layers = await db.query(
      `SELECT quantity_remaining, unit_cost FROM inventory_cost_layers
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND quantity_remaining > 0`,
      [institutionId, itemId, warehouseId]
    );

    const totalQty = layers.reduce((s, l) => s + parseFloat(l.quantity_remaining), 0);
    const totalValue = layers.reduce((s, l) => s + parseFloat(l.quantity_remaining) * parseFloat(l.unit_cost), 0);
    const avgCost = totalQty > 0 ? totalValue / totalQty : 0;

    return { method, quantity_on_hand: totalQty, average_cost: avgCost, total_value: totalValue, layers };
  }

  /**
   * Get full valuation report for all items in an institution.
   */
  async getValuationReport(institutionId, warehouseId) {
    const query = `
      SELECT
        i.id as item_id, i.sku, i.name as item_name, i.valuation_method,
        w.name as warehouse_name,
        ip.quantity_on_hand, ip.average_cost,
        ip.quantity_on_hand * ip.average_cost as total_value,
        (SELECT SUM(cl.quantity_remaining * cl.unit_cost)
         FROM inventory_cost_layers cl
         WHERE cl.institution_id = ip.institution_id AND cl.item_id = ip.item_id
           AND cl.warehouse_id = ip.warehouse_id AND cl.quantity_remaining > 0
        ) as layer_value
      FROM inventory_projections ip
      JOIN items i ON ip.item_id = i.id AND i.status = 'active'
      JOIN warehouses w ON ip.warehouse_id = w.id AND w.status = 'active'
      WHERE ip.institution_id = ? AND ip.quantity_on_hand > 0
        ${warehouseId ? 'AND ip.warehouse_id = ?' : ''}
      ORDER BY i.name`;

    const params = warehouseId ? [institutionId, warehouseId] : [institutionId];
    return db.query(query, params);
  }

  /**
   * Recalculate WAC after receiving stock (called from inventoryService.receiveStock).
   */
  async recalculateWAC(institutionId, itemId, warehouseId, newQty, newUnitCost) {
    const [proj] = await db.query(
      'SELECT quantity_on_hand, average_cost FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
      [institutionId, itemId, warehouseId]
    );

    if (!proj) return newUnitCost;

    const existingQty = parseFloat(proj.quantity_on_hand);
    const existingCost = parseFloat(proj.average_cost);
    const totalQty = existingQty + parseFloat(newQty);
    if (totalQty <= 0) return newUnitCost;

    return ((existingQty * existingCost) + (parseFloat(newQty) * parseFloat(newUnitCost))) / totalQty;
  }
}

module.exports = new ValuationService();
