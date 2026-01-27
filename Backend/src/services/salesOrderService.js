const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');
const inventoryService = require('./inventoryService');

class SalesOrderService {
  async createSalesOrder(tenantId, soData, userId) {
    const {
      soNumber,
      customerId,
      customerName,
      warehouseId,
      channel = 'direct',
      currency = 'USD',
      orderDate,
      expectedShipDate,
      notes,
      lines,
      isPreorder = false
    } = soData;

    const soId = uuidv4();
    let subtotal = 0;
    let totalCommittedDemand = 0;

    try {
      await db.transaction(async (connection) => {
        // Create SO header
        await connection.execute(
          `INSERT INTO sales_orders 
           (id, tenant_id, so_number, customer_id, customer_name, warehouse_id, channel, currency, 
            order_date, expected_ship_date, notes, created_by, status, is_preorder) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
          [soId, tenantId, soNumber, customerId || null, customerName, warehouseId, channel, currency, 
           orderDate || null, expectedShipDate || null, notes || null, userId, isPreorder]
        );

        // Create SO lines
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
             (id, tenant_id, so_id, item_id, line_number, quantity_ordered, unit_price, line_total) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [lineId, tenantId, soId, line.itemId, i + 1, line.quantity, line.unitPrice, lineTotal]
          );
        }

        // Update SO totals
        await connection.execute(
          'UPDATE sales_orders SET subtotal = ?, total_amount = ?, committed_demand = ? WHERE id = ?',
          [subtotal, subtotal, totalCommittedDemand, soId]
        );
      });

      logger.info('Sales order created', { soId, tenantId, soNumber, userId, isPreorder });
      return soId;
    } catch (error) {
      logger.error('Failed to create sales order', { tenantId, soNumber, error: error.message });
      throw error;
    }
  }

  async getSalesOrders(tenantId, filters = {}) {
    let query = `
      SELECT so.*, c.name as customer_name, w.name as warehouse_name,
             COUNT(sol.id) as line_count,
             SUM(sol.quantity_ordered) as total_quantity_ordered,
             SUM(sol.quantity_shipped) as total_quantity_shipped
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN warehouses w ON so.warehouse_id = w.id
      LEFT JOIN sales_order_lines sol ON so.id = sol.so_id
      WHERE so.tenant_id = ?
    `;
    const params = [tenantId];

    if (filters.status) {
      query += ' AND so.status = ?';
      params.push(filters.status);
    }

    query += ' GROUP BY so.id ORDER BY so.created_at DESC';

    return await db.query(query, params);
  }

  async getSalesOrder(tenantId, soId) {
    const sos = await db.query(
      `SELECT so.*, COALESCE(c.name, so.customer_name) as customer_name, w.name as warehouse_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       LEFT JOIN warehouses w ON so.warehouse_id = w.id
       WHERE so.tenant_id = ? AND so.id = ?`,
      [tenantId, soId]
    );

    if (sos.length === 0) return null;

    const so = sos[0];

    // Get SO lines
    const lines = await db.query(
      `SELECT sol.*, i.sku, i.name as item_name, i.unit
       FROM sales_order_lines sol
       JOIN items i ON sol.item_id = i.id
       WHERE sol.tenant_id = ? AND sol.so_id = ?
       ORDER BY sol.line_number`,
      [tenantId, soId]
    );

    return { ...so, lines };
  }
  async reserveStock(tenantId, soData, userId) {
    const { soId, warehouseId, lines } = soData;

    try {
      await db.transaction(async (connection) => {
        for (const line of lines) {
          // Reserve inventory for each line
          await inventoryService.reserveStock(tenantId, {
            itemId: line.itemId,
            warehouseId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            soId,
            soLineId: line.id
          }, userId);

          // Update SO line status
          await connection.execute(
            'UPDATE sales_order_lines SET status = "reserved" WHERE id = ?',
            [line.id]
          );
        }
      });

      logger.info('Stock reserved for SO', { soId, tenantId, userId });
    } catch (error) {
      logger.error('Failed to reserve stock for SO', { soId, tenantId, error: error.message });
      throw error;
    }
  }

  async shipStock(tenantId, soData, userId) {
    const { soId, warehouseId, lines, shipmentNumber } = soData;

    try {
      await db.transaction(async (connection) => {
        for (const line of lines) {
          // Ship inventory for each line
          await inventoryService.shipStock(tenantId, {
            itemId: line.itemId,
            warehouseId,
            quantity: line.quantityShipped,
            unitPrice: line.unitPrice,
            soId,
            soLineId: line.id,
            shipmentNumber
          }, userId);

          // Update SO line quantities
          await connection.execute(
            'UPDATE sales_order_lines SET quantity_shipped = quantity_shipped + ?, status = "shipped" WHERE id = ?',
            [line.quantityShipped, line.id]
          );
        }
      });

      logger.info('Stock shipped for SO', { soId, tenantId, userId });
    } catch (error) {
      logger.error('Failed to ship stock for SO', { soId, tenantId, error: error.message });
      throw error;
    }
  }
  async updateSOStatus(tenantId, soId, status, userId) {
    try {
      // Get SO details for inventory operations
      const so = await this.getSalesOrder(tenantId, soId);
      if (!so) throw new Error('Sales order not found');

      // Handle inventory based on status
      if (status === 'confirmed') {
        await this.reserveStock(tenantId, {
          soId,
          warehouseId: so.warehouse_id,
          lines: so.lines.map(line => ({
            id: line.id,
            itemId: line.item_id,
            quantity: line.quantity_ordered,
            unitPrice: line.unit_price
          }))
        }, userId);
      } else if (status === 'shipped') {
        await this.shipStock(tenantId, {
          soId,
          warehouseId: so.warehouse_id,
          shipmentNumber: `SHIP-${Date.now()}`,
          lines: so.lines.map(line => ({
            id: line.id,
            itemId: line.item_id,
            quantityShipped: line.quantity_ordered - (line.quantity_shipped || 0),
            unitPrice: line.unit_price
          }))
        }, userId);
      }

      const result = await db.query(
        'UPDATE sales_orders SET status = ?, updated_at = NOW() WHERE tenant_id = ? AND id = ?',
        [status, tenantId, soId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Sales order not found');
      }

      logger.info('SO status updated', { soId, tenantId, status, userId });
    } catch (error) {
      logger.error('Failed to update SO status', { soId, tenantId, status, error: error.message });
      throw error;
    }
  }
}

module.exports = new SalesOrderService();