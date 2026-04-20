const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const inventoryService = require('../inventory/inventory.service');
const warehouseOptimizationService = require('../warehouse/warehouseOptimization.service');

class SalesOrderService {
  async shipSalesOrder(institutionId, soId, shipmentData, userId) {
    const shipmentNumber = shipmentData.shipmentNumber || `SHIP-${Date.now()}`;
    const linesToShip = Array.isArray(shipmentData.lines) ? shipmentData.lines : [];

    if (linesToShip.length === 0) {
      throw new Error('At least one shipment line is required');
    }

    return db.transaction(async (connection) => {
      const [soRows] = await connection.execute(
        'SELECT id, so_number, status FROM sales_orders WHERE institution_id = ? AND id = ?',
        [institutionId, soId]
      );

      if (soRows.length === 0) {
        throw new Error('Sales order not found');
      }

      const so = soRows[0];
      if (!['confirmed', 'partially_shipped'].includes(so.status)) {
        throw new Error(`Cannot create shipment for SO in status "${so.status}"`);
      }

      const [soLines] = await connection.execute(
        `SELECT id, item_id, warehouse_id, unit_price, quantity_ordered, quantity_shipped
         FROM sales_order_lines
         WHERE institution_id = ? AND so_id = ?`,
        [institutionId, soId]
      );

      const lineMap = new Map(soLines.map((line) => [line.id, line]));

      for (const line of linesToShip) {
        if (!line.soLineId || typeof line.soLineId !== 'string') {
          throw new Error('Each shipment line must include soLineId');
        }
        const qty = Number(line.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error('Shipment quantity must be a positive number');
        }

        const soLine = lineMap.get(line.soLineId);
        if (!soLine) {
          throw new Error(`SO line not found: ${line.soLineId}`);
        }

        const ordered = Number(soLine.quantity_ordered || 0);
        const alreadyShipped = Number(soLine.quantity_shipped || 0);
        const pending = ordered - alreadyShipped;
        if (qty > pending) {
          throw new Error(`Cannot ship ${qty} for line ${line.soLineId}. Pending: ${pending}`);
        }

        await inventoryService.shipStock(institutionId, {
          itemId: soLine.item_id,
          warehouseId: soLine.warehouse_id,
          quantity: qty,
          unitPrice: Number(soLine.unit_price || 0),
          soId,
          soLineId: soLine.id,
          shipmentNumber
        }, userId);

        const newShipped = alreadyShipped + qty;
        const nextStatus = newShipped >= ordered ? 'shipped' : 'partially_shipped';
        await connection.execute(
          `UPDATE sales_order_lines
           SET quantity_shipped = ?, status = ?, updated_at = NOW()
           WHERE institution_id = ? AND id = ?`,
          [newShipped, nextStatus, institutionId, soLine.id]
        );
      }

      const [totalsRows] = await connection.execute(
        `SELECT
            COALESCE(SUM(quantity_ordered), 0) AS totalOrdered,
            COALESCE(SUM(quantity_shipped), 0) AS totalShipped
         FROM sales_order_lines
         WHERE institution_id = ? AND so_id = ?`,
        [institutionId, soId]
      );
      const totalOrdered = Number(totalsRows[0].totalOrdered || 0);
      const totalShipped = Number(totalsRows[0].totalShipped || 0);

      let soStatus = 'confirmed';
      if (totalShipped >= totalOrdered && totalOrdered > 0) {
        soStatus = 'shipped';
      } else if (totalShipped > 0) {
        soStatus = 'partially_shipped';
      }

      await connection.execute(
        'UPDATE sales_orders SET status = ?, updated_at = NOW() WHERE institution_id = ? AND id = ?',
        [soStatus, institutionId, soId]
      );

      logger.info('SO shipment created', {
        institutionId,
        soId,
        shipmentNumber,
        lines: linesToShip.length,
        totalOrdered,
        totalShipped,
        status: soStatus,
        userId
      });

      return {
        soId,
        soNumber: so.so_number,
        shipmentNumber,
        status: soStatus,
        totalOrdered,
        totalShipped
      };
    });
  }

  async createSalesOrder(institutionId, soData, userId) {
    const {
      soNumber,
      customerId,
      customerName,
      channel = 'direct',
      currency = 'USD',
      orderDate,
      expectedShipDate,
      notes,
      lines,
      isPreorder = false,
      customerAddress,
      shippingMethod = 'standard'
    } = soData;

    const soId = uuidv4();
    let subtotal = 0;
    let totalCommittedDemand = 0;
    const createdLines = [];

    try {
      await db.transaction(async (connection) => {
        // Create SO header without warehouse_id (multi-warehouse order)
        await connection.execute(
          `INSERT INTO sales_orders 
           (id, institution_id, so_number, customer_id, customer_name, channel, currency, 
            order_date, expected_ship_date, notes, created_by, status, is_preorder, shipping_method) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
          [soId, institutionId, soNumber || `SO-${Date.now()}`, customerId || null, customerName, channel, currency, 
           orderDate || null, expectedShipDate || null, notes || null, userId, isPreorder, shippingMethod]
        );

        // Create SO lines with warehouse per line
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineId = uuidv4();
          const lineTotal     = line.quantity * line.unitPrice;
          const discountRate  = line.discountRate || 0;
          const discountAmt   = Math.round(lineTotal * discountRate / 100 * 100) / 100;
          const afterDiscount = lineTotal - discountAmt;
          const taxRate       = line.taxRate || 0;
          const taxAmount     = Math.round(afterDiscount * taxRate / 100 * 100) / 100;
          const lineFinal     = afterDiscount + taxAmount;
          subtotal += lineFinal;
          
          if (isPreorder) {
            totalCommittedDemand += line.quantity;
          }

          await connection.execute(
            `INSERT INTO sales_order_lines 
             (id, institution_id, so_id, item_id, warehouse_id, line_number, quantity_ordered, unit_price, line_total, tax_rate, tax_amount, discount_rate, discount_amount) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lineId, institutionId, soId, line.itemId, line.warehouseId, i + 1, line.quantity, line.unitPrice, lineFinal, taxRate, taxAmount, discountRate, discountAmt]
          );

          createdLines.push({
            lineId,
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            quantity: line.quantity,
            unitPrice: line.unitPrice
          });
        }

        // Update SO totals
        await connection.execute(
          'UPDATE sales_orders SET subtotal = ?, total_amount = ?, committed_demand = ? WHERE id = ?',
          [subtotal, subtotal, totalCommittedDemand, soId]
        );

        // Reserve stock for each line item
        for (const line of createdLines) {
          await inventoryService.reserveStock(institutionId, {
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            soId: soId,
            soLineId: line.lineId
          }, userId);
        }
      });

      logger.info('Multi-warehouse sales order created with stock reserved', { soId, institutionId, soNumber, userId, isPreorder });
      return soId;
    } catch (error) {
      logger.error('Failed to create sales order', { institutionId, soNumber, error: error.message });
      throw error;
    }
  }

  async getSalesOrders(institutionId, filters = {}) {
    let query = `
      SELECT so.*, c.display_name as customer_name, w.name as warehouse_name,
             COUNT(sol.id) as line_count,
             SUM(sol.quantity_ordered) as total_quantity_ordered,
             SUM(sol.quantity_shipped) as total_quantity_shipped
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN warehouses w ON so.warehouse_id = w.id
      LEFT JOIN sales_order_lines sol ON so.id = sol.so_id
      WHERE so.institution_id = ?
    `;
    const params = [institutionId];

    if (filters.status) {
      query += ' AND so.status = ?';
      params.push(filters.status);
    }

    query += ' GROUP BY so.id ORDER BY so.created_at DESC';

    return await db.query(query, params);
  }

  async getSalesOrder(institutionId, soId) {
    const sos = await db.query(
      `SELECT so.*, COALESCE(c.display_name, so.customer_name) as customer_name, w.name as warehouse_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       LEFT JOIN warehouses w ON so.warehouse_id = w.id
       WHERE so.institution_id = ? AND so.id = ?`,
      [institutionId, soId]
    );

    if (sos.length === 0) return null;

    const so = sos[0];

    // Get SO lines
    const lines = await db.query(
      `SELECT sol.*, i.hsn_code, i.name as item_name, i.unit, w.name as warehouse_name
       FROM sales_order_lines sol
       JOIN items i ON sol.item_id = i.id
       LEFT JOIN warehouses w ON sol.warehouse_id = w.id
       WHERE sol.institution_id = ? AND sol.so_id = ?
       ORDER BY sol.line_number`,
      [institutionId, soId]
    );

    return { ...so, lines };
  }
  async reserveStock(institutionId, soData, userId) {
    const { soId, lines } = soData;

    try {
      await db.transaction(async (connection) => {
        for (const line of lines) {
          await inventoryService.reserveStock(institutionId, {
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            soId,
            soLineId: line.id
          }, userId);

          await connection.execute(
            'UPDATE sales_order_lines SET status = "reserved" WHERE id = ?',
            [line.id]
          );
        }
      });

      logger.info('Stock reserved for SO', { soId, institutionId, userId });
    } catch (error) {
      logger.error('Failed to reserve stock for SO', { soId, institutionId, error: error.message });
      throw error;
    }
  }

  async shipStock(institutionId, soData, userId) {
    const { soId, lines, shipmentNumber } = soData;

    try {
      await db.transaction(async (connection) => {
        for (const line of lines) {
          await inventoryService.shipStock(institutionId, {
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            quantity: line.quantityShipped,
            unitPrice: line.unitPrice,
            soId,
            soLineId: line.id,
            shipmentNumber
          }, userId);

          await connection.execute(
            'UPDATE sales_order_lines SET quantity_shipped = quantity_shipped + ?, status = "shipped" WHERE id = ?',
            [line.quantityShipped, line.id]
          );
        }
      });

      logger.info('Stock shipped for SO', { soId, institutionId, userId });
    } catch (error) {
      logger.error('Failed to ship stock for SO', { soId, institutionId, error: error.message });
      throw error;
    }
  }
  async updateSOStatus(institutionId, soId, status, userId) {
    const result = await db.query(
      'UPDATE sales_orders SET status = ?, updated_at = NOW() WHERE institution_id = ? AND id = ?',
      [status, institutionId, soId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Sales order not found');
    }

    logger.info('SO status updated', { soId, institutionId, status, userId });
  }

  async cancelSalesOrder(institutionId, soId, cancellationReason, userId) {
    try {
      await db.transaction(async (connection) => {
        // Get SO details
        const [so] = await connection.execute(
          'SELECT status FROM sales_orders WHERE institution_id = ? AND id = ?',
          [institutionId, soId]
        );

        if (so.length === 0) {
          throw new Error('Sales order not found');
        }

        if (so[0].status === 'confirmed') {
          throw new Error('Cannot cancel confirmed sales order');
        }

        // Get SO lines to release reserved stock
        const lines = await connection.execute(
          'SELECT id, item_id, warehouse_id, quantity_ordered FROM sales_order_lines WHERE institution_id = ? AND so_id = ?',
          [institutionId, soId]
        );

        // Release reserved stock for each line
        for (const line of lines[0]) {
          await inventoryService.releaseReservedStock(institutionId, {
            itemId: line.item_id,
            warehouseId: line.warehouse_id,
            quantity: line.quantity_ordered,
            soId: soId,
            soLineId: line.id
          }, userId);
        }

        // Update SO status to cancelled
        await connection.execute(
          'UPDATE sales_orders SET status = ?, cancellation_reason = ?, updated_at = NOW() WHERE institution_id = ? AND id = ?',
          ['cancelled', cancellationReason, institutionId, soId]
        );
      });

      logger.info('SO cancelled and stock released', { soId, institutionId, userId, cancellationReason });
    } catch (error) {
      logger.error('Failed to cancel sales order', { soId, institutionId, error: error.message });
      throw error;
    }
  }

  /**
   * Get warehouse recommendations for an order
   */
  async getWarehouseRecommendations(institutionId, orderData) {
    try {
      return await warehouseOptimizationService.getOptimalWarehouse(institutionId, orderData);
    } catch (error) {
      logger.error('Failed to get warehouse recommendations', { institutionId, error: error.message });
      throw error;
    }
  }

  /**
   * Get multi-warehouse stock availability
   */
  async getStockAvailability(institutionId, items) {
    try {
      return await warehouseOptimizationService.getMultiWarehouseAvailability(institutionId, items);
    } catch (error) {
      logger.error('Failed to get stock availability', { institutionId, error: error.message });
      throw error;
    }
  }

  /**
   * Calculate order fulfillment cost
   */
  async calculateOrderCost(institutionId, warehouseId, orderData) {
    try {
      return await warehouseOptimizationService.calculateFulfillmentCost(institutionId, warehouseId, orderData);
    } catch (error) {
      logger.error('Failed to calculate order cost', { institutionId, warehouseId, error: error.message });
      throw error;
    }
  }
}

module.exports = new SalesOrderService();