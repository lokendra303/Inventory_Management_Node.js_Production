const { v4: uuidv4 } = require('uuid');
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const db = require('../../database/connection');
const eventStore = require('../../events/eventStore');
const { INVENTORY_EVENTS, validateEventData, createAggregateId, normalizeItemVariantId } = require('../../events/inventoryEvents');
const projectionService = require('../../projections/inventoryProjections');
const logger = require('../../utils/logger');

function variantPayload(itemVariantId) {
  const v = normalizeItemVariantId(itemVariantId);
  return v ? { itemVariantId: v } : {};
}

class InventoryService {
  async applyProjectionForNewEvent(eventId, institutionId, eventType, eventData) {
    if (!eventId) {
      logger.info('Skipping projection update for duplicate event', {
        institutionId,
        eventType,
        itemId: eventData.itemId,
        warehouseId: eventData.warehouseId || eventData.fromWarehouseId || eventData.toWarehouseId
      });
      return false;
    }

    await projectionService.handleInventoryEvent(institutionId, eventType, eventData);
    return true;
  }

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
    const itemVariantId = normalizeItemVariantId(data.itemVariantId);
    const vOpt = variantPayload(itemVariantId);
    
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

    const aggregateId = createAggregateId(itemId, warehouseId, itemVariantId);
    // FIX #4: Use deterministic key so retries don't create duplicate events
    // grnLineId (passed as poLineId from GRN flow) is stable across retries
    const idempotencyKey = `receive-${poLineId}`;

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
          receivedDate: new Date().toISOString(),
          ...vOpt
        },
        { userId },
        idempotencyKey
      );

      await this.applyProjectionForNewEvent(eventId, institutionId, INVENTORY_EVENTS.PURCHASE_RECEIVED, {
        itemId,
        warehouseId,
        quantity,
        unitCost,
        ...vOpt
      });

      // Fire workflow trigger for stock_received event (non-fatal)
      try {
        const workflowSvc = require('../workflows/workflow.service');
        await workflowSvc.trigger(institutionId, 'stock_received', { itemId, warehouseId, quantity, unitCost });
      } catch (wfErr) { logger.warn('Workflow trigger failed (stock_received)', { error: wfErr.message }); }

      return eventId;
    } catch (error) {
      logger.error('Failed to receive stock', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async reserveStock(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, unitPrice, soId, soLineId } = data;
    const itemVariantId = normalizeItemVariantId(data.itemVariantId);
    const vOpt = variantPayload(itemVariantId);
    
    validateEventData(INVENTORY_EVENTS.SALE_RESERVED, {
      itemId,
      warehouseId,
      quantity,
      unitPrice,
      soId,
      soLineId,
      reservedDate: new Date().toISOString()
    });

    const aggregateId = createAggregateId(itemId, warehouseId, itemVariantId);
    const idempotencyKey = `reserve-${soLineId}`;

    try {
      // Check available stock before reservation
      const currentStock = await projectionService.getInventoryProjection(institutionId, itemId, warehouseId, itemVariantId);
      const availableQty = currentStock ? Number(currentStock.quantity_available) : 0;
      const requestedQty = Number(quantity);
      
      if (availableQty < requestedQty) {
        throw new Error(`Insufficient stock: available ${availableQty}, requested ${requestedQty}`);
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
          reservedDate: new Date().toISOString(),
          ...vOpt
        },
        { userId },
        idempotencyKey
      );

      await this.applyProjectionForNewEvent(eventId, institutionId, INVENTORY_EVENTS.SALE_RESERVED, {
        itemId,
        warehouseId,
        quantity,
        ...vOpt
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to reserve stock', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async shipStock(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, unitPrice, soId, soLineId, shipmentNumber } = data;
    const itemVariantId = normalizeItemVariantId(data.itemVariantId);
    const vOpt = variantPayload(itemVariantId);
    
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

    const aggregateId = createAggregateId(itemId, warehouseId, itemVariantId);
    const idempotencyKey = `ship-${soLineId}-${shipmentNumber}`;

    try {
      const projection = await projectionService.getInventoryProjection(institutionId, itemId, warehouseId, itemVariantId);
      const reservedQty = projection ? Number(projection.quantity_reserved || 0) : 0;
      const availableQty = projection ? Number(projection.quantity_available || 0) : 0;
      const shipQty = Number(quantity);
      const hasSalesOrderRef = Boolean(
        soId &&
        soLineId &&
        soId !== '00000000-0000-0000-0000-000000000000' &&
        soLineId !== '00000000-0000-0000-0000-000000000000'
      );
      if (hasSalesOrderRef && reservedQty < shipQty) {
        throw new Error(`Insufficient reserved stock: reserved ${reservedQty}, requested ${shipQty}`);
      }
      if (!hasSalesOrderRef && availableQty < shipQty) {
        throw new Error(`Insufficient available stock: available ${availableQty}, requested ${shipQty}`);
      }

      if (hasSalesOrderRef && !data.skipSoLineValidation) {
        const soLines = await db.query(
          `SELECT quantity_ordered, quantity_shipped
           FROM sales_order_lines
           WHERE institution_id = ? AND so_id = ? AND id = ?`,
          [institutionId, soId, soLineId]
        );

        if (soLines.length === 0) {
          throw new Error('Sales order line not found for shipment');
        }

        const orderedQty = Number(soLines[0].quantity_ordered || 0);
        const alreadyShipped = Number(soLines[0].quantity_shipped || 0);
        const pending = orderedQty - alreadyShipped;
        if (shipQty > pending) {
          throw new Error(`Cannot ship ${shipQty}; pending quantity is ${pending}`);
        }
      }

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
          shippedDate: new Date().toISOString(),
          ...vOpt
        },
        { userId },
        idempotencyKey
      );

      await this.applyProjectionForNewEvent(eventId, institutionId, INVENTORY_EVENTS.SALE_SHIPPED, {
        itemId,
        warehouseId,
        quantity,
        ...vOpt
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to ship stock', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async adjustStock(institutionId, data, userId) {
    const { itemId, warehouseId, quantityChange, reason, adjustmentType, lossType = 'MANUAL' } = data;
    const itemVariantId = normalizeItemVariantId(data.itemVariantId);
    const vSql = itemVariantId ? ' AND item_variant_id = ? ' : ' AND item_variant_id IS NULL ';
    const vParams = itemVariantId ? [itemVariantId] : [];
    const normalizedLossType = ['MANUAL', 'MISSING', 'DAMAGED', 'EXPIRED'].includes(String(lossType).toUpperCase())
      ? String(lossType).toUpperCase()
      : 'MANUAL';
    const absQty = Math.abs(quantityChange);
    const normalizedChange = adjustmentType === 'decrease' ? -absQty : absQty;

    try {
      return await db.transaction(async (connection) => {
        // Fetch current projection
        const [rows] = await connection.execute(
          `SELECT * FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
          [institutionId, itemId, warehouseId, ...vParams]
        );

        if (rows.length === 0 && normalizedChange < 0) {
          throw new Error('No inventory record found for this item/warehouse');
        }

        if (rows.length > 0) {
          const current = rows[0];
          const onHand = parseFloat(current.quantity_on_hand);
          const reserved = parseFloat(current.quantity_reserved) || 0;
          const avgCost = parseFloat(current.average_cost) || 0;

          // Check item's allowNegativeStock flag
          const [itemRows] = await connection.execute(
            'SELECT allow_negative_stock FROM items WHERE id = ? AND institution_id = ?',
            [itemId, institutionId]
          );
          const allowNegative = itemRows.length > 0 && itemRows[0].allow_negative_stock;

          const newOnHand = onHand + normalizedChange;
          if (!allowNegative && newOnHand < 0) {
            throw new Error(`Insufficient stock: on hand ${onHand}, requested decrease ${absQty}`);
          }

          // quantity_available = new on_hand - reserved
          const newAvailable = Math.max(newOnHand - reserved, 0);
          const newTotalValue = newOnHand * avgCost;

          await connection.execute(
            `UPDATE inventory_projections
             SET quantity_on_hand = ?, quantity_available = ?, total_value = ?, last_movement_date = NOW()
             WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
            [newOnHand, newAvailable, newTotalValue, institutionId, itemId, warehouseId, ...vParams]
          );
        } else {
          // No existing record — create one (increase only, already guarded above)
          await connection.execute(
            `INSERT INTO inventory_projections
             (id, institution_id, item_id, warehouse_id, item_variant_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_movement_date, version)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?, 0, 0, 0, NOW(), 1)`,
            [institutionId, itemId, warehouseId, itemVariantId, absQty, absQty]
          );
        }

        // Record adjustment log
        await connection.execute(
          `INSERT INTO inventory_adjustments
           (id, institution_id, item_id, warehouse_id, adjustment_type, quantity_change, reason, loss_type, adjusted_by, reference_number)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), institutionId, itemId, warehouseId, adjustmentType, absQty, reason || null, normalizedLossType, userId, `ADJ-${Date.now()}`]
        );

        logger.info('Stock adjusted', { institutionId, itemId, warehouseId, adjustmentType, absQty, userId });

        // Fire workflow trigger for stock_adjusted event (non-fatal)
        try {
          const workflowSvc = require('../workflows/workflow.service');
          const proj = await db.query(
            `SELECT quantity_available, quantity_on_hand FROM inventory_projections WHERE institution_id=? AND item_id=? AND warehouse_id=?${vSql}`,
            [institutionId, itemId, warehouseId, ...vParams]
          );
          const qty = proj[0]?.quantity_available || 0;
          await workflowSvc.trigger(institutionId, 'stock_adjusted', { itemId, warehouseId, quantity: qty, adjustmentType });
        } catch (wfErr) { logger.warn('Workflow trigger failed (stock_adjusted)', { error: wfErr.message }); }

        return 'success';
      });
    } catch (error) {
      logger.error('Failed to adjust stock', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async transferStock(institutionId, data, userId) {
    const { itemId, fromWarehouseId, toWarehouseId, quantity } = data;
    let { transferId } = data;
    if (!transferId || String(transferId).toLowerCase() === NIL_UUID) {
      transferId = uuidv4();
    }
    const itemVariantId = normalizeItemVariantId(data.itemVariantId);
    const vOpt = variantPayload(itemVariantId);
    const vSql = itemVariantId ? ' AND item_variant_id = ? ' : ' AND item_variant_id IS NULL ';
    const vParams = itemVariantId ? [itemVariantId] : [];
    
    if (fromWarehouseId === toWarehouseId) {
      throw new Error('Source and destination warehouses cannot be the same');
    }
    
    try {
      // Get source projection to validate stock and carry over average_cost
      const sourceProjection = await db.query(
        `SELECT quantity_available, average_cost FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
        [institutionId, itemId, fromWarehouseId, ...vParams]
      );

      if (sourceProjection.length === 0) {
        throw new Error('No inventory found in source warehouse');
      }

      const availableQty = Number(sourceProjection[0].quantity_available);
      const requestedQty = Number(quantity);

      if (availableQty < requestedQty) {
        throw new Error(`Insufficient stock: available ${availableQty}, requested ${requestedQty}`);
      }

      // Record transfer event for history
      const transferDate = new Date().toISOString();
      const idempotencyKey = `transfer-${transferId}`;
      const outEventId = await eventStore.appendEvent(
        institutionId, 'inventory',
        createAggregateId(itemId, fromWarehouseId, itemVariantId),
        INVENTORY_EVENTS.TRANSFER_OUT,
        { itemId, fromWarehouseId, toWarehouseId, quantity: requestedQty, transferId, transferDate, ...vOpt },
        { userId },
        idempotencyKey
      );
      const inEventId = await eventStore.appendEvent(
        institutionId, 'inventory',
        createAggregateId(itemId, toWarehouseId, itemVariantId),
        INVENTORY_EVENTS.TRANSFER_IN,
        { itemId, fromWarehouseId, toWarehouseId, quantity: requestedQty, transferId, transferDate, ...vOpt },
        { userId },
        `${idempotencyKey}-in`
      );

      await this.applyProjectionForNewEvent(outEventId, institutionId, INVENTORY_EVENTS.TRANSFER_OUT, {
        itemId,
        fromWarehouseId,
        toWarehouseId,
        quantity: requestedQty,
        ...vOpt
      });
      await this.applyProjectionForNewEvent(inEventId, institutionId, INVENTORY_EVENTS.TRANSFER_IN, {
        itemId,
        fromWarehouseId,
        toWarehouseId,
        quantity: requestedQty,
        ...vOpt
      });

      return transferId;
    } catch (error) {
      logger.error('Failed to transfer stock', { institutionId, itemId, fromWarehouseId, toWarehouseId, error: error.message });
      throw error;
    }
  }

  async revertTransfer(institutionId, transferId, userId) {
    const rows = await db.query(
      `SELECT event_data FROM event_store
       WHERE institution_id = ? AND event_type = 'TransferOut'
         AND JSON_UNQUOTE(JSON_EXTRACT(event_data, '$.transferId')) = ?
       LIMIT 1`,
      [institutionId, transferId]
    );

    if (rows.length === 0) throw new Error('Transfer not found');

    const raw = rows[0].event_data;
    const ed = (raw && typeof raw === 'object') ? raw : JSON.parse(raw || '{}');
    const { itemId, fromWarehouseId, toWarehouseId, quantity } = ed;
    const itemVariantId = normalizeItemVariantId(ed.itemVariantId);
    const vOpt = variantPayload(itemVariantId);
    const vSql = itemVariantId ? ' AND item_variant_id = ? ' : ' AND item_variant_id IS NULL ';
    const vParams = itemVariantId ? [itemVariantId] : [];

    const destProjection = await db.query(
      `SELECT quantity_available, average_cost FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
      [institutionId, itemId, toWarehouseId, ...vParams]
    );

    if (destProjection.length === 0) throw new Error('Destination warehouse inventory not found');

    const availableAtDest = Number(destProjection[0].quantity_available);
    if (availableAtDest < quantity) {
      throw new Error(`Cannot revert: destination only has ${availableAtDest} available, need ${quantity}`);
    }

    const revertId = uuidv4();
    const revertDate = new Date().toISOString();
    const idempotencyKey = `revert-${transferId}`;
    await eventStore.appendEvent(
      institutionId, 'inventory',
      createAggregateId(itemId, toWarehouseId, itemVariantId),
      INVENTORY_EVENTS.TRANSFER_OUT,
      { itemId, fromWarehouseId: toWarehouseId, toWarehouseId: fromWarehouseId, quantity, transferId: revertId, transferDate: revertDate, ...vOpt },
      { userId },
      idempotencyKey
    );
    await eventStore.appendEvent(
      institutionId, 'inventory',
      createAggregateId(itemId, fromWarehouseId, itemVariantId),
      INVENTORY_EVENTS.TRANSFER_IN,
      { itemId, fromWarehouseId: toWarehouseId, toWarehouseId: fromWarehouseId, quantity, transferId: revertId, transferDate: revertDate, ...vOpt },
      { userId },
      `${idempotencyKey}-in`
    );

    await projectionService.handleInventoryEvent(institutionId, INVENTORY_EVENTS.TRANSFER_OUT, {
      itemId,
      fromWarehouseId: toWarehouseId,
      toWarehouseId: fromWarehouseId,
      quantity,
      ...vOpt
    });
    await projectionService.handleInventoryEvent(institutionId, INVENTORY_EVENTS.TRANSFER_IN, {
      itemId,
      fromWarehouseId: toWarehouseId,
      toWarehouseId: fromWarehouseId,
      quantity,
      ...vOpt
    });

    logger.info('Transfer reverted', { transferId, revertId, institutionId, userId });
    return revertId;
  }

  async getTransferHistory(institutionId, limit = 100, offset = 0) {
    // LIMIT/OFFSET must be literals: bound placeholders break mysql2 prepared
    // execution with ER_WRONG_ARGUMENTS / "Incorrect arguments to mysqld_stmt_execute".
    const lim = Math.min(Math.max(Number.parseInt(String(limit), 10) || 100, 1), 1000);
    const off = Math.max(Number.parseInt(String(offset), 10) || 0, 0);
    const rows = await db.query(
      `SELECT 
         es.id, es.event_data, es.created_at, es.created_by,
         i.name as item_name, i.sku,
         fw.name as from_warehouse_name,
         tw.name as to_warehouse_name,
         CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as created_by_name,
         u.email as created_by_email
       FROM event_store es
       JOIN items i ON JSON_UNQUOTE(JSON_EXTRACT(es.event_data, '$.itemId')) = i.id
       JOIN warehouses fw ON JSON_UNQUOTE(JSON_EXTRACT(es.event_data, '$.fromWarehouseId')) = fw.id
       JOIN warehouses tw ON JSON_UNQUOTE(JSON_EXTRACT(es.event_data, '$.toWarehouseId')) = tw.id
       LEFT JOIN institution_users u ON es.created_by = u.id AND u.institution_id = es.institution_id
       WHERE es.institution_id = ? AND es.event_type = 'TransferOut'
       ORDER BY es.created_at DESC
       LIMIT ${lim} OFFSET ${off}`,
      [institutionId]
    );

    return rows.map(r => {
      const ed = (r.event_data && typeof r.event_data === 'object') ? r.event_data : JSON.parse(r.event_data || '{}');
      return {
        id: r.id,
        transferId: ed.transferId,
        itemId: ed.itemId,
        fromWarehouseId: ed.fromWarehouseId,
        toWarehouseId: ed.toWarehouseId,
        quantity: ed.quantity,
        transferDate: ed.transferDate,
        item_name: r.item_name,
        sku: r.sku,
        from_warehouse_name: r.from_warehouse_name,
        to_warehouse_name: r.to_warehouse_name,
        created_at: r.created_at,
        created_by: r.created_by,
        performed_by: String(r.created_by_name || '').trim() || r.created_by_email || r.created_by || '-'
      };
    });
  }

  async getInventoryHistory(institutionId, itemId, warehouseId, itemVariantId = null) {
    const aggregateId = createAggregateId(itemId, warehouseId, normalizeItemVariantId(itemVariantId));
    return await eventStore.getEvents(institutionId, 'inventory', aggregateId);
  }

  async getCurrentStock(institutionId, itemId, warehouseId, itemVariantId = null) {
    return await projectionService.getInventoryProjection(institutionId, itemId, warehouseId, itemVariantId);
  }

  async returnSale(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, unitPrice, soId, soLineId, returnReason } = data;
    const itemVariantId = normalizeItemVariantId(data.itemVariantId);
    const vOpt = variantPayload(itemVariantId);
    
    validateEventData(INVENTORY_EVENTS.SALE_RETURNED, {
      itemId,
      warehouseId,
      quantity,
      unitPrice,
      soId,
      soLineId,
      returnedDate: new Date().toISOString()
    });

    const aggregateId = createAggregateId(itemId, warehouseId, itemVariantId);
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
          returnedDate: new Date().toISOString(),
          ...vOpt
        },
        { userId },
        idempotencyKey
      );

      await this.applyProjectionForNewEvent(eventId, institutionId, INVENTORY_EVENTS.SALE_RETURNED, {
        itemId,
        warehouseId,
        quantity,
        ...vOpt
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to return sale', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async returnPurchase(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, unitCost, poId, poLineId, returnReason } = data;
    const itemVariantId = normalizeItemVariantId(data.itemVariantId);
    const vOpt = variantPayload(itemVariantId);
    
    validateEventData(INVENTORY_EVENTS.PURCHASE_RETURNED, {
      itemId,
      warehouseId,
      quantity,
      unitCost,
      poId,
      poLineId,
      returnedDate: new Date().toISOString()
    });

    const aggregateId = createAggregateId(itemId, warehouseId, itemVariantId);
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
          returnedDate: new Date().toISOString(),
          ...vOpt
        },
        { userId },
        idempotencyKey
      );

      await this.applyProjectionForNewEvent(eventId, institutionId, INVENTORY_EVENTS.PURCHASE_RETURNED, {
        itemId,
        warehouseId,
        quantity,
        ...vOpt
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to return purchase', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async markDamaged(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, reason } = data;
    const itemVariantId = normalizeItemVariantId(data.itemVariantId);
    const vOpt = variantPayload(itemVariantId);
    
    const aggregateId = createAggregateId(itemId, warehouseId, itemVariantId);
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
          damagedDate: new Date().toISOString(),
          ...vOpt
        },
        { userId },
        idempotencyKey
      );

      await this.applyProjectionForNewEvent(eventId, institutionId, INVENTORY_EVENTS.STOCK_DAMAGED, {
        itemId,
        warehouseId,
        quantity,
        ...vOpt
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to mark damaged', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async markExpired(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, expiryDate } = data;
    const itemVariantId = normalizeItemVariantId(data.itemVariantId);
    const vOpt = variantPayload(itemVariantId);
    
    const aggregateId = createAggregateId(itemId, warehouseId, itemVariantId);
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
          expiredDate: new Date().toISOString(),
          ...vOpt
        },
        { userId },
        idempotencyKey
      );

      await this.applyProjectionForNewEvent(eventId, institutionId, INVENTORY_EVENTS.STOCK_EXPIRED, {
        itemId,
        warehouseId,
        quantity,
        ...vOpt
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to mark expired', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async getAdjustments(institutionId, { itemId, warehouseId, limit = 50, offset = 0 } = {}) {
    let query = `
      SELECT ia.*, i.name as item_name, i.sku, w.name as warehouse_name,
             CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as adjusted_by_name
      FROM inventory_adjustments ia
      JOIN items i ON ia.item_id = i.id
      LEFT JOIN warehouses w ON ia.warehouse_id = w.id
      LEFT JOIN institution_users u ON ia.adjusted_by = u.id
      WHERE ia.institution_id = ?`;
    const params = [institutionId];

    if (itemId) { query += ' AND ia.item_id = ?'; params.push(itemId); }
    if (warehouseId) { query += ' AND ia.warehouse_id = ?'; params.push(warehouseId); }

    const lim = Math.min(Math.max(Number.parseInt(String(limit), 10) || 50, 1), 1000);
    const off = Math.max(Number.parseInt(String(offset), 10) || 0, 0);
    query += ` ORDER BY ia.created_at DESC LIMIT ${lim} OFFSET ${off}`;
    return db.query(query, params);
  }

  async getWarehouseStock(institutionId, warehouseId) {
    return await projectionService.getWarehouseInventory(institutionId, warehouseId);
  }

  async validateWarehouseAccess(institutionId, userId, warehouseId) {
    const warehouseService = require('../warehouse/warehouse.service');
    return await warehouseService.checkWarehouseAccess(institutionId, userId, warehouseId);
  }

  async releaseReservedStock(institutionId, data, userId) {
    const { itemId, warehouseId, quantity, soId, soLineId } = data;
    const itemVariantId = normalizeItemVariantId(data.itemVariantId);
    const vOpt = variantPayload(itemVariantId);
    
    validateEventData(INVENTORY_EVENTS.SALE_RESERVATION_CANCELLED, {
      itemId,
      warehouseId,
      quantity,
      soId,
      soLineId,
      cancelledDate: new Date().toISOString()
    });

    const aggregateId = createAggregateId(itemId, warehouseId, itemVariantId);
    const idempotencyKey = `release-${soLineId}`;

    try {
      const eventId = await eventStore.appendEvent(
        institutionId,
        'inventory',
        aggregateId,
        INVENTORY_EVENTS.SALE_RESERVATION_CANCELLED,
        {
          itemId,
          warehouseId,
          quantity,
          soId,
          soLineId,
          cancelledDate: new Date().toISOString(),
          ...vOpt
        },
        { userId },
        idempotencyKey
      );

      await this.applyProjectionForNewEvent(eventId, institutionId, INVENTORY_EVENTS.SALE_RESERVATION_CANCELLED, {
        itemId,
        warehouseId,
        quantity,
        ...vOpt
      });

      return eventId;
    } catch (error) {
      logger.error('Failed to release reserved stock', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }

  async deleteInventory(institutionId, itemId, warehouseId, userId, itemVariantId = null) {
    try {
      const vid = normalizeItemVariantId(itemVariantId);
      const vSql = vid ? ' AND item_variant_id = ? ' : ' AND item_variant_id IS NULL ';
      const vParams = vid ? [vid] : [];
      const current = await db.query(
        `SELECT quantity_on_hand, quantity_reserved FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
        [institutionId, itemId, warehouseId, ...vParams]
      );
      if (!current.length) {
        throw new Error('Inventory record not found');
      }
      if (Number(current[0].quantity_on_hand || 0) !== 0 || Number(current[0].quantity_reserved || 0) !== 0) {
        throw new Error('Cannot delete inventory with non-zero on-hand or reserved quantity');
      }
      const history = await db.query(
        `SELECT COUNT(*) as count
         FROM event_store
         WHERE institution_id = ? AND aggregate_type = 'inventory' AND aggregate_id = ?`,
        [institutionId, createAggregateId(itemId, warehouseId, vid)]
      );
      if (Number(history[0]?.count || 0) > 0) {
        throw new Error('Cannot delete inventory with event history; use stock adjustment workflow');
      }

      // Delete inventory projection
      const result = await db.query(
        `DELETE FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?${vSql}`,
        [institutionId, itemId, warehouseId, ...vParams]
      );

      logger.info('Inventory deleted', { itemId, warehouseId, institutionId, userId });
      return true;
    } catch (error) {
      logger.error('Failed to delete inventory', { institutionId, itemId, warehouseId, error: error.message });
      throw error;
    }
  }
}

module.exports = new InventoryService();