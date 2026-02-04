const db = require('../database/connection');
const logger = require('../utils/logger');

class SalesInvoiceController {
  // Create Sales Invoice
  async createSalesInvoice(req, res) {
    try {
      const { institutionId, user } = req;
      const invoiceData = req.body;

      const result = await db.transaction(async (connection) => {
        // Calculate totals
        let subtotal = 0;
        let totalTaxAmount = 0;
        let totalDiscountAmount = 0;

        for (const line of invoiceData.lines) {
          const lineTotal = line.quantity * line.unitPrice;
          const discountAmount = (lineTotal * (line.discountRate || 0)) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = (taxableAmount * (line.taxRate || 0)) / 100;

          subtotal += lineTotal;
          totalDiscountAmount += discountAmount;
          totalTaxAmount += taxAmount;
        }

        const totalAmount = subtotal - totalDiscountAmount + totalTaxAmount;

        // Create invoice header
        const [invoiceResult] = await connection.execute(`
          INSERT INTO sales_invoices (
            institution_id, invoice_number, customer_id, customer_name, so_id, delivery_note_id,
            invoice_date, due_date, currency, exchange_rate, subtotal, tax_amount,
            discount_amount, total_amount, balance_amount, reference, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          institutionId, invoiceData.invoiceNumber, invoiceData.customerId, invoiceData.customerName,
          invoiceData.soId, invoiceData.deliveryNoteId, invoiceData.invoiceDate, invoiceData.dueDate,
          invoiceData.currency, invoiceData.exchangeRate, subtotal, totalTaxAmount,
          totalDiscountAmount, totalAmount, totalAmount, invoiceData.reference, invoiceData.notes, user.userId
        ]);

        const invoiceId = invoiceResult.insertId;

        // Create invoice lines
        for (const line of invoiceData.lines) {
          const lineTotal = line.quantity * line.unitPrice;
          const discountAmount = (lineTotal * (line.discountRate || 0)) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = (taxableAmount * (line.taxRate || 0)) / 100;

          await connection.execute(`
            INSERT INTO sales_invoice_lines (
              invoice_id, so_line_id, delivery_line_id, item_id, item_name, quantity,
              unit_price, line_total, tax_rate, tax_amount, discount_rate, discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            invoiceId, line.soLineId, line.deliveryLineId, line.itemId, line.itemName,
            line.quantity, line.unitPrice, lineTotal, line.taxRate || 0, taxAmount,
            line.discountRate || 0, discountAmount
          ]);
        }

        return { invoiceId, totalAmount };
      });

      res.status(201).json({
        success: true,
        message: 'Sales invoice created successfully',
        data: { invoiceId: result.invoiceId, totalAmount: result.totalAmount }
      });

    } catch (error) {
      logger.error('Error creating sales invoice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create sales invoice'
      });
    }
  }

  // Get Sales Invoices
  async getSalesInvoices(req, res) {
    try {
      const { institutionId } = req;
      
      if (!institutionId) {
        return res.status(400).json({
          success: false,
          error: 'Institution ID is required'
        });
      }
      
      const { status, customerId, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
      
      // Build WHERE clause
      let whereClause = 'WHERE si.institution_id = ?';
      const params = [institutionId];

      if (status) {
        whereClause += ' AND si.status = ?';
        params.push(status);
      }

      if (customerId) {
        whereClause += ' AND si.customer_id = ?';
        params.push(customerId);
      }

      if (dateFrom) {
        whereClause += ' AND si.invoice_date >= ?';
        params.push(dateFrom);
      }

      if (dateTo) {
        whereClause += ' AND si.invoice_date <= ?';
        params.push(dateTo);
      }

      // Validate and normalize pagination parameters (ensure integers)
      const pageInt = Math.max(parseInt(page, 10) || 1, 1);
      const limitInt = Math.max(Math.min(parseInt(limit, 10) || 50, 1000), 1); // cap max limit to 1000
      const offset = (pageInt - 1) * limitInt;

      // Interpolate LIMIT/OFFSET after validation to avoid prepared-statement type issues
      const invoices = await db.query(`
        SELECT 
          si.*
        FROM sales_invoices si
        ${whereClause}
        ORDER BY si.created_at DESC
        LIMIT ${limitInt} OFFSET ${offset}
      `, params);

      const [countResult] = await db.query(`
        SELECT COUNT(si.id) as total
        FROM sales_invoices si
        ${whereClause}
      `, params);

      res.json({
        success: true,
        data: {
          invoices: invoices || [],
          pagination: {
            page: pageInt,
            limit: limitInt,
            total: countResult?.total || 0,
            pages: Math.ceil((countResult?.total || 0) / limitInt)
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching sales invoices:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sales invoices'
      });
    }
  }

  // Get Single Sales Invoice
  async getSalesInvoice(req, res) {
    try {
      const { institutionId } = req;
      const { id } = req.params;

      const [invoice] = await db.query(`
        SELECT 
          si.*,
          so.so_number,
          c.name as customer_full_name,
          c.email as customer_email,
          c.phone as customer_phone
        FROM sales_invoices si
        LEFT JOIN sales_orders so ON CAST(si.so_id AS CHAR) = CAST(so.id AS CHAR)
        LEFT JOIN customers c ON si.customer_id = c.id
        WHERE si.id = ? AND si.institution_id = ?
      `, [id, institutionId]);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Sales invoice not found'
        });
      }

      const lines = await db.query(`
        SELECT 
          sil.*,
          i.sku,
          i.unit
        FROM sales_invoice_lines sil
        LEFT JOIN items i ON sil.item_id = i.id
        WHERE sil.invoice_id = ?
        ORDER BY sil.created_at
      `, [id]);

      const payments = await db.query(`
        SELECT * FROM invoice_payments
        WHERE invoice_id = ? AND invoice_type = 'sales'
        ORDER BY payment_date DESC
      `, [id]);

      res.json({
        success: true,
        data: {
          invoice,
          lines,
          payments
        }
      });

    } catch (error) {
      logger.error('Error fetching sales invoice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sales invoice'
      });
    }
  }

  // Post Sales Invoice (Create Accounting Entries)
  async postSalesInvoice(req, res) {
    try {
      const { institutionId, user } = req;
      const { id } = req.params;

      const result = await db.transaction(async (connection) => {
        // Get invoice details
        const [invoice] = await connection.execute(`
          SELECT * FROM sales_invoices 
          WHERE id = ? AND institution_id = ? AND status = 'draft'
        `, [id, institutionId]);

        if (!invoice) {
          throw new Error('Invoice not found or already posted');
        }

        // Get invoice lines for COGS calculation
        const lines = await connection.execute(`
          SELECT sil.*, i.cost_price
          FROM sales_invoice_lines sil
          LEFT JOIN items i ON sil.item_id = i.id
          WHERE sil.invoice_id = ?
        `, [id]);

        // Calculate COGS
        let totalCOGS = 0;
        for (const line of lines) {
          totalCOGS += (line.cost_price || 0) * line.quantity;
        }

        // Update invoice status
        await connection.execute(`
          UPDATE sales_invoices 
          SET status = 'posted', updated_by = ?, updated_at = NOW()
          WHERE id = ?
        `, [user.userId, id]);

        // Create accounting entries
        const entries = [
          // Dr Customer Receivable
          {
            account_code: 'CUSTOMER_RECEIVABLE',
            account_name: 'Accounts Receivable - Customers',
            debit_amount: invoice.total_amount,
            credit_amount: 0
          },
          // Cr Sales Revenue
          {
            account_code: 'SALES_REVENUE',
            account_name: 'Sales Revenue',
            debit_amount: 0,
            credit_amount: invoice.subtotal - invoice.discount_amount
          },
          // Cr Output Tax (if any)
          ...(invoice.tax_amount > 0 ? [{
            account_code: 'OUTPUT_TAX',
            account_name: 'Output Tax / VAT Payable',
            debit_amount: 0,
            credit_amount: invoice.tax_amount
          }] : []),
          // COGS entries (if perpetual inventory)
          ...(totalCOGS > 0 ? [
            {
              account_code: 'COGS',
              account_name: 'Cost of Goods Sold',
              debit_amount: totalCOGS,
              credit_amount: 0
            },
            {
              account_code: 'INVENTORY',
              account_name: 'Inventory Asset',
              debit_amount: 0,
              credit_amount: totalCOGS
            }
          ] : [])
        ];

        for (const entry of entries) {
          await connection.execute(`
            INSERT INTO accounting_entries (
              institution_id, entry_type, reference_id, reference_number,
              entry_date, account_code, account_name, debit_amount, credit_amount,
              description, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            institutionId, 'sales_invoice', id, invoice.invoice_number,
            invoice.invoice_date, entry.account_code, entry.account_name,
            entry.debit_amount, entry.credit_amount,
            `Sales Invoice: ${invoice.invoice_number}`, user.userId
          ]);
        }

        return invoice;
      });

      res.json({
        success: true,
        message: 'Sales invoice posted successfully',
        data: { invoiceId: id }
      });

    } catch (error) {
      logger.error('Error posting sales invoice:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to post sales invoice'
      });
    }
  }

  // Update Invoice Status
  async updateInvoiceStatus(req, res) {
    try {
      const { institutionId, user } = req;
      const { id } = req.params;
      const { status } = req.body;

      await db.query(`
        UPDATE sales_invoices 
        SET status = ?, updated_by = ?, updated_at = NOW()
        WHERE id = ? AND institution_id = ?
      `, [status, user.userId, id, institutionId]);

      res.json({
        success: true,
        message: 'Invoice status updated successfully'
      });

    } catch (error) {
      logger.error('Error updating invoice status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update invoice status'
      });
    }
  }

  // Add Payment to Invoice
  async addPayment(req, res) {
    try {
      const { institutionId, user } = req;
      const { id } = req.params;
      const paymentData = req.body;

      const result = await db.transaction(async (connection) => {
        // Get current invoice
        const [invoice] = await connection.execute(`
          SELECT * FROM sales_invoices 
          WHERE id = ? AND institution_id = ? AND status IN ('posted', 'partially_paid')
        `, [id, institutionId]);

        if (!invoice) {
          throw new Error('Invoice not found or cannot accept payments');
        }

        if (paymentData.amount > invoice.balance_amount) {
          throw new Error('Payment amount exceeds balance amount');
        }

        // Add payment record
        await connection.execute(`
          INSERT INTO invoice_payments (
            institution_id, invoice_type, invoice_id, payment_date, amount,
            payment_method, reference, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          institutionId, 'sales', id, paymentData.paymentDate, paymentData.amount,
          paymentData.paymentMethod, paymentData.reference, paymentData.notes, user.userId
        ]);

        // Update invoice amounts
        const newPaidAmount = parseFloat(invoice.paid_amount) + parseFloat(paymentData.amount);
        const newBalanceAmount = parseFloat(invoice.total_amount) - newPaidAmount;
        const newStatus = newBalanceAmount <= 0.01 ? 'paid' : 'partially_paid';

        await connection.execute(`
          UPDATE sales_invoices 
          SET paid_amount = ?, balance_amount = ?, status = ?, updated_by = ?, updated_at = NOW()
          WHERE id = ?
        `, [newPaidAmount, newBalanceAmount, newStatus, user.userId, id]);

        return { newStatus, newBalanceAmount };
      });

      res.json({
        success: true,
        message: 'Payment added successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error adding payment:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to add payment'
      });
    }
  }

  // Get Invoice Analytics
  async getInvoiceAnalytics(req, res) {
    try {
      const { institutionId } = req;
      const { dateFrom, dateTo } = req.query;

      let whereClause = 'WHERE institution_id = ?';
      const params = [institutionId];

      if (dateFrom) {
        whereClause += ' AND invoice_date >= ?';
        params.push(dateFrom);
      }

      if (dateTo) {
        whereClause += ' AND invoice_date <= ?';
        params.push(dateTo);
      }

      const analytics = await db.query(`
        SELECT 
          status,
          COUNT(*) as count,
          SUM(total_amount) as total_amount,
          SUM(paid_amount) as paid_amount,
          SUM(balance_amount) as balance_amount
        FROM sales_invoices
        ${whereClause}
        GROUP BY status
      `, params);

      const monthlyTrend = await db.query(`
        SELECT 
          DATE_FORMAT(invoice_date, '%Y-%m') as month,
          COUNT(*) as invoice_count,
          SUM(total_amount) as total_revenue
        FROM sales_invoices
        ${whereClause}
        GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
        ORDER BY month DESC
        LIMIT 12
      `, params);

      res.json({
        success: true,
        data: {
          statusBreakdown: analytics,
          monthlyTrend
        }
      });

    } catch (error) {
      logger.error('Error fetching invoice analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch invoice analytics'
      });
    }
  }
}

module.exports = new SalesInvoiceController();