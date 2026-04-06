const db = require('../../database/connection');
const logger = require('../../utils/logger');

class POConfirmationService {
  /**
   * Automatically process purchase order confirmation
   * This creates inventory entries and updates warehouse stock
   */
  async processPOConfirmation(institutionId, poId, userId) {
    try {
      return await db.transaction(async (connection) => {
        // Get PO details
        const [poResult] = await connection.execute(
          `SELECT po.* FROM purchase_orders po WHERE po.institution_id = ? AND po.id = ?`,
          [institutionId, poId]
        );

        if (poResult.length === 0) {
          throw new Error('Purchase order not found');
        }

        const po = poResult[0];

        // Get PO lines with warehouse info
        const [lines] = await connection.execute(
          `SELECT pol.*, i.sku, i.name as item_name, i.unit, w.name as warehouse_name
           FROM purchase_order_lines pol
           JOIN items i ON pol.item_id = i.id
           LEFT JOIN warehouses w ON pol.warehouse_id = w.id
           WHERE pol.institution_id = ? AND pol.po_id = ?
           ORDER BY pol.line_number`,
          [institutionId, poId]
        );

        if (lines.length === 0) {
          throw new Error('No purchase order lines found');
        }

        // Just mark PO as confirmed — GRN and invoice are created after goods are physically received
        await connection.execute(
          'UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ?',
          ['confirmed', poId]
        );

        logger.info('PO confirmed — awaiting goods receipt', { poId, poNumber: po.po_number, institutionId, userId });

        return {
          success: true,
          message: 'Purchase order confirmed. Receive goods to update inventory and generate invoice.',
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
      const poResult = await db.query(
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