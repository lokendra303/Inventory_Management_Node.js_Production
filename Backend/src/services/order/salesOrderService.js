const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const inventoryService = require('../inventory/inventoryService');
const warehouseOptimizationService = require('../warehouse/warehouseOptimizationService');

class SalesOrderService {
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

    try {
      await db.transaction(async (connection) => {
        // Create SO header without warehouse_id (multi-warehouse order)
        await connection.execute(
          `INSERT INTO sales_orders 
           (id, institution_id, so_number, customer_id, customer_name, channel, currency, 
            order_date, expected_ship_date, notes, created_by, status, is_preorder, shipping_method) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
          [soId, institutionId, soNumber, customerId || null, customerName, channel, currency, 
           orderDate || null, expectedShipDate || null, notes || null, userId, isPreorder, shippingMethod]
        );

        // Create SO lines with warehouse per line
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineId = uuidv4();
          const lineTotal = line.quantity * line.unitPrice;
          subtotal += lineTotal;
          
          if (isPreorder) {
            totalCommittedDemand += line.quantity;
          }

          await connection.execute(
            `INSERT INTO sales_order_lines 
             (id, institution_id, so_id, item_id, warehouse_id, line_number, quantity_ordered, unit_price, line_total) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lineId, institutionId, soId, line.itemId, line.warehouseId, i + 1, line.quantity, line.unitPrice, lineTotal]
          );
        }

        // Update SO totals
        await connection.execute(
          'UPDATE sales_orders SET subtotal = ?, total_amount = ?, committed_demand = ? WHERE id = ?',
          [subtotal, subtotal, totalCommittedDemand, soId]
        );
      });

      logger.info('Multi-warehouse sales order created', { soId, institutionId, soNumber, userId, isPreorder });
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
      `SELECT sol.*, i.sku, i.name as item_name, i.unit, w.name as warehouse_name
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