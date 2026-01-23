const { v4: uuidv4 } = require('uuid');
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
    
    validateEventData(INVENTORY_EVENTS.STOCK_ADJUSTED, {
      itemId,
      warehouseId,
      quantityChange,
      reason,
      adjustmentType,
      adjustedDate: new Date().toISOString()
    });

    const aggregateId = createAggregateId(itemId, warehouseId);
    const idempotencyKey = `adjust-${itemId}-${warehouseId}-${Date.now()}`;

    try {
      // For negative adjustments, check if we have enough stock
      if (adjustmentType === 'decrease') {
        const currentStock = await projectionService.getInventoryProjection(tenantId, itemId, warehouseId);
        if (!currentStock || currentStock.quantity_on_hand < Math.abs(quantityChange)) {
          throw new Error(`Insufficient stock for adjustment: available ${currentStock?.quantity_on_hand || 0}, adjustment ${Math.abs(quantityChange)}`);
        }
      }

      const eventId = await eventStore.appendEvent(
        tenantId,
        'inventory',
        aggregateId,
        INVENTORY_EVENTS.STOCK_ADJUSTED,
        {
          itemId,
          warehouseId,
          quantityChange,
          reason,
          adjustmentType,
          adjustedDate: new Date().toISOString()
        },
        { userId },
        idempotencyKey
      );

      // Update projection
      await projectionService.handleInventoryEvent(tenantId, INVENTORY_EVENTS.STOCK_ADJUSTED, {
        itemId,
        warehouseId,
        quantityChange: adjustmentType === 'decrease' ? -Math.abs(quantityChange) : Math.abs(quantityChange)
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to adjust stock', { tenantId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async transferStock(tenantId, data, userId) {
    const { 
      itemId, 
      fromWarehouseId, 
      toWarehouseId, 
      quantity, 
      transferId = uuidv4() 
    } = data;
    
    const transferDate = new Date().toISOString();
    
    // Validate both events
    validateEventData(INVENTORY_EVENTS.TRANSFER_OUT, {
      itemId,
      fromWarehouseId,
      toWarehouseId,
      quantity,
      transferId,
      transferDate
    });

    try {
      // Check available stock in source warehouse
      const currentStock = await projectionService.getInventoryProjection(tenantId, itemId, fromWarehouseId);
      if (!currentStock || currentStock.quantity_available < quantity) {
        throw new Error(`Insufficient stock for transfer: available ${currentStock?.quantity_available || 0}, requested ${quantity}`);
      }

      const idempotencyKeyOut = `transfer-out-${transferId}`;
      const idempotencyKeyIn = `transfer-in-${transferId}`;

      // Create transfer out event
      const outAggregateId = createAggregateId(itemId, fromWarehouseId);
      await eventStore.appendEvent(
        tenantId,
        'inventory',
        outAggregateId,
        INVENTORY_EVENTS.TRANSFER_OUT,
        {
          itemId,
          fromWarehouseId,
          toWarehouseId,
          quantity,
          transferId,
          transferDate
        },
        { userId },
        idempotencyKeyOut
      );

      // Create transfer in event
      const inAggregateId = createAggregateId(itemId, toWarehouseId);
      await eventStore.appendEvent(
        tenantId,
        'inventory',
        inAggregateId,
        INVENTORY_EVENTS.TRANSFER_IN,
        {
          itemId,
          fromWarehouseId,
          toWarehouseId,
          quantity,
          transferId,
          transferDate
        },
        { userId },
        idempotencyKeyIn
      );

      // Update projections
      await projectionService.handleInventoryEvent(tenantId, INVENTORY_EVENTS.TRANSFER_OUT, {
        itemId,
        warehouseId: fromWarehouseId,
        quantity
      });

      await projectionService.handleInventoryEvent(tenantId, INVENTORY_EVENTS.TRANSFER_IN, {
        itemId,
        warehouseId: toWarehouseId,
        quantity
      });

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
    return await projectionService.getWarehouseInventory(tenantId, warehouseId);
  }
}

module.exports = new InventoryService();