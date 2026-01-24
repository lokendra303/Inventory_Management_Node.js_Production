const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const eventStore = require('../events/eventStore');
const { INVENTORY_EVENTS, validateEventData, createAggregateId } = require('../events/inventoryEvents');
const projectionService = require('../projections/inventoryProjections');
const logger = require('../utils/logger');

class InventoryService {
  async receiveStock(tenantId, data, userId) {
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
    const idempotencyKey = `receive-${poLineId}-${grnNumber}`;

    try {
      const eventId = await eventStore.appendEvent(
        tenantId,
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
      console.log('Updating projection for:', { tenantId, itemId, warehouseId, quantity, unitCost });
      await projectionService.handleInventoryEvent(tenantId, INVENTORY_EVENTS.PURCHASE_RECEIVED, {
        itemId,
        warehouseId,
        quantity,
        unitCost
      });
      console.log('Projection updated successfully');

      return eventId;
    } catch (error) {
      logger.error('Failed to receive stock', { tenantId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async reserveStock(tenantId, data, userId) {
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
      const currentStock = await projectionService.getInventoryProjection(tenantId, itemId, warehouseId);
      
      if (!currentStock || currentStock.quantity_available < quantity) {
        throw new Error(`Insufficient stock: available ${currentStock?.quantity_available || 0}, requested ${quantity}`);
      }

      const eventId = await eventStore.appendEvent(
        tenantId,
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
      await projectionService.handleInventoryEvent(tenantId, INVENTORY_EVENTS.SALE_RESERVED, {
        itemId,
        warehouseId,
        quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to reserve stock', { tenantId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async shipStock(tenantId, data, userId) {
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
        tenantId,
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
      await projectionService.handleInventoryEvent(tenantId, INVENTORY_EVENTS.SALE_SHIPPED, {
        itemId,
        warehouseId,
        quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to ship stock', { tenantId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async adjustStock(tenantId, data, userId) {
    const { itemId, warehouseId, quantityChange, reason, adjustmentType } = data;
    
    const normalizedQuantityChange = adjustmentType === 'decrease' ? -Math.abs(quantityChange) : Math.abs(quantityChange);
    
    try {
      // Direct database update
      const current = await db.query(
        'SELECT * FROM inventory_projections WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?',
        [tenantId, itemId, warehouseId]
      );

      if (current.length === 0 && normalizedQuantityChange > 0) {
        await db.query(
          `INSERT INTO inventory_projections 
           (id, tenant_id, item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_movement_date, version)
           VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0, 0, NOW(), 1)`,
          [tenantId, itemId, warehouseId, normalizedQuantityChange, normalizedQuantityChange]
        );
      } else if (current.length > 0) {
        await db.query(
          `UPDATE inventory_projections 
           SET quantity_on_hand = quantity_on_hand + ?,
               quantity_available = quantity_available + ?,
               last_movement_date = NOW()
           WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?`,
          [normalizedQuantityChange, normalizedQuantityChange, tenantId, itemId, warehouseId]
        );
      }

      return 'success';
    } catch (error) {
      logger.error('Failed to adjust stock', { tenantId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async transferStock(tenantId, data, userId) {
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
         WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?`,
        [quantity, quantity, tenantId, itemId, fromWarehouseId]
      );

      const destExists = await db.query(
        'SELECT id FROM inventory_projections WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?',
        [tenantId, itemId, toWarehouseId]
      );

      if (destExists.length === 0) {
        await db.query(
          `INSERT INTO inventory_projections 
           (id, tenant_id, item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_movement_date, version)
           VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0, 0, NOW(), 1)`,
          [tenantId, itemId, toWarehouseId, quantity, quantity]
        );
      } else {
        await db.query(
          `UPDATE inventory_projections 
           SET quantity_on_hand = quantity_on_hand + ?,
               quantity_available = quantity_available + ?,
               last_movement_date = NOW()
           WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?`,
          [quantity, quantity, tenantId, itemId, toWarehouseId]
        );
      }

      return transferId;
    } catch (error) {
      logger.error('Failed to transfer stock', { tenantId, itemId, fromWarehouseId, toWarehouseId, error: error.message });
      throw error;
    }
  }

  async getInventoryHistory(tenantId, itemId, warehouseId) {
    const aggregateId = createAggregateId(itemId, warehouseId);
    return await eventStore.getEvents(tenantId, 'inventory', aggregateId);
  }

  async getCurrentStock(tenantId, itemId, warehouseId) {
    return await projectionService.getInventoryProjection(tenantId, itemId, warehouseId);
  }

  async returnSale(tenantId, data, userId) {
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
        tenantId,
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
      await projectionService.handleInventoryEvent(tenantId, INVENTORY_EVENTS.SALE_RETURNED, {
        itemId,
        warehouseId,
        quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to return sale', { tenantId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async returnPurchase(tenantId, data, userId) {
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
        tenantId,
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
      await projectionService.handleInventoryEvent(tenantId, INVENTORY_EVENTS.PURCHASE_RETURNED, {
        itemId,
        warehouseId,
        quantity: -quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to return purchase', { tenantId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async markDamaged(tenantId, data, userId) {
    const { itemId, warehouseId, quantity, reason } = data;
    
    const aggregateId = createAggregateId(itemId, warehouseId);
    const idempotencyKey = `damaged-${itemId}-${warehouseId}-${Date.now()}`;

    try {
      const eventId = await eventStore.appendEvent(
        tenantId,
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
      await projectionService.handleInventoryEvent(tenantId, INVENTORY_EVENTS.STOCK_DAMAGED, {
        itemId,
        warehouseId,
        quantity: -quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to mark damaged', { tenantId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async markExpired(tenantId, data, userId) {
    const { itemId, warehouseId, quantity, expiryDate } = data;
    
    const aggregateId = createAggregateId(itemId, warehouseId);
    const idempotencyKey = `expired-${itemId}-${warehouseId}-${Date.now()}`;

    try {
      const eventId = await eventStore.appendEvent(
        tenantId,
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
      await projectionService.handleInventoryEvent(tenantId, INVENTORY_EVENTS.STOCK_EXPIRED, {
        itemId,
        warehouseId,
        quantity: -quantity
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to mark expired', { tenantId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async getWarehouseStock(tenantId, warehouseId) {
    const projectionService = require('../projections/inventoryProjections');
    return await projectionService.getWarehouseInventory(tenantId, warehouseId);
  }

  async validateWarehouseAccess(tenantId, userId, warehouseId) {
    const warehouseService = require('./warehouseService');
    return await warehouseService.checkWarehouseAccess(tenantId, userId, warehouseId);
  }
}

module.exports = new InventoryService();