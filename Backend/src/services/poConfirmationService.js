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
          `SELECT po.*, w.name as warehouse_name 
           FROM purchase_orders po 
           LEFT JOIN warehouses w ON po.warehouse_id = w.id 
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

        // Create automatic GRN
        await connection.execute(
          `INSERT INTO goods_receipt_notes 
           (id, institution_id, grn_number, po_id, warehouse_id, receipt_date, received_by, notes, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
          [
            grnId, 
            institutionId, 
            grnNumber, 
            poId, 
            po.warehouse_id, 
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
            warehouseId: po.warehouse_id,
            quantity: line.quantity_ordered,
            unitCost: line.unit_cost,
            poId: poId,
            poLineId: line.id,
            grnNumber: grnNumber
          }, userId);

          logger.info('Inventory updated for item', {
            itemId: line.item_id,
            itemName: line.item_name,
            warehouseId: po.warehouse_id,
            quantity: line.quantity_ordered,
            unitCost: line.unit_cost,
            poId: poId
          });
        }

        // Update PO status to received
        await connection.execute(
          'UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ?',
          ['received', poId]
        );

        logger.info('PO confirmation processed successfully', {
          poId,
          poNumber: po.po_number,
          grnId,
          grnNumber,
          warehouseId: po.warehouse_id,
          totalLines: lines.length,
          institutionId,
          userId
        });

        return {
          success: true,
          grnId,
          grnNumber,
          itemsProcessed: lines.length,
          warehouseUpdated: po.warehouse_name || po.warehouse_id
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
        `SELECT po.*, w.name as warehouse_name, v.display_name as vendor_name
         FROM purchase_orders po 
         LEFT JOIN warehouses w ON po.warehouse_id = w.id 
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
        `SELECT pol.*, i.sku, i.name as item_name, i.unit,
                ip.quantity_on_hand as current_stock,
                ip.quantity_available as available_stock
         FROM purchase_order_lines pol
         JOIN items i ON pol.item_id = i.id
         LEFT JOIN inventory_projections ip ON (ip.item_id = pol.item_id AND ip.warehouse_id = ?)
         WHERE pol.institution_id = ? AND pol.po_id = ?
         ORDER BY pol.line_number`,
        [po.warehouse_id, institutionId, poId]
      );

      return {
        po,
        lines,
        summary: {
          totalItems: lines.length,
          totalQuantity: lines.reduce((sum, line) => sum + line.quantity_ordered, 0),
          totalValue: lines.reduce((sum, line) => sum + (line.quantity_ordered * line.unit_cost), 0),
          warehouseName: po.warehouse_name,
          vendorName: po.vendor_name || po.vendor_name
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