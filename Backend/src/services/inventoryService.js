const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const eventStore = require('../events/eventStore');
const { INVENTORY_EVENTS, validateEventData, createAggregateId } = require('../events/inventoryEvents');
const projectionService = require('../projections/inventoryProjections');
const logger = require('../utils/logger');

class InventoryService {
  async receiveStock(institutionId, data, userId) {
    const { 
      itemId, 
      warehouseId, 
      quantity, 
      unitCost, 
      poId = uuidv4(), 
      poLineId = uuidv4(), 
      grnNumber = `GRN-${Date.now()}` 
    } = data;
    
    validateEventData(INVENTORY_EVENTS.PURCHASE_RECEIVED, {
      itemId,
      warehouseId,
      quantity,
      unitCost,
      poId,
      poLineId,
      grnNumber,
      receivedDate: new Date().toISOString()
    });

    const aggregateId = createAggregateId(itemId, warehouseId);
    const idempotencyKey = `receive-${poLineId}-${itemId}-${Date.now()}`;

    try {
      const eventId = await eventStore.appendEvent(
        institutionId,
        'inventory',
        aggregateId,
        INVENTORY_EVENTS.PURCHASE_RECEIVED,
        {
          itemId,
          warehouseId,
          quantity,
          unitCost,
          poId,
          poLineId,
          grnNumber,
          receivedDate: new Date().toISOString()
        },
        { userId },
        idempotencyKey
      );

      // Update projection
      await projectionService.handleInventoryEvent(institutionId, INVENTORY_EVENTS.PURCHASE_RECEIVED, {
        itemId,
        warehouseId,
        quantity,
        unitCost
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to receive stock', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async reserveStock(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, unitPrice, soId, soLineId } = data;
    
    validateEventData(INVENTORY_EVENTS.SALE_RESERVED, {
      itemId,
      warehouseId,
      quantity,
      unitPrice,
      soId,
      soLineId,
      reservedDate: new Date().toISOString()
    });

    const aggregateId = createAggregateId(itemId, warehouseId);
    const idempotencyKey = `reserve-${soLineId}`;

    try {
      // Check available stock before reservation
      const currentStock = await projectionService.getInventoryProjection(institutionId, itemId, warehouseId);
      
      if (!currentStock || currentStock.quantity_available < quantity) {
        throw new Error(`Insufficient stock: available ${currentStock?.quantity_available || 0}, requested ${quantity}`);
      }

      const eventId = await eventStore.appendEvent(
        institutionId,
        'inventory',
        aggregateId,
        INVENTORY_EVENTS.SALE_RESERVED,
        {
          itemId,
          warehouseId,
          quantity,
          unitPrice,
          soId,
          soLineId,
          reservedDate: new Date().toISOString()
        },
        { userId },
        idempotencyKey
      );

      // Update projection
      await projectionService.handleInventoryEvent(institutionId, INVENTORY_EVENTS.SALE_RESERVED, {
        itemId,
        warehouseId,
        quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to reserve stock', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async shipStock(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, unitPrice, soId, soLineId, shipmentNumber } = data;
    
    validateEventData(INVENTORY_EVENTS.SALE_SHIPPED, {
      itemId,
      warehouseId,
      quantity,
      unitPrice,
      soId,
      soLineId,
      shippedDate: new Date().toISOString(),
      shipmentNumber
    });

    const aggregateId = createAggregateId(itemId, warehouseId);
    const idempotencyKey = `ship-${soLineId}-${shipmentNumber}`;

    try {
      const eventId = await eventStore.appendEvent(
        institutionId,
        'inventory',
        aggregateId,
        INVENTORY_EVENTS.SALE_SHIPPED,
        {
          itemId,
          warehouseId,
          quantity,
          unitPrice,
          soId,
          soLineId,
          shipmentNumber,
          shippedDate: new Date().toISOString()
        },
        { userId },
        idempotencyKey
      );

      // Update projection
      await projectionService.handleInventoryEvent(institutionId, INVENTORY_EVENTS.SALE_SHIPPED, {
        itemId,
        warehouseId,
        quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to ship stock', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async adjustStock(institutionId, data, userId) {
    const { itemId, warehouseId, quantityChange, reason, adjustmentType } = data;
    
    const normalizedQuantityChange = adjustmentType === 'decrease' ? -Math.abs(quantityChange) : Math.abs(quantityChange);
    
    try {
      // Direct database update
      const current = await db.query(
        'SELECT * FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
        [institutionId, itemId, warehouseId]
      );

      if (current.length === 0 && normalizedQuantityChange > 0) {
        await db.query(
          `INSERT INTO inventory_projections 
           (id, institution_id, item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_movement_date, version)
           VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0, 0, NOW(), 1)`,
          [institutionId, itemId, warehouseId, normalizedQuantityChange, normalizedQuantityChange]
        );
      } else if (current.length > 0) {
        await db.query(
          `UPDATE inventory_projections 
           SET quantity_on_hand = quantity_on_hand + ?,
               quantity_available = quantity_available + ?,
               last_movement_date = NOW()
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
          [normalizedQuantityChange, normalizedQuantityChange, institutionId, itemId, warehouseId]
        );
      }

      return 'success';
    } catch (error) {
      logger.error('Failed to adjust stock', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async transferStock(institutionId, data, userId) {
    const { itemId, fromWarehouseId, toWarehouseId, quantity, transferId = uuidv4() } = data;
    
    if (fromWarehouseId === toWarehouseId) {
      throw new Error('Source and destination warehouses cannot be the same');
    }
    
    try {
      // Direct database updates
      await db.query(
        `UPDATE inventory_projections 
         SET quantity_on_hand = quantity_on_hand - ?,
             quantity_available = quantity_available - ?,
             last_movement_date = NOW()
         WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
        [quantity, quantity, institutionId, itemId, fromWarehouseId]
      );

      const destExists = await db.query(
        'SELECT id FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
        [institutionId, itemId, toWarehouseId]
      );

      if (destExists.length === 0) {
        await db.query(
          `INSERT INTO inventory_projections 
           (id, institution_id, item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_movement_date, version)
           VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0, 0, NOW(), 1)`,
          [institutionId, itemId, toWarehouseId, quantity, quantity]
        );
      } else {
        await db.query(
          `UPDATE inventory_projections 
           SET quantity_on_hand = quantity_on_hand + ?,
               quantity_available = quantity_available + ?,
               last_movement_date = NOW()
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
          [quantity, quantity, institutionId, itemId, toWarehouseId]
        );
      }

      return transferId;
    } catch (error) {
      logger.error('Failed to transfer stock', { institutionId, itemId, fromWarehouseId, toWarehouseId, error: error.message });
      throw error;
    }
  }

  async getInventoryHistory(institutionId, itemId, warehouseId) {
    const aggregateId = createAggregateId(itemId, warehouseId);
    return await eventStore.getEvents(institutionId, 'inventory', aggregateId);
  }

  async getCurrentStock(institutionId, itemId, warehouseId) {
    return await projectionService.getInventoryProjection(institutionId, itemId, warehouseId);
  }

  async returnSale(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, unitPrice, soId, soLineId, returnReason } = data;
    
    validateEventData(INVENTORY_EVENTS.SALE_RETURNED, {
      itemId,
      warehouseId,
      quantity,
      unitPrice,
      soId,
      soLineId,
      returnedDate: new Date().toISOString()
    });

    const aggregateId = createAggregateId(itemId, warehouseId);
    const idempotencyKey = `return-sale-${soLineId}-${Date.now()}`;

    try {
      const eventId = await eventStore.appendEvent(
        institutionId,
        'inventory',
        aggregateId,
        INVENTORY_EVENTS.SALE_RETURNED,
        {
          itemId,
          warehouseId,
          quantity,
          unitPrice,
          soId,
          soLineId,
          returnReason,
          returnedDate: new Date().toISOString()
        },
        { userId },
        idempotencyKey
      );

      // Update projection - add back to stock
      await projectionService.handleInventoryEvent(institutionId, INVENTORY_EVENTS.SALE_RETURNED, {
        itemId,
        warehouseId,
        quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to return sale', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async returnPurchase(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, unitCost, poId, poLineId, returnReason } = data;
    
    validateEventData(INVENTORY_EVENTS.PURCHASE_RETURNED, {
      itemId,
      warehouseId,
      quantity,
      unitCost,
      poId,
      poLineId,
      returnedDate: new Date().toISOString()
    });

    const aggregateId = createAggregateId(itemId, warehouseId);
    const idempotencyKey = `return-purchase-${poLineId}-${Date.now()}`;

    try {
      const eventId = await eventStore.appendEvent(
        institutionId,
        'inventory',
        aggregateId,
        INVENTORY_EVENTS.PURCHASE_RETURNED,
        {
          itemId,
          warehouseId,
          quantity,
          unitCost,
          poId,
          poLineId,
          returnReason,
          returnedDate: new Date().toISOString()
        },
        { userId },
        idempotencyKey
      );

      // Update projection - remove from stock
      await projectionService.handleInventoryEvent(institutionId, INVENTORY_EVENTS.PURCHASE_RETURNED, {
        itemId,
        warehouseId,
        quantity: -quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to return purchase', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async markDamaged(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, reason } = data;
    
    const aggregateId = createAggregateId(itemId, warehouseId);
    const idempotencyKey = `damaged-${itemId}-${warehouseId}-${Date.now()}`;

    try {
      const eventId = await eventStore.appendEvent(
        institutionId,
        'inventory',
        aggregateId,
        INVENTORY_EVENTS.STOCK_DAMAGED,
        {
          itemId,
          warehouseId,
          quantity,
          reason,
          damagedDate: new Date().toISOString()
        },
        { userId },
        idempotencyKey
      );

      // Update projection - remove from available stock
      await projectionService.handleInventoryEvent(institutionId, INVENTORY_EVENTS.STOCK_DAMAGED, {
        itemId,
        warehouseId,
        quantity: -quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to mark damaged', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async markExpired(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, expiryDate } = data;
    
    const aggregateId = createAggregateId(itemId, warehouseId);
    const idempotencyKey = `expired-${itemId}-${warehouseId}-${Date.now()}`;

    try {
      const eventId = await eventStore.appendEvent(
        institutionId,
        'inventory',
        aggregateId,
        INVENTORY_EVENTS.STOCK_EXPIRED,
        {
          itemId,
          warehouseId,
          quantity,
          expiryDate,
          expiredDate: new Date().toISOString()
        },
        { userId },
        idempotencyKey
      );

      // Update projection - remove from available stock
      await projectionService.handleInventoryEvent(institutionId, INVENTORY_EVENTS.STOCK_EXPIRED, {
        itemId,
        warehouseId,
        quantity: -quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to mark expired', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async getWarehouseStock(institutionId, warehouseId) {
    const projectionService = require('../projections/inventoryProjections');
    return await projectionService.getWarehouseInventory(institutionId, warehouseId);
  }

  async validateWarehouseAccess(institutionId, userId, warehouseId) {
    const warehouseService = require('./warehouseService');
    return await warehouseService.checkWarehouseAccess(institutionId, userId, warehouseId);
  }
}

module.exports = new InventoryService();