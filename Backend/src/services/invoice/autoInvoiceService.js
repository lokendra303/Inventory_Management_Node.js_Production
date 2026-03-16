const db = require('../../database/connection');
const logger = require('../../utils/logger');

class AutoInvoiceService {
  /**
   * Generate invoice from GRN — only for actually received & accepted quantities
   */
  async generateInvoiceFromGRN(institutionId, grnId, userId) {
    try {
      return await db.transaction(async (connection) => {
        // Get GRN with PO details
        const [grnResult] = await connection.execute(`
          SELECT grn.*, po.vendor_id, po.vendor_name, po.currency, po.exchange_rate, po.po_number
          FROM goods_receipt_notes grn
          JOIN purchase_orders po ON grn.po_id = po.id
          WHERE grn.id = ? AND grn.institution_id = ?
        `, [grnId, institutionId]);

        if (!grnResult || grnResult.length === 0) {
          throw new Error('GRN not found');
        }

        const grn = grnResult[0];

        // Check invoice not already generated for this GRN
        const [existingInvoice] = await connection.execute(
          'SELECT id, invoice_number FROM purchase_invoices WHERE grn_id = ? AND institution_id = ?',
          [grnId, institutionId]
        );
        if (existingInvoice && existingInvoice.length > 0) {
          throw new Error(`Invoice already generated for this GRN: ${existingInvoice[0].invoice_number}`);
        }

        // Get only accepted GRN lines
        const [grnLines] = await connection.execute(`
          SELECT gl.*, i.name as item_name, i.sku, i.unit,
                 pol.tax_rate, pol.discount_rate
          FROM grn_lines gl
          JOIN items i ON gl.item_id = i.id
          JOIN purchase_order_lines pol ON gl.po_line_id = pol.id
          WHERE gl.grn_id = ? AND gl.quality_status = 'accepted'
        `, [grnId]);

        if (!grnLines || grnLines.length === 0) {
          throw new Error('No accepted items in this GRN to invoice');
        }

        // Generate invoice number
        const [lastInvoice] = await connection.execute(
          'SELECT invoice_number FROM purchase_invoices WHERE institution_id = ? ORDER BY created_at DESC LIMIT 1',
          [institutionId]
        );
        let invoiceNumber;
        if (lastInvoice && lastInvoice.length > 0 && lastInvoice[0].invoice_number) {
          const match = lastInvoice[0].invoice_number.match(/\d+$/);
          invoiceNumber = `PI${String((match ? parseInt(match[0]) : 0) + 1).padStart(6, '0')}`;
        } else {
          invoiceNumber = 'PI000001';
        }

        const { v4: uuidv4 } = require('uuid');
        const invoiceId = uuidv4();

        // Calculate totals from received quantities only
        let subtotal = 0, totalTax = 0, totalDiscount = 0;
        grnLines.forEach(line => {
          const lineTotal = Number(line.quantity_received) * Number(line.unit_cost);
          const discountAmount = (lineTotal * Number(line.discount_rate || 0)) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = (taxableAmount * Number(line.tax_rate || 0)) / 100;
          subtotal += lineTotal;
          totalDiscount += discountAmount;
          totalTax += taxAmount;
        });
        const grandTotal = subtotal - totalDiscount + totalTax;

        // Create invoice linked to GRN
        await connection.execute(`
          INSERT INTO purchase_invoices (
            id, institution_id, invoice_number, vendor_id, vendor_name, po_id, grn_id,
            invoice_date, due_date, currency, exchange_rate, subtotal, tax_amount,
            discount_amount, total_amount, balance_amount, reference, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoiceId, institutionId, invoiceNumber,
          grn.vendor_id || null, grn.vendor_name || 'Unknown Vendor',
          grn.po_id, grnId,
          new Date().toISOString().split('T')[0],
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          grn.currency || 'USD', grn.exchange_rate || 1,
          subtotal, totalTax, totalDiscount, grandTotal, grandTotal,
          `Generated from GRN: ${grn.grn_number} (PO: ${grn.po_number})`,
          'Invoice generated from goods receipt', userId || null
        ]);

        // Create invoice lines from received quantities
        for (const line of grnLines) {
          const lineTotal = Number(line.quantity_received) * Number(line.unit_cost);
          const discountAmount = (lineTotal * Number(line.discount_rate || 0)) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = (taxableAmount * Number(line.tax_rate || 0)) / 100;

          await connection.execute(`
            INSERT INTO purchase_invoice_lines (
              invoice_id, po_line_id, grn_line_id, item_id, item_name, quantity,
              unit_cost, line_total, tax_rate, tax_amount, discount_rate, discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            invoiceId, line.po_line_id, line.id, line.item_id,
            line.item_name || 'Unknown Item',
            Number(line.quantity_received), Number(line.unit_cost), lineTotal,
            Number(line.tax_rate || 0), taxAmount,
            Number(line.discount_rate || 0), discountAmount
          ]);
        }

        logger.info('Invoice generated from GRN', { invoiceId, invoiceNumber, grnId, institutionId });
        return { invoiceId, invoiceNumber, totalAmount: grandTotal };
      });
    } catch (error) {
      logger.error('Error generating invoice from GRN:', error);
      throw error;
    }
  }

  /**
   * Auto-generate invoice when purchase order is confirmed
   * @deprecated — invoices should be generated from GRN after goods are received
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