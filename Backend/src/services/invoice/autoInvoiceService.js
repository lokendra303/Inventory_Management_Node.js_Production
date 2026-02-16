const db = require('../../database/connection');
const logger = require('../../utils/logger');

class AutoInvoiceService {
  /**
   * Auto-generate invoice when purchase order is confirmed
   */
  async generateInvoiceFromPO(institutionId, poId, userId) {
    try {
      return await db.transaction(async (connection) => {
        // Get PO details (accept sent, confirmed, or received status)
        const [poResult] = await connection.execute(`
          SELECT * FROM purchase_orders 
          WHERE id = ? AND institution_id = ? AND status IN ('sent', 'confirmed', 'received')
        `, [poId, institutionId]);

        if (!poResult || poResult.length === 0) {
          throw new Error('Purchase order not found or not confirmed');
        }
        
        const po = poResult[0];

        // Get PO lines
        const [poLines] = await connection.execute(`
          SELECT pol.*, i.name as item_name, i.sku, i.unit
          FROM purchase_order_lines pol
          LEFT JOIN items i ON pol.item_id = i.id
          WHERE pol.po_id = ?
        `, [poId]);
        
        if (!poLines || poLines.length === 0) {
          throw new Error('No line items found in purchase order');
        }

        // Generate unique invoice number
        const [lastInvoice] = await connection.execute(
          'SELECT invoice_number FROM purchase_invoices WHERE institution_id = ? ORDER BY created_at DESC LIMIT 1',
          [institutionId]
        );
        
        let invoiceNumber;
        if (lastInvoice && lastInvoice.length > 0 && lastInvoice[0].invoice_number) {
          const match = lastInvoice[0].invoice_number.match(/\d+$/);
          const nextNum = match ? parseInt(match[0]) + 1 : 1;
          invoiceNumber = `PI${String(nextNum).padStart(6, '0')}`;
        } else {
          invoiceNumber = 'PI000001';
        }
        
        const { v4: uuidv4 } = require('uuid');
        const invoiceId = uuidv4();

        // Calculate totals
        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;

        poLines.forEach(line => {
          const lineTotal = Number(line.quantity_ordered || 0) * Number(line.unit_cost || 0);
          const discountAmount = (lineTotal * Number(line.discount_rate || 0)) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = (taxableAmount * Number(line.tax_rate || 0)) / 100;

          subtotal += lineTotal;
          totalDiscount += discountAmount;
          totalTax += taxAmount;
        });

        const grandTotal = subtotal - totalDiscount + totalTax;

        // Create invoice
        await connection.execute(`
          INSERT INTO purchase_invoices (
            id, institution_id, invoice_number, vendor_id, vendor_name, po_id,
            invoice_date, due_date, currency, exchange_rate, subtotal, tax_amount,
            discount_amount, total_amount, balance_amount, reference, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoiceId, institutionId, invoiceNumber, po.vendor_id || null, po.vendor_name || 'Unknown Vendor', poId,
          new Date().toISOString().split('T')[0],
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          po.currency || 'USD', po.exchange_rate || 1, subtotal, totalTax,
          totalDiscount, grandTotal, grandTotal, `Auto-generated from PO: ${po.po_number}`,
          'Auto-generated invoice from purchase order', userId || null
        ]);

        // Create invoice lines
        for (const line of poLines) {
          const lineTotal = Number(line.quantity_ordered || 0) * Number(line.unit_cost || 0);
          const discountAmount = (lineTotal * Number(line.discount_rate || 0)) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = (taxableAmount * Number(line.tax_rate || 0)) / 100;

          await connection.execute(`
            INSERT INTO purchase_invoice_lines (
              invoice_id, po_line_id, item_id, item_name, quantity,
              unit_cost, line_total, tax_rate, tax_amount, discount_rate, discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            invoiceId, line.id, line.item_id, line.item_name || 'Unknown Item',
            Number(line.quantity_ordered || 0), Number(line.unit_cost || 0), lineTotal, 
            Number(line.tax_rate || 0), taxAmount, Number(line.discount_rate || 0), discountAmount
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