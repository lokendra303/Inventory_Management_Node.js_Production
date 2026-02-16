const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const inventoryService = require('../inventory/inventoryService');

class SOConfirmationService {
  /**
   * Automatically process sales order confirmation
   * This reduces inventory and creates shipment records
   */
  async processSOConfirmation(institutionId, soId, userId) {
    try {
      await db.transaction(async (connection) => {
        // Get SO details
        const [soResult] = await connection.execute(
          `SELECT so.*, w.name as warehouse_name 
           FROM sales_orders so 
           LEFT JOIN warehouses w ON so.warehouse_id = w.id 
           WHERE so.institution_id = ? AND so.id = ?`,
          [institutionId, soId]
        );

        if (soResult.length === 0) {
          throw new Error('Sales order not found');
        }

        const so = soResult[0];

        // Get SO lines
        const [lines] = await connection.execute(
          `SELECT sol.*, i.sku, i.name as item_name, i.unit
           FROM sales_order_lines sol
           JOIN items i ON sol.item_id = i.id
           WHERE sol.institution_id = ? AND sol.so_id = ?
           ORDER BY sol.line_number`,
          [institutionId, soId]
        );

        if (lines.length === 0) {
          throw new Error('No sales order lines found');
        }

        // Check stock availability per line's warehouse
        for (const line of lines) {
          const stock = await inventoryService.getCurrentStock(institutionId, line.item_id, line.warehouse_id);
          const availableQty = stock ? Number(stock.quantity_available) : 0;
          const requiredQty = Number(line.quantity_ordered);
          
          if (availableQty < requiredQty) {
            throw new Error(`Insufficient stock for ${line.item_name}. Available: ${availableQty}, Required: ${requiredQty}`);
          }
        }

        // Auto-generate shipment number
        const shipmentNumber = `AUTO-SHIP-${so.so_number}-${Date.now()}`;

        // Process each line item
        for (const line of lines) {
          // Reserve stock first
          await inventoryService.reserveStock(institutionId, {
            itemId: line.item_id,
            warehouseId: line.warehouse_id,
            quantity: line.quantity_ordered,
            unitPrice: line.unit_price,
            soId: soId,
            soLineId: line.id
          }, userId);

          // Ship stock (reduces inventory)
          await inventoryService.shipStock(institutionId, {
            itemId: line.item_id,
            warehouseId: line.warehouse_id,
            quantity: line.quantity_ordered,
            unitPrice: line.unit_price,
            soId: soId,
            soLineId: line.id,
            shipmentNumber: shipmentNumber
          }, userId);

          // Update SO line status
          await connection.execute(
            `UPDATE sales_order_lines 
             SET quantity_shipped = ?, status = 'shipped', updated_at = NOW()
             WHERE id = ?`,
            [line.quantity_ordered, line.id]
          );

          logger.info('Inventory reduced for item', {
            itemId: line.item_id,
            itemName: line.item_name,
            warehouseId: line.warehouse_id,
            quantity: line.quantity_ordered,
            unitPrice: line.unit_price,
            soId: soId
          });
        }

        // Update SO status to shipped
        await connection.execute(
          'UPDATE sales_orders SET status = ?, updated_at = NOW() WHERE id = ?',
          ['shipped', soId]
        );

        // Auto-generate sales invoice
        const invoiceId = uuidv4();
        const invoiceNumber = `SI-${so.so_number}-${Date.now()}`;
        
        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;
        
        for (const line of lines) {
          const lineTotal = line.quantity_ordered * line.unit_price;
          subtotal += lineTotal;
        }
        
        const grandTotal = subtotal + totalTax - totalDiscount;
        
        await connection.execute(`
          INSERT INTO sales_invoices (
            id, institution_id, invoice_number, customer_id, customer_name, so_id,
            invoice_date, due_date, currency, exchange_rate, subtotal, tax_amount,
            discount_amount, total_amount, paid_amount, balance_amount, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?)
        `, [
          invoiceId, institutionId, invoiceNumber, so.customer_id, so.customer_name, soId,
          new Date().toISOString().split('T')[0], null, so.currency || 'USD', 1,
          subtotal, totalTax, totalDiscount, grandTotal, 0, grandTotal, userId
        ]);
        
        // Add invoice lines
        for (const line of lines) {
          await connection.execute(`
            INSERT INTO sales_invoice_lines (
              invoice_id, so_line_id, item_id, item_name, quantity, unit_price, line_total,
              tax_rate, tax_amount, discount_rate, discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            invoiceId, line.id, line.item_id, line.item_name, line.quantity_ordered,
            line.unit_price, line.quantity_ordered * line.unit_price, 0, 0, 0, 0
          ]);
        }

        logger.info('SO confirmation processed successfully', {
          soId,
          soNumber: so.so_number,
          shipmentNumber,
          invoiceNumber,
          totalLines: lines.length,
          institutionId,
          userId
        });

        return {
          success: true,
          shipmentNumber,
          invoiceNumber,
          itemsProcessed: lines.length,
          warehouseUpdated: so.warehouse_name || so.warehouse_id
        };
      });
    } catch (error) {
      logger.error('Failed to process SO confirmation', {
        soId,
        institutionId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get confirmation summary for a SO
   */
  async getConfirmationSummary(institutionId, soId) {
    try {
      const [soResult] = await db.query(
        `SELECT so.*, w.name as warehouse_name, c.name as customer_name
         FROM sales_orders so 
         LEFT JOIN warehouses w ON so.warehouse_id = w.id 
         LEFT JOIN customers c ON so.customer_id = c.id
         WHERE so.institution_id = ? AND so.id = ?`,
        [institutionId, soId]
      );

      if (soResult.length === 0) {
        throw new Error('Sales order not found');
      }

      const so = soResult[0];

      // Get line items with current inventory levels
      const lines = await db.query(
        `SELECT sol.*, i.sku, i.name as item_name, i.unit,
                ip.quantity_on_hand as current_stock,
                ip.quantity_available as available_stock
         FROM sales_order_lines sol
         JOIN items i ON sol.item_id = i.id
         LEFT JOIN inventory_projections ip ON (ip.item_id = sol.item_id AND ip.warehouse_id = ?)
         WHERE sol.institution_id = ? AND sol.so_id = ?
         ORDER BY sol.line_number`,
        [so.warehouse_id, institutionId, soId]
      );

      return {
        so,
        lines,
        summary: {
          totalItems: lines.length,
          totalQuantity: lines.reduce((sum, line) => sum + line.quantity_ordered, 0),
          totalValue: lines.reduce((sum, line) => sum + (line.quantity_ordered * line.unit_price), 0),
          warehouseName: so.warehouse_name,
          customerName: so.customer_name
        }
      };
    } catch (error) {
      logger.error('Failed to get SO confirmation summary', {
        soId,
        institutionId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new SOConfirmationService();