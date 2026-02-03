const db = require('../database/connection');
const { INVENTORY_EVENTS } = require('../events/inventoryEvents');
const logger = require('../utils/logger');

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
        case INVENTORY_EVENTS.SALE_SHIPPED:
          await this.handleSaleShipped(institutionId, eventData);
          break;
        case INVENTORY_EVENTS.STOCK_ADJUSTED:
          await this.handleStockAdjusted(institutionId, eventData);
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
    console.log('handlePurchaseReceived called:', { institutionId, itemId, warehouseId, quantity, unitCost });

    try {
      // Get current projection using regular query
      const current = await db.query(
        'SELECT * FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
        [institutionId, itemId, warehouseId]
      );
      console.log('Current projection found:', current.length);

      if (current.length === 0) {
        // First stock receipt - create new projection
        const newQuantityOnHand = quantity;
        const newAverageCost = unitCost;
        const newTotalValue = quantity * unitCost;
        console.log('Creating new projection:', { newQuantityOnHand, newAverageCost, newTotalValue });

        const result = await db.query(
          `INSERT INTO inventory_projections 
           (id, institution_id, item_id, warehouse_id, quantity_on_hand, quantity_available, average_cost, total_value, last_movement_date, version)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, NOW(), 1)`,
          [institutionId, itemId, warehouseId, newQuantityOnHand, newQuantityOnHand, newAverageCost, newTotalValue]
        );
        console.log('Insert result:', result);
      } else {
        // Update existing projection
        const currentProjection = current[0];
        const currentValue = currentProjection.quantity_on_hand * currentProjection.average_cost;
        const newValue = quantity * unitCost;
        
        const newQuantityOnHand = currentProjection.quantity_on_hand + quantity;
        const newTotalValue = currentValue + newValue;
        const newAverageCost = newTotalValue / newQuantityOnHand;
        const newQuantityAvailable = currentProjection.quantity_available + quantity;
        
        console.log('Updating projection:', { newQuantityOnHand, newQuantityAvailable, newAverageCost, newTotalValue });

        const result = await db.query(
          `UPDATE inventory_projections 
           SET quantity_on_hand = ?, quantity_available = ?, average_cost = ?, total_value = ?, 
               last_movement_date = NOW(), version = version + 1
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
          [newQuantityOnHand, newQuantityAvailable, newAverageCost, newTotalValue, institutionId, itemId, warehouseId]
        );
        console.log('Update result:', result);
      }
      
      // Check for low stock alerts
      const reorderService = require('../services/reorderLevelService');
      await reorderService.checkLowStock(institutionId, itemId, warehouseId);
    } catch (error) {
      console.error('Error in handlePurchaseReceived:', error);
      throw error;
    }
  }

  async handleSaleReserved(institutionId, eventData) {
    const { itemId, warehouseId, quantity } = eventData;

    await db.query(
      `UPDATE inventory_projections 
       SET quantity_reserved = quantity_reserved + ?, 
           quantity_available = quantity_available - ?,
           last_movement_date = NOW(),
           version = version + 1
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
      [quantity, quantity, institutionId, itemId, warehouseId]
    );
  }

  async handleSaleShipped(institutionId, eventData) {
    const { itemId, warehouseId, quantity } = eventData;

    await db.query(
      `UPDATE inventory_projections 
       SET quantity_on_hand = quantity_on_hand - ?,
           quantity_reserved = quantity_reserved - ?,
           total_value = quantity_on_hand * average_cost,
           last_movement_date = NOW(),
           version = version + 1
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
      [quantity, quantity, institutionId, itemId, warehouseId]
    );
  }

  async handleStockAdjusted(institutionId, eventData) {
    const { itemId, warehouseId, quantityChange } = eventData;

    const current = await db.query(
      'SELECT * FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
      [institutionId, itemId, warehouseId]
    );

    if (current.length === 0) {
      if (quantityChange > 0) {
        await db.query(
          `INSERT INTO inventory_projections 
           (id, institution_id, item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_movement_date, version)
           VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0, 0, NOW(), 1)`,
          [institutionId, itemId, warehouseId, quantityChange, quantityChange]
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
         WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
        [newQuantityOnHand, newQuantityAvailable, newTotalValue, institutionId, itemId, warehouseId]
      );
    }
  }

  async handleTransferOut(institutionId, eventData) {
    const { itemId, warehouseId, quantity } = eventData;

    await db.query(
      `UPDATE inventory_projections 
       SET quantity_on_hand = quantity_on_hand - ?,
           quantity_available = quantity_available - ?,
           total_value = (quantity_on_hand - ?) * average_cost,
           last_movement_date = NOW(),
           version = version + 1
       WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
      [quantity, quantity, quantity, institutionId, itemId, warehouseId]
    );
  }

  async handleTransferIn(institutionId, eventData) {
    const { itemId, warehouseId, quantity } = eventData;

    const current = await db.query(
      'SELECT * FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
      [institutionId, itemId, warehouseId]
    );

    if (current.length === 0) {
      await db.query(
        `INSERT INTO inventory_projections 
         (id, institution_id, item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_movement_date, version)
         VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0, 0, NOW(), 1)`,
        [institutionId, itemId, warehouseId, quantity, quantity]
      );
    } else {
      await db.query(
        `UPDATE inventory_projections 
         SET quantity_on_hand = quantity_on_hand + ?,
             quantity_available = quantity_available + ?,
             total_value = (quantity_on_hand + ?) * average_cost,
             last_movement_date = NOW(),
             version = version + 1
         WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
        [quantity, quantity, quantity, institutionId, itemId, warehouseId]
      );
    }
  }

  async getInventoryProjection(institutionId, itemId, warehouseId) {
    const result = await db.query(
      'SELECT * FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
      [institutionId, itemId, warehouseId]
    );
    return result[0] || null;
  }

  async getWarehouseInventory(institutionId, warehouseId) {
    return await db.query(
      `SELECT ip.*, i.sku, i.name as item_name, i.unit
       FROM inventory_projections ip
       JOIN items i ON ip.item_id = i.id
       WHERE ip.institution_id = ? AND ip.warehouse_id = ?
       ORDER BY i.name`,
      [institutionId, warehouseId]
    );
  }

  async getInstitutionInventory(institutionId, limit = 100, offset = 0, warehouseId = null, accessibleWarehouseIds = []) {
    let query = `SELECT ip.*, i.sku, i.name as item_name, i.unit, w.name as warehouse_name
       FROM inventory_projections ip
       JOIN items i ON ip.item_id = i.id
       JOIN warehouses w ON ip.warehouse_id = w.id
       WHERE ip.institution_id = ?`;
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
    let query = `SELECT ip.*, i.sku, i.name as item_name, i.unit, w.name as warehouse_name
       FROM inventory_projections ip
       JOIN items i ON ip.item_id = i.id
       JOIN warehouses w ON ip.warehouse_id = w.id
       WHERE ip.institution_id = ? AND ip.quantity_available <= ?`;
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
    const [totalValueResult, totalItemsResult, lowStockResult] = await Promise.all([
      db.query(
        'SELECT SUM(total_value) as total_value FROM inventory_projections WHERE institution_id = ?',
        [institutionId]
      ),
      db.query(
        'SELECT COUNT(*) as total_items FROM items WHERE institution_id = ? AND status = "active"',
        [institutionId]
      ),
      db.query(
        'SELECT COUNT(*) as low_stock_count FROM inventory_projections WHERE institution_id = ? AND quantity_available <= 10',
        [institutionId]
      )
    ]);

    return {
      totalValue: totalValueResult[0]?.total_value || 0,
      totalItems: totalItemsResult[0]?.total_items || 0,
      lowStockCount: lowStockResult[0]?.low_stock_count || 0
    };
  }

  async rebuildProjection(institutionId, itemId, warehouseId) {
    // This method rebuilds a projection from events - useful for data recovery
    const eventStore = require('../events/eventStore');
    const aggregateId = `${itemId}:${warehouseId}`;
    
    const events = await eventStore.getEvents(institutionId, 'inventory', aggregateId);
    
    // Reset projection
    await db.query(
      'DELETE FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
      [institutionId, itemId, warehouseId]
    );

    // Replay events
    for (const event of events) {
      await this.handleInventoryEvent(institutionId, event.event_type, event.event_data);
    }

    logger.info('Projection rebuilt', { institutionId, itemId, warehouseId, eventCount: events.length });
  }
}

module.exports = new InventoryProjectionService();