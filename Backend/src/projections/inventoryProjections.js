const db = require('../database/connection');
const { INVENTORY_EVENTS, normalizeItemVariantId } = require('../events/inventoryEvents');
const logger = require('../utils/logger');

function variantProjectionWhere(itemVariantId) {
  const vid = normalizeItemVariantId(itemVariantId);
  if (vid) {
    return { sql: ' AND item_variant_id = ? ', params: [vid] };
  }
  return { sql: ' AND item_variant_id IS NULL ', params: [] };
}

class InventoryProjectionService {
  async handleInventoryEvent(institutionId, eventType, eventData) {
    const { itemId, warehouseId } = eventData;

    try {
      switch (eventType) {
        case INVENTORY_EVENTS.PURCHASE_RECEIVED:
          await this.handlePurchaseReceived(institutionId, eventData);
          break;
        case INVENTORY_EVENTS.SALE_RESERVED:
          await this.handleSaleReserved(institutionId, eventData);
          break;
        case INVENTORY_EVENTS.SALE_RESERVATION_CANCELLED:
          await this.handleSaleReservationCancelled(institutionId, eventData);
          break;
        case INVENTORY_EVENTS.SALE_SHIPPED:
          await this.handleSaleShipped(institutionId, eventData);
          break;
        case INVENTORY_EVENTS.SALE_RETURNED:
          await this.handleSaleReturned(institutionId, eventData);
          break;
        case INVENTORY_EVENTS.PURCHASE_RETURNED:
          await this.handlePurchaseReturned(institutionId, eventData);
          break;
        case INVENTORY_EVENTS.STOCK_ADJUSTED:
          await this.handleStockAdjusted(institutionId, eventData);
          break;
        case INVENTORY_EVENTS.STOCK_DAMAGED:
          await this.handleStockDamaged(institutionId, eventData);
          break;
        case INVENTORY_EVENTS.STOCK_EXPIRED:
          await this.handleStockExpired(institutionId, eventData);
          break;
        case INVENTORY_EVENTS.TRANSFER_OUT:
          await this.handleTransferOut(institutionId, eventData);
          break;
        case INVENTORY_EVENTS.TRANSFER_IN:
          await this.handleTransferIn(institutionId, eventData);
          break;
        default:
          logger.warn('Unhandled event type in projection', { eventType, institutionId });
      }
    } catch (error) {
      logger.error('Failed to update inventory projection', {
        institutionId,
        eventType,
        itemId,
        warehouseId,
        error: error.message
      });
      throw error;
    }
  }

  async handlePurchaseReceived(institutionId, eventData) {
    const { itemId, warehouseId, quantity, unitCost } = eventData;
    const itemVariantId = normalizeItemVariantId(eventData.itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(itemVariantId);

    try {
      const current = await db.query(
        `SELECT * FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
        [institutionId, itemId, warehouseId, ...vParams]
      );

      if (current.length === 0) {
        const newTotalValue = quantity * unitCost;
        await db.query(
          `INSERT INTO inventory_projections 
           (id, institution_id, item_id, warehouse_id, item_variant_id, quantity_on_hand, quantity_available, average_cost, total_value, last_movement_date, version)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)`,
          [institutionId, itemId, warehouseId, itemVariantId, quantity, quantity, unitCost, newTotalValue]
        );
      } else {
        const p = current[0];
        const currentOnHand = Number(p.quantity_on_hand) || 0;
        const currentAvailable = Number(p.quantity_available) || 0;
        const currentAvgCost = Number(p.average_cost) || 0;
        const recvQty = Number(quantity) || 0;
        const recvUnitCost = Number(unitCost) || 0;
        const newQty = currentOnHand + recvQty;
        const newTotalValue = (currentOnHand * currentAvgCost) + (recvQty * recvUnitCost);
        const newAvgCost = newQty > 0 ? newTotalValue / newQty : recvUnitCost;
        const newAvailable = currentAvailable + recvQty;

        await db.query(
          `UPDATE inventory_projections 
           SET quantity_on_hand = ?, quantity_available = ?, average_cost = ?, total_value = ?, 
               last_movement_date = NOW(), version = version + 1
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
          [newQty, newAvailable, newAvgCost, newTotalValue, institutionId, itemId, warehouseId, ...vParams]
        );
      }
      
      try {
        const reorderService = require('../services/inventory/reorderLevelService');
        await reorderService.checkLowStock(institutionId, itemId, warehouseId);
      } catch { /* non-fatal */ }
    } catch (error) {
      logger.error('Error in handlePurchaseReceived', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async handleSaleReserved(institutionId, eventData) {
    const { itemId, warehouseId, quantity } = eventData;
    const itemVariantId = normalizeItemVariantId(eventData.itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(itemVariantId);

    const result = await db.query(
      `UPDATE inventory_projections 
       SET quantity_reserved = quantity_reserved + ?, 
           quantity_available = quantity_available - ?,
           last_movement_date = NOW(),
           version = version + 1
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}
         AND quantity_available >= ?`,
      [quantity, quantity, institutionId, itemId, warehouseId, ...vParams, quantity]
    );

    if (!result.affectedRows) {
      throw new Error(`Insufficient available stock for reservation: ${itemId} @ ${warehouseId}`);
    }
  }

  async handleSaleReservationCancelled(institutionId, eventData) {
    const { itemId, warehouseId, quantity } = eventData;
    const itemVariantId = normalizeItemVariantId(eventData.itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(itemVariantId);

    const result = await db.query(
      `UPDATE inventory_projections 
       SET quantity_reserved = quantity_reserved - ?, 
           quantity_available = quantity_available + ?,
           last_movement_date = NOW(),
           version = version + 1
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}
         AND quantity_reserved >= ?`,
      [quantity, quantity, institutionId, itemId, warehouseId, ...vParams, quantity]
    );

    if (!result.affectedRows) {
      throw new Error(`Insufficient reserved stock to release: ${itemId} @ ${warehouseId}`);
    }
  }

  async handleSaleShipped(institutionId, eventData) {
    const { itemId, warehouseId, quantity } = eventData;
    const itemVariantId = normalizeItemVariantId(eventData.itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(itemVariantId);

    const current = await db.query(
      `SELECT quantity_reserved, quantity_available FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
      [institutionId, itemId, warehouseId, ...vParams]
    );

    if (current.length > 0) {
      const currentReserved = Number(current[0].quantity_reserved);
      const quantityToShip = Number(quantity);
      
      if (currentReserved >= quantityToShip) {
        const result = await db.query(
          `UPDATE inventory_projections 
           SET quantity_on_hand = quantity_on_hand - ?,
               quantity_reserved = quantity_reserved - ?,
               last_movement_date = NOW(),
               version = version + 1
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}
             AND quantity_reserved >= ? AND quantity_on_hand >= ?`,
          [quantityToShip, quantityToShip, institutionId, itemId, warehouseId, ...vParams, quantityToShip, quantityToShip]
        );
        if (!result.affectedRows) {
          throw new Error(`Unable to ship from reserved stock: ${itemId} @ ${warehouseId}`);
        }
      } else {
        const fromAvailable = quantityToShip - currentReserved;
        const result = await db.query(
          `UPDATE inventory_projections 
           SET quantity_on_hand = quantity_on_hand - ?,
               quantity_reserved = 0,
               quantity_available = quantity_available - ?,
               last_movement_date = NOW(),
               version = version + 1
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}
             AND quantity_on_hand >= ? AND quantity_available >= ?`,
          [quantityToShip, fromAvailable, institutionId, itemId, warehouseId, ...vParams, quantityToShip, fromAvailable]
        );
        if (!result.affectedRows) {
          throw new Error(`Insufficient stock for shipment: ${itemId} @ ${warehouseId}`);
        }
      }

      await db.query(
        `UPDATE inventory_projections
         SET total_value = quantity_on_hand * average_cost
         WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
        [institutionId, itemId, warehouseId, ...vParams]
      );
    }
  }

  async handleStockAdjusted(institutionId, eventData) {
    const { itemId, warehouseId, quantityChange } = eventData;
    const itemVariantId = normalizeItemVariantId(eventData.itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(itemVariantId);

    const current = await db.query(
      `SELECT * FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
      [institutionId, itemId, warehouseId, ...vParams]
    );

    if (current.length === 0) {
      if (quantityChange > 0) {
        await db.query(
          `INSERT INTO inventory_projections 
           (id, institution_id, item_id, warehouse_id, item_variant_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_movement_date, version)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, 0, 0, 0, NOW(), 1)`,
          [institutionId, itemId, warehouseId, itemVariantId, quantityChange, quantityChange]
        );
      }
    } else {
      const currentProjection = current[0];
      const newQuantityOnHand = currentProjection.quantity_on_hand + quantityChange;
      const newQuantityAvailable = currentProjection.quantity_available + quantityChange;
      const newTotalValue = newQuantityOnHand * currentProjection.average_cost;

      await db.query(
        `UPDATE inventory_projections 
         SET quantity_on_hand = ?, quantity_available = ?, total_value = ?,
             last_movement_date = NOW(), version = version + 1
         WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
        [newQuantityOnHand, newQuantityAvailable, newTotalValue, institutionId, itemId, warehouseId, ...vParams]
      );
    }
  }

  async handleTransferOut(institutionId, eventData) {
    const { itemId, warehouseId, fromWarehouseId, quantity } = eventData;
    const sourceWarehouseId = fromWarehouseId || warehouseId;
    const itemVariantId = normalizeItemVariantId(eventData.itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(itemVariantId);

    const result = await db.query(
      `UPDATE inventory_projections 
       SET quantity_on_hand = quantity_on_hand - ?,
           quantity_available = quantity_available - ?,
           total_value = (quantity_on_hand - ?) * average_cost,
           last_movement_date = NOW(),
           version = version + 1
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}
         AND quantity_available >= ? AND quantity_on_hand >= ?`,
      [quantity, quantity, quantity, institutionId, itemId, sourceWarehouseId, ...vParams, quantity, quantity]
    );
    if (!result.affectedRows) {
      throw new Error(`Insufficient stock for transfer out: ${itemId} @ ${sourceWarehouseId}`);
    }
  }

  async handleTransferIn(institutionId, eventData) {
    const { itemId, warehouseId, toWarehouseId, quantity } = eventData;
    const destinationWarehouseId = toWarehouseId || warehouseId;
    const itemVariantId = normalizeItemVariantId(eventData.itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(itemVariantId);

    const current = await db.query(
      `SELECT * FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
      [institutionId, itemId, destinationWarehouseId, ...vParams]
    );

    if (current.length === 0) {
      await db.query(
        `INSERT INTO inventory_projections 
         (id, institution_id, item_id, warehouse_id, item_variant_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_movement_date, version)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, 0, 0, 0, NOW(), 1)`,
        [institutionId, itemId, destinationWarehouseId, itemVariantId, quantity, quantity]
      );
    } else {
      await db.query(
        `UPDATE inventory_projections 
         SET quantity_on_hand = quantity_on_hand + ?,
             quantity_available = quantity_available + ?,
             total_value = (quantity_on_hand + ?) * average_cost,
             last_movement_date = NOW(),
             version = version + 1
         WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
        [quantity, quantity, quantity, institutionId, itemId, destinationWarehouseId, ...vParams]
      );
    }
  }

  async handleSaleReturned(institutionId, eventData) {
    const { itemId, warehouseId, quantity } = eventData;
    const itemVariantId = normalizeItemVariantId(eventData.itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(itemVariantId);

    await db.query(
      `UPDATE inventory_projections
       SET quantity_on_hand = quantity_on_hand + ?,
           quantity_available = quantity_available + ?,
           total_value = (quantity_on_hand + ?) * average_cost,
           last_movement_date = NOW(),
           version = version + 1
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
      [quantity, quantity, quantity, institutionId, itemId, warehouseId, ...vParams]
    );
  }

  async handlePurchaseReturned(institutionId, eventData) {
    const { itemId, warehouseId, quantity } = eventData;
    const itemVariantId = normalizeItemVariantId(eventData.itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(itemVariantId);

    const result = await db.query(
      `UPDATE inventory_projections
       SET quantity_on_hand = quantity_on_hand - ?,
           quantity_available = quantity_available - ?,
           total_value = (quantity_on_hand - ?) * average_cost,
           last_movement_date = NOW(),
           version = version + 1
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}
         AND quantity_on_hand >= ? AND quantity_available >= ?`,
      [quantity, quantity, quantity, institutionId, itemId, warehouseId, ...vParams, quantity, quantity]
    );
    if (!result.affectedRows) {
      throw new Error(`Insufficient stock for purchase return: ${itemId} @ ${warehouseId}`);
    }
  }

  async handleStockDamaged(institutionId, eventData) {
    const { itemId, warehouseId, quantity } = eventData;
    const itemVariantId = normalizeItemVariantId(eventData.itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(itemVariantId);

    const result = await db.query(
      `UPDATE inventory_projections
       SET quantity_on_hand = quantity_on_hand - ?,
           quantity_available = quantity_available - ?,
           total_value = (quantity_on_hand - ?) * average_cost,
           last_movement_date = NOW(),
           version = version + 1
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}
         AND quantity_on_hand >= ? AND quantity_available >= ?`,
      [quantity, quantity, quantity, institutionId, itemId, warehouseId, ...vParams, quantity, quantity]
    );
    if (!result.affectedRows) {
      throw new Error(`Insufficient stock to mark damaged: ${itemId} @ ${warehouseId}`);
    }
  }

  async handleStockExpired(institutionId, eventData) {
    const { itemId, warehouseId, quantity } = eventData;
    const itemVariantId = normalizeItemVariantId(eventData.itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(itemVariantId);

    const result = await db.query(
      `UPDATE inventory_projections
       SET quantity_on_hand = quantity_on_hand - ?,
           quantity_available = quantity_available - ?,
           total_value = (quantity_on_hand - ?) * average_cost,
           last_movement_date = NOW(),
           version = version + 1
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}
         AND quantity_on_hand >= ? AND quantity_available >= ?`,
      [quantity, quantity, quantity, institutionId, itemId, warehouseId, ...vParams, quantity, quantity]
    );
    if (!result.affectedRows) {
      throw new Error(`Insufficient stock to mark expired: ${itemId} @ ${warehouseId}`);
    }
  }

  async getInventoryProjection(institutionId, itemId, warehouseId, itemVariantId = null) {
    const vid = normalizeItemVariantId(itemVariantId);
    const { sql: vSql, params: vParams } = variantProjectionWhere(vid);

    const result = await db.query(
      `SELECT ip.*, i.cost_price, i.selling_price, i.allow_negative_stock
       FROM inventory_projections ip
       JOIN items i ON ip.item_id = i.id
       WHERE ip.institution_id = ? AND ip.item_id = ? AND ip.warehouse_id = ?${vSql}`,
      [institutionId, itemId, warehouseId, ...vParams]
    );

    if (result[0]) return result[0];

    const items = await db.query(
      'SELECT cost_price, allow_negative_stock FROM items WHERE institution_id = ? AND id = ?',
      [institutionId, itemId]
    );
    if (items.length === 0) return null;

    return {
      institution_id: institutionId,
      item_id: itemId,
      warehouse_id: warehouseId,
      item_variant_id: vid,
      quantity_on_hand: 0,
      quantity_available: 0,
      quantity_reserved: 0,
      average_cost: items[0].cost_price || 0,
      total_value: 0,
      allow_negative_stock: items[0].allow_negative_stock
    };
  }

  async getWarehouseInventory(institutionId, warehouseId) {
    return await db.query(
      `SELECT ip.*, i.sku, i.name as item_name, i.status, u.name as unit, i.cost_price, i.selling_price, i.mrp,
              iv.variant_name as variant_name, iv.sku as variant_sku
       FROM inventory_projections ip
       JOIN items i ON ip.item_id = i.id
       LEFT JOIN item_variants iv ON ip.item_variant_id = iv.id
       LEFT JOIN units u ON i.unit = u.id
       WHERE ip.institution_id = ? AND ip.warehouse_id = ? AND i.status = 'active'
       ORDER BY i.name, iv.variant_name`,
      [institutionId, warehouseId]
    );
  }

  async getInstitutionInventory(institutionId, limit = 100, offset = 0, warehouseId = null, accessibleWarehouseIds = []) {
    let query = `SELECT ip.*, i.sku, i.name as item_name, i.status, u.name as unit, i.cost_price, i.selling_price, i.mrp, w.name as warehouse_name, w.status as warehouse_status,
              iv.variant_name as variant_name, iv.sku as variant_sku
       FROM inventory_projections ip
       JOIN items i ON ip.item_id = i.id
       JOIN warehouses w ON ip.warehouse_id = w.id
       LEFT JOIN item_variants iv ON ip.item_variant_id = iv.id
       LEFT JOIN units u ON i.unit = u.id
       WHERE ip.institution_id = ? AND i.status = 'active' AND w.status = 'active'`;
    const params = [institutionId];

    // Filter by specific warehouse if provided
    if (warehouseId) {
      query += ' AND ip.warehouse_id = ?';
      params.push(warehouseId);
    }
    
    // Filter by accessible warehouses if user doesn't have admin access
    if (accessibleWarehouseIds.length > 0) {
      const placeholders = accessibleWarehouseIds.map(() => '?').join(',');
      query += ` AND ip.warehouse_id IN (${placeholders})`;
      params.push(...accessibleWarehouseIds);
    }

    query += ' ORDER BY i.name, w.name';
    
    return await db.query(query, params);
  }

  async getLowStockItems(institutionId, threshold = 10, warehouseId = null, accessibleWarehouseIds = []) {
    let query = `SELECT ip.*, i.sku, i.name as item_name, u.name as unit, w.name as warehouse_name,
              iv.variant_name as variant_name, iv.sku as variant_sku
       FROM inventory_projections ip
       JOIN items i ON ip.item_id = i.id
       JOIN warehouses w ON ip.warehouse_id = w.id
       LEFT JOIN item_variants iv ON ip.item_variant_id = iv.id
       LEFT JOIN units u ON i.unit = u.id
       WHERE ip.institution_id = ? AND ip.quantity_available <= ? AND i.status = 'active' AND w.status = 'active'`;
    const params = [institutionId, threshold];

    // Filter by specific warehouse if provided
    if (warehouseId) {
      query += ' AND ip.warehouse_id = ?';
      params.push(warehouseId);
    }
    
    // Filter by accessible warehouses if user doesn't have admin access
    if (accessibleWarehouseIds.length > 0) {
      const placeholders = accessibleWarehouseIds.map(() => '?').join(',');
      query += ` AND ip.warehouse_id IN (${placeholders})`;
      params.push(...accessibleWarehouseIds);
    }

    query += ' ORDER BY ip.quantity_available ASC';
    
    return await db.query(query, params);
  }

  async getDashboardStats(institutionId) {
    const [
      inventoryAgg,
      itemCounts,
      warehouseCounts,
      lowStockResult,
    ] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*) AS inventory_rows,
           COALESCE(SUM(ip.quantity_on_hand), 0) AS total_quantity,
           COALESCE(SUM(ip.quantity_available), 0) AS total_available,
           COALESCE(SUM(ip.quantity_reserved), 0) AS total_reserved,
           COALESCE(SUM(ip.total_value), 0) AS total_value
         FROM inventory_projections ip
         JOIN items i ON ip.item_id = i.id
         JOIN warehouses w ON ip.warehouse_id = w.id
         WHERE ip.institution_id = ? AND i.status = 'active' AND w.status = 'active'`,
        [institutionId]
      ),
      db.query(
        `SELECT
           SUM(status = 'active') AS active_items,
           SUM(status = 'inactive') AS inactive_items,
           COUNT(*) AS total_items
         FROM items
         WHERE institution_id = ? AND status != 'draft'`,
        [institutionId]
      ),
      db.query(
        `SELECT
           SUM(status = 'active') AS active_warehouses,
           SUM(status = 'inactive') AS inactive_warehouses
         FROM warehouses
         WHERE institution_id = ?`,
        [institutionId]
      ),
      db.query(
        `SELECT COUNT(*) AS low_stock_count
         FROM inventory_projections ip
         JOIN items i ON ip.item_id = i.id
         JOIN warehouses w ON ip.warehouse_id = w.id
         WHERE ip.institution_id = ? AND ip.quantity_available <= 10
           AND i.status = 'active' AND w.status = 'active'`,
        [institutionId]
      ),
    ]);

    const inv = inventoryAgg[0] || {};
    const items = itemCounts[0] || {};
    const wh = warehouseCounts[0] || {};

    return {
      totalValue: inv.total_value || 0,
      totalItems: items.total_items || 0,
      activeItems: items.active_items || 0,
      inactiveItems: items.inactive_items || 0,
      totalInventoryRows: inv.inventory_rows || 0,
      totalQuantity: inv.total_quantity || 0,
      totalAvailable: inv.total_available || 0,
      totalReserved: inv.total_reserved || 0,
      activeWarehouses: wh.active_warehouses || 0,
      inactiveWarehouses: wh.inactive_warehouses || 0,
      lowStockCount: lowStockResult[0]?.low_stock_count || 0,
    };
  }

  async syncInventoryPricing(institutionId) {
    // Update all inventory projections to reflect current item cost prices
    await db.query(
      `UPDATE inventory_projections ip
       JOIN items i ON ip.item_id = i.id
       SET ip.average_cost = i.cost_price,
           ip.total_value = ip.quantity_on_hand * i.cost_price
       WHERE ip.institution_id = ?`,
      [institutionId]
    );
    
    logger.info('Inventory pricing synced', { institutionId });
  }

  async rebuildProjection(institutionId, itemId, warehouseId, itemVariantId = null) {
    const eventStore = require('../events/eventStore');
    const { createAggregateId } = require('../events/inventoryEvents');
    const vid = normalizeItemVariantId(itemVariantId);
    const aggregateId = createAggregateId(itemId, warehouseId, vid);
    const { sql: vSql, params: vParams } = variantProjectionWhere(vid);

    const events = await eventStore.getEvents(institutionId, 'inventory', aggregateId);

    await db.query(
      `DELETE FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
      [institutionId, itemId, warehouseId, ...vParams]
    );

    // Replay events
    for (const event of events) {
      await this.handleInventoryEvent(institutionId, event.event_type, event.event_data);
    }

    logger.info('Projection rebuilt', { institutionId, itemId, warehouseId, itemVariantId: vid, eventCount: events.length });
  }
}

module.exports = new InventoryProjectionService();