const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');
const inventoryService = require('./inventoryService');

class POConfirmationService {
  /**
   * Automatically process purchase order confirmation
   * This creates inventory entries and updates warehouse stock
   */
  async processPOConfirmation(institutionId, poId, userId) {
    try {
      await db.transaction(async (connection) => {
        // Get PO details
        const [poResult] = await connection.execute(
          `SELECT po.*
           FROM purchase_orders po 
           WHERE po.institution_id = ? AND po.id = ?`,
          [institutionId, poId]
        );

        if (poResult.length === 0) {
          throw new Error('Purchase order not found');
        }

        const po = poResult[0];

        // Get PO lines
        const [lines] = await connection.execute(
          `SELECT pol.*, i.sku, i.name as item_name, i.unit
           FROM purchase_order_lines pol
           JOIN items i ON pol.item_id = i.id
           WHERE pol.institution_id = ? AND pol.po_id = ?
           ORDER BY pol.line_number`,
          [institutionId, poId]
        );

        if (lines.length === 0) {
          throw new Error('No purchase order lines found');
        }

        // Auto-generate GRN number
        const grnNumber = `AUTO-GRN-${po.po_number}-${Date.now()}`;
        const grnId = uuidv4();

        // Create automatic GRN using warehouse_id from first line
        await connection.execute(
          `INSERT INTO goods_receipt_notes 
           (id, institution_id, grn_number, po_id, warehouse_id, receipt_date, received_by, notes, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
          [
            grnId, 
            institutionId, 
            grnNumber, 
            poId,
            lines[0].warehouse_id,
            new Date().toISOString().split('T')[0], 
            userId, 
            'Auto-generated GRN on PO confirmation'
          ]
        );

        // Process each line item
        for (const line of lines) {
          const grnLineId = uuidv4();
          const lineTotal = line.quantity_ordered * line.unit_cost;

          // Create GRN line
          await connection.execute(
            `INSERT INTO grn_lines 
             (id, institution_id, grn_id, po_line_id, item_id, quantity_received, unit_cost, line_total, quality_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'accepted')`,
            [grnLineId, institutionId, grnId, line.id, line.item_id, line.quantity_ordered, line.unit_cost, lineTotal]
          );

          // Update PO line status
          await connection.execute(
            `UPDATE purchase_order_lines 
             SET quantity_received = ?, status = 'received', updated_at = NOW()
             WHERE id = ?`,
            [line.quantity_ordered, line.id]
          );

          // Create inventory entry using inventory service
          await inventoryService.receiveStock(institutionId, {
            itemId: line.item_id,
            warehouseId: line.warehouse_id,
            quantity: Number(line.quantity_ordered),
            unitCost: Number(line.unit_cost),
            poId: poId,
            poLineId: line.id,
            grnNumber: grnNumber
          }, userId);

          logger.info('Inventory updated for item', {
            itemId: line.item_id,
            itemName: line.item_name,
            warehouseId: line.warehouse_id,
            quantity: line.quantity_ordered,
            unitCost: line.unit_cost,
            poId: poId
          });
        }

        // Update PO status to confirmed
        await connection.execute(
          'UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ?',
          ['confirmed', poId]
        );

        // Auto-generate purchase invoice
        const invoiceId = uuidv4();
        const invoiceNumber = `PI-${po.po_number}-${Date.now()}`;
        
        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;
        
        for (const line of lines) {
          const lineTotal = line.quantity_ordered * line.unit_cost;
          subtotal += lineTotal;
        }
        
        const grandTotal = subtotal + totalTax - totalDiscount;
        
        await connection.execute(`
          INSERT INTO purchase_invoices (
            id, institution_id, invoice_number, vendor_id, vendor_name, po_id, grn_id,
            invoice_date, due_date, currency, exchange_rate, subtotal, tax_amount,
            discount_amount, total_amount, paid_amount, balance_amount, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?)
        `, [
          invoiceId, institutionId, invoiceNumber, po.vendor_id, po.vendor_name, poId, grnId,
          new Date().toISOString().split('T')[0], null, po.currency || 'USD', po.exchange_rate || 1,
          subtotal, totalTax, totalDiscount, grandTotal, 0, grandTotal, userId
        ]);
        
        // Add invoice lines
        for (const line of lines) {
          await connection.execute(`
            INSERT INTO purchase_invoice_lines (
              invoice_id, po_line_id, grn_line_id, item_id, item_name, warehouse_id, quantity, unit_cost, line_total,
              tax_rate, tax_amount, discount_rate, discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            invoiceId, line.id, null, line.item_id, line.item_name, line.warehouse_id, line.quantity_ordered,
            line.unit_cost, line.quantity_ordered * line.unit_cost, 0, 0, 0, 0
          ]);
        }

        logger.info('PO confirmation processed successfully', {
          poId,
          poNumber: po.po_number,
          grnId,
          grnNumber,
          invoiceNumber,
          totalLines: lines.length,
          institutionId,
          userId
        });

        return {
          success: true,
          grnId,
          grnNumber,
          invoiceNumber,
          itemsProcessed: lines.length
        };
      });
    } catch (error) {
      logger.error('Failed to process PO confirmation', {
        poId,
        institutionId,
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get confirmation summary for a PO
   */
  async getConfirmationSummary(institutionId, poId) {
    try {
      const [poResult] = await db.query(
        `SELECT po.*, v.display_name as vendor_name
         FROM purchase_orders po 
         LEFT JOIN vendors v ON po.vendor_id = v.id
         WHERE po.institution_id = ? AND po.id = ?`,
        [institutionId, poId]
      );

      if (poResult.length === 0) {
        throw new Error('Purchase order not found');
      }

      const po = poResult[0];

      // Get line items with current inventory levels
      const lines = await db.query(
        `SELECT pol.*, i.sku, i.name as item_name, i.unit, w.name as warehouse_name,
                ip.quantity_on_hand as current_stock,
                ip.quantity_available as available_stock
         FROM purchase_order_lines pol
         JOIN items i ON pol.item_id = i.id
         LEFT JOIN warehouses w ON pol.warehouse_id = w.id
         LEFT JOIN inventory_projections ip ON (ip.item_id = pol.item_id AND ip.warehouse_id = pol.warehouse_id)
         WHERE pol.institution_id = ? AND pol.po_id = ?
         ORDER BY pol.line_number`,
        [institutionId, poId]
      );

      return {
        po,
        lines,
        summary: {
          totalItems: lines.length,
          totalQuantity: lines.reduce((sum, line) => sum + line.quantity_ordered, 0),
          totalValue: lines.reduce((sum, line) => sum + (line.quantity_ordered * line.unit_cost), 0),
          vendorName: po.vendor_name
        }
      };
    } catch (error) {
      logger.error('Failed to get confirmation summary', {
        poId,
        institutionId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new POConfirmationService();