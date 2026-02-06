const db = require('../database/connection');
const logger = require('../utils/logger');

class AutoInvoiceService {
  /**
   * Auto-generate invoice when purchase order is confirmed
   */
  async generateInvoiceFromPO(institutionId, poId, userId) {
    try {
      return await db.transaction(async (connection) => {
        // Get PO details
        const [po] = await connection.execute(`
          SELECT * FROM purchase_orders 
          WHERE id = ? AND institution_id = ? AND status = 'confirmed'
        `, [poId, institutionId]);

        if (!po) {
          throw new Error('Purchase order not found or not confirmed');
        }

        // Get PO lines
        const poLines = await connection.execute(`
          SELECT pol.*, i.name as item_name, i.sku, i.unit
          FROM purchase_order_lines pol
          LEFT JOIN items i ON pol.item_id = i.id
          WHERE pol.po_id = ?
        `, [poId]);

        // Generate invoice number
        const invoiceNumber = `PI${Date.now()}`;

        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;

        poLines.forEach(line => {
          const lineTotal = line.quantity * line.unit_cost;
          const discountAmount = (lineTotal * (line.discount_rate || 0)) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = (taxableAmount * (line.tax_rate || 0)) / 100;

          subtotal += lineTotal;
          totalDiscount += discountAmount;
          totalTax += taxAmount;
        });

        const grandTotal = subtotal - totalDiscount + totalTax;

        // Create invoice
        const [invoiceResult] = await connection.execute(`
          INSERT INTO purchase_invoices (
            institution_id, invoice_number, vendor_id, vendor_name, po_id,
            invoice_date, due_date, currency, exchange_rate, subtotal, tax_amount,
            discount_amount, total_amount, balance_amount, reference, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          institutionId, invoiceNumber, po.vendor_id, po.vendor_name, poId,
          new Date().toISOString().split('T')[0], // Today
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
          po.currency || 'USD', po.exchange_rate || 1, subtotal, totalTax,
          totalDiscount, grandTotal, grandTotal, `Auto-generated from PO: ${po.po_number}`,
          'Auto-generated invoice from purchase order', userId
        ]);

        const invoiceId = invoiceResult.insertId;

        // Create invoice lines
        for (const line of poLines) {
          const lineTotal = line.quantity * line.unit_cost;
          const discountAmount = (lineTotal * (line.discount_rate || 0)) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = (taxableAmount * (line.tax_rate || 0)) / 100;

          await connection.execute(`
            INSERT INTO purchase_invoice_lines (
              invoice_id, po_line_id, item_id, item_name, quantity,
              unit_cost, line_total, tax_rate, tax_amount, discount_rate, discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            invoiceId, line.id, line.item_id, line.item_name,
            line.quantity, line.unit_cost, lineTotal, line.tax_rate || 0, taxAmount,
            line.discount_rate || 0, discountAmount
          ]);
        }

        logger.info('Auto-invoice generated from PO', { invoiceId, poId, institutionId });
        return { invoiceId, invoiceNumber, totalAmount: grandTotal };
      });
    } catch (error) {
      logger.error('Error generating auto-invoice from PO:', error);
      throw error;
    }
  }

  /**
   * Get items list for manual invoice creation
   */
  async getItemsList(institutionId, search = '', limit = 50) {
    try {
      let query = `
        SELECT id, sku, name, unit, cost_price, selling_price, status
        FROM items 
        WHERE institution_id = ? AND status = 'active'
      `;
      const params = [institutionId];

      if (search) {
        query += ` AND (name LIKE ? OR sku LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ` ORDER BY name LIMIT ?`;
      params.push(limit);

      const items = await db.query(query, params);
      return items;
    } catch (error) {
      logger.error('Error getting items list:', error);
      throw error;
    }
  }
}

module.exports = new AutoInvoiceService();