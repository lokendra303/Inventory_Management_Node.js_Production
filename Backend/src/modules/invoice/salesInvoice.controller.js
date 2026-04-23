const db = require('../../database/connection');
const logger = require('../../utils/logger');
const invoiceTemplateService = require('./invoiceTemplate.service');
const invoicePDFService = require('./invoicePDF.service');
const emailService = require('../../services/emailService');
const { v4: uuidv4 } = require('uuid');
const { roundToTwo, safeAdd, safeSubtract } = require('../../utils/precision');
const { INVENTORY_EVENTS, createAggregateId } = require('../../events/inventoryEvents');

class SalesInvoiceController {
  // Create Sales Invoice
  async createSalesInvoice(req, res) {
    try {
      const { institutionId, user } = req;
      const invoiceData = req.body;

      if (!invoiceData.lines || invoiceData.lines.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invoice must have at least one line item'
        });
      }

      if (!invoiceData.customerId) {
        return res.status(400).json({
          success: false,
          error: 'Customer is required'
        });
      }

      const result = await db.transaction(async (connection) => {
        const invoiceId = uuidv4();
        const invoiceNumber = invoiceData.invoiceNumber || `SI${Date.now()}`;
        
        let customerName = invoiceData.customerName;
        if (!customerName && invoiceData.customerId) {
          const [customer] = await connection.execute(
            'SELECT display_name, company_name FROM customers WHERE id = ? AND institution_id = ?',
            [invoiceData.customerId, institutionId]
          );
          customerName = customer ? (customer.display_name || customer.company_name) : 'Unknown Customer';
        }

        const invoiceDate = invoiceData.invoiceDate && typeof invoiceData.invoiceDate === 'string' && invoiceData.invoiceDate.trim() 
          ? invoiceData.invoiceDate 
          : new Date().toISOString().split('T')[0];
        const dueDate = invoiceData.dueDate && typeof invoiceData.dueDate === 'string' && invoiceData.dueDate.trim() 
          ? invoiceData.dueDate 
          : null;

        const totals = invoiceData.totals || { subtotal: 0, totalDiscount: 0, totalTax: 0, grandTotal: 0 };
        
        await connection.execute(`
          INSERT INTO sales_invoices (
            id, institution_id, invoice_number, customer_id, customer_name, so_id, delivery_note_id,
            invoice_date, due_date, currency, exchange_rate, subtotal, tax_amount,
            discount_amount, total_amount, paid_amount, balance_amount, reference, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoiceId,
          institutionId, 
          invoiceNumber, 
          invoiceData.customerId, 
          customerName,
          invoiceData.soId || null, 
          invoiceData.deliveryNoteId || null, 
          invoiceDate, 
          dueDate,
          invoiceData.currency || 'USD', 
          invoiceData.exchangeRate || 1, 
          totals.subtotal, 
          totals.totalTax,
          totals.totalDiscount, 
          totals.grandTotal,
          0,
          totals.grandTotal, 
          invoiceData.reference || null, 
          invoiceData.notes || null, 
          user?.userId || 1
        ]);

        for (let index = 0; index < invoiceData.lines.length; index += 1) {
          const line = invoiceData.lines[index];
          const quantity = line.quantity || 0;
          const unitPrice = line.unitPrice || 0;
          const lineTotal = quantity * unitPrice;
          const discountRate = line.discountRate || 0;
          const taxRate = line.taxRate || 0;
          const discountAmount = (lineTotal * discountRate) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = (taxableAmount * taxRate) / 100;

          await connection.execute(`
            INSERT INTO sales_invoice_lines (
              invoice_id, so_line_id, delivery_line_id, item_id, item_name, quantity,
              unit_price, line_total, tax_rate, tax_amount, discount_rate, discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            invoiceId, 
            line.soLineId || null, 
            line.deliveryLineId || null, 
            line.itemId || null, 
            line.itemName,
            quantity, 
            unitPrice, 
            lineTotal, 
            taxRate, 
            taxAmount,
            discountRate, 
            discountAmount
          ]);

          if (line.itemId && quantity > 0) {
            const warehouseId = line.warehouseId || invoiceData.warehouseId;
            if (!warehouseId) {
              throw new Error('Warehouse is required for stock item lines on sales invoice');
            }

            const [projectionRows] = await connection.execute(
              `SELECT quantity_on_hand, quantity_available, average_cost, version
               FROM inventory_projections
               WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?
               FOR UPDATE`,
              [institutionId, line.itemId, warehouseId]
            );
            const projection = Array.isArray(projectionRows) ? projectionRows[0] : projectionRows;
            if (!projection) {
              throw new Error(`No inventory found for item ${line.itemId} in warehouse ${warehouseId}`);
            }

            const onHand = Number(projection.quantity_on_hand || 0);
            const available = Number(projection.quantity_available || 0);
            const averageCost = Number(projection.average_cost || 0);
            if (available < quantity || onHand < quantity) {
              throw new Error(`Insufficient stock for item ${line.itemName || line.itemId} in selected warehouse`);
            }

            const newOnHand = onHand - quantity;
            const newAvailable = available - quantity;
            const newTotalValue = newOnHand * averageCost;

            await connection.execute(
              `UPDATE inventory_projections
               SET quantity_on_hand = ?, quantity_available = ?, total_value = ?, last_movement_date = NOW(), version = version + 1
               WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
              [newOnHand, newAvailable, newTotalValue, institutionId, line.itemId, warehouseId]
            );

            const aggregateId = createAggregateId(line.itemId, warehouseId);
            const [versionRows] = await connection.execute(
              `SELECT COALESCE(MAX(aggregate_version), 0) as currentVersion
               FROM event_store
               WHERE institution_id = ? AND aggregate_type = 'inventory' AND aggregate_id = ?
               FOR UPDATE`,
              [institutionId, aggregateId]
            );
            const versionRow = Array.isArray(versionRows) ? versionRows[0] : versionRows;
            const nextVersion = Number(versionRow?.currentVersion || 0) + 1;
            await connection.execute(
              `INSERT INTO event_store
               (id, institution_id, aggregate_type, aggregate_id, aggregate_version, event_type, event_data, metadata, idempotency_key, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(),
                institutionId,
                'inventory',
                aggregateId,
                nextVersion,
                INVENTORY_EVENTS.SALE_SHIPPED,
                JSON.stringify({
                  itemId: line.itemId,
                  warehouseId,
                  quantity,
                  unitPrice,
                  soId: line.soId || invoiceData.soId || '00000000-0000-0000-0000-000000000000',
                  soLineId: line.soLineId || '00000000-0000-0000-0000-000000000000',
                  shipmentNumber: invoiceNumber,
                  shippedDate: new Date().toISOString()
                }),
                JSON.stringify({ userId: user?.userId || 1, source: 'sales_invoice' }),
                `sales-invoice-${invoiceId}-${index}`,
                user?.userId || 1
              ]
            );

            await connection.execute(`
              INSERT INTO stock_movements (
                institution_id, item_id, movement_type, quantity, reference_type, reference_id, reference_number, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              institutionId, line.itemId, 'out', quantity, 'sales_invoice', invoiceId, invoiceNumber, user?.userId || 1
            ]);
          }
        }

        return { invoiceId, totalAmount: totals.grandTotal };
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
        error: error.message || 'Failed to create sales invoice'
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
          si.id,
          si.institution_id,
          si.invoice_number,
          si.customer_id,
          si.customer_name,
          si.so_id,
          si.invoice_date,
          si.due_date,
          si.currency,
          si.subtotal,
          si.tax_amount,
          si.discount_amount,
          si.total_amount,
          si.paid_amount,
          si.balance_amount,
          COALESCE(si.status, 'posted') as status,
          si.created_at,
          si.updated_at
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
        error: error.message || 'Failed to fetch sales invoices'
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
          c.display_name as customer_full_name,
          c.email as customer_email,
          COALESCE(c.work_phone, c.mobile_phone) as customer_phone
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

        // Update invoice amounts with precision handling
        const newPaidAmount = roundToTwo(safeAdd(invoice.paid_amount, paymentData.amount));
        const newBalanceAmount = roundToTwo(safeSubtract(invoice.total_amount, newPaidAmount));
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

  // Update Sales Invoice
  async updateSalesInvoice(req, res) {
    try {
      const { institutionId, user } = req;
      const { id } = req.params;
      const invoiceData = req.body;

      if (!invoiceData.lines || invoiceData.lines.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invoice must have at least one line item'
        });
      }

      const result = await db.transaction(async (connection) => {
        // Block editing non-draft invoices
        const [existing] = await connection.execute(
          'SELECT status, so_id FROM sales_invoices WHERE id = ? AND institution_id = ?',
          [id, institutionId]
        );
        if (!existing) throw new Error('Invoice not found');
        if (existing.status !== 'draft') throw new Error('Only draft invoices can be edited');
        if (existing.so_id) throw new Error('System-generated invoices cannot be edited');

        const invoiceDate = invoiceData.invoiceDate && typeof invoiceData.invoiceDate === 'string' && invoiceData.invoiceDate.trim() 
          ? invoiceData.invoiceDate 
          : new Date().toISOString().split('T')[0];
        const dueDate = invoiceData.dueDate && typeof invoiceData.dueDate === 'string' && invoiceData.dueDate.trim() 
          ? invoiceData.dueDate 
          : null;

        const totals = invoiceData.totals || { subtotal: 0, totalDiscount: 0, totalTax: 0, grandTotal: 0 };
        
        await connection.execute(`
          UPDATE sales_invoices SET
            invoice_date = ?, due_date = ?, currency = ?, exchange_rate = ?,
            subtotal = ?, tax_amount = ?, discount_amount = ?, total_amount = ?,
            balance_amount = ?, reference = ?, notes = ?, updated_by = ?
          WHERE id = ? AND institution_id = ?
        `, [
          invoiceDate, dueDate, invoiceData.currency || 'USD', invoiceData.exchangeRate || 1,
          totals.subtotal, totals.totalTax, totals.totalDiscount, totals.grandTotal,
          totals.grandTotal, invoiceData.reference || null, invoiceData.notes || null,
          user?.userId || 1, id, institutionId
        ]);

        await connection.execute('DELETE FROM sales_invoice_lines WHERE invoice_id = ?', [id]);

        for (const line of invoiceData.lines) {
          const quantity = line.quantity || 0;
          const unitPrice = line.unitPrice || 0;
          const lineTotal = quantity * unitPrice;
          const discountRate = line.discountRate || 0;
          const taxRate = line.taxRate || 0;
          const discountAmount = (lineTotal * discountRate) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = (taxableAmount * taxRate) / 100;

          await connection.execute(`
            INSERT INTO sales_invoice_lines (
              invoice_id, item_id, item_name, quantity, unit_price, line_total,
              tax_rate, tax_amount, discount_rate, discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id, line.itemId || null, line.itemName, quantity, unitPrice, lineTotal,
            taxRate, taxAmount, discountRate, discountAmount
          ]);
        }

        return { invoiceId: id, totalAmount: totals.grandTotal };
      });

      res.json({
        success: true,
        message: 'Sales invoice updated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error updating sales invoice:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update sales invoice'
      });
    }
  }

  // Get Standard Invoice Format
  async getStandardInvoiceFormat(req, res) {
    try {
      const { institutionId } = req;
      const { id } = req.params;

      const [invoice] = await db.query(`
        SELECT si.*, so.so_number
        FROM sales_invoices si
        LEFT JOIN sales_orders so ON CAST(si.so_id AS CHAR) COLLATE utf8mb4_unicode_ci = CAST(so.id AS CHAR) COLLATE utf8mb4_unicode_ci
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
          i.unit,
          i.hsn_code
        FROM sales_invoice_lines sil
        LEFT JOIN items i ON CAST(sil.item_id AS CHAR) COLLATE utf8mb4_unicode_ci = CAST(i.id AS CHAR) COLLATE utf8mb4_unicode_ci
        WHERE sil.invoice_id = ?
        ORDER BY sil.created_at
      `, [id]);

      const invoiceData = {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        customerId: invoice.customer_id,
        customerName: invoice.customer_name,
        currency: invoice.currency,
        exchangeRate: invoice.exchange_rate,
        reference: invoice.reference,
        notes: invoice.notes,
        soNumber: invoice.so_number,
        lines: lines.map(line => ({
          itemId: line.item_id,
          itemName: line.item_name,
          sku: line.sku,
          unit: line.unit,
          quantity: line.quantity,
          unitPrice: line.unit_price,
          taxRate: line.tax_rate,
          discountRate: line.discount_rate,
          hsnCode: line.hsn_code
        }))
      };

      const standardInvoice = await invoiceTemplateService.generateStandardInvoice(
        institutionId, 
        invoiceData, 
        'sales'
      );

      res.json({
        success: true,
        data: standardInvoice
      });

    } catch (error) {
      logger.error('Error generating standard invoice format:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate standard invoice format'
      });
    }
  }

  // Get Customer Details for Invoice
  async getCustomerDetailsForInvoice(req, res) {
    try {
      const { institutionId } = req;
      const { customerId } = req.params;

      const customerDetails = await invoiceTemplateService.getCustomerDetails(institutionId, customerId);

      res.json({
        success: true,
        data: customerDetails
      });

    } catch (error) {
      logger.error('Error fetching customer details for invoice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch customer details'
      });
    }
  }

  // Get Customer List for Dropdown
  async getCustomerList(req, res) {
    try {
      const { institutionId } = req;
      const { search } = req.query;

      const customers = await invoiceTemplateService.getCustomerList(institutionId, search);

      res.json({
        success: true,
        data: customers
      });

    } catch (error) {
      logger.error('Error fetching customer list:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch customer list'
      });
    }
  }

  // Get Items List for Invoice (with stock availability like SO)
  async getItemsList(req, res) {
    try {
      const { institutionId } = req;
      const { search, warehouseId } = req.query;

      logger.info('Getting items list', { institutionId, search, warehouseId });

      // Simple query without warehouse_inventory join for now
      let query = `
        SELECT 
          i.id,
          i.sku,
          i.name,
          i.unit,
          i.selling_price,
          i.cost_price,
          i.tax_rate,
          i.hsn_code,
          0 as stock_quantity,
          0 as reserved_quantity,
          0 as available_quantity
        FROM items i
        WHERE i.institution_id = ? AND i.status = 'active'
      `;
      const params = [institutionId];

      if (search) {
        query += ' AND (i.name LIKE ? OR i.sku LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY i.name LIMIT 100';

      const items = await db.query(query, params);
      logger.info('Items fetched', { count: items.length });

      res.json({
        success: true,
        data: { items }
      });

    } catch (error) {
      logger.error('Error fetching items list:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch items list'
      });
    }
  }

  // Generate PDF for Invoice
  async generateInvoicePDF(req, res) {
    try {
      const { institutionId } = req;
      const { id } = req.params;
      const { download = false } = req.query;

      const [invoice] = await db.query(`
        SELECT si.*, so.so_number
        FROM sales_invoices si
        LEFT JOIN sales_orders so ON CAST(si.so_id AS CHAR) COLLATE utf8mb4_unicode_ci = CAST(so.id AS CHAR) COLLATE utf8mb4_unicode_ci
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
          i.unit,
          i.hsn_code
        FROM sales_invoice_lines sil
        LEFT JOIN items i ON CAST(sil.item_id AS CHAR) COLLATE utf8mb4_unicode_ci = CAST(i.id AS CHAR) COLLATE utf8mb4_unicode_ci
        WHERE sil.invoice_id = ?
        ORDER BY sil.created_at
      `, [id]);

      const invoiceData = {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        customerId: invoice.customer_id,
        customerName: invoice.customer_name,
        currency: invoice.currency,
        exchangeRate: invoice.exchange_rate,
        reference: invoice.reference,
        notes: invoice.notes,
        soNumber: invoice.so_number,
        lines: lines.map(line => ({
          itemId: line.item_id,
          itemName: line.item_name,
          sku: line.sku,
          unit: line.unit,
          quantity: line.quantity,
          unitPrice: line.unit_price,
          taxRate: line.tax_rate,
          discountRate: line.discount_rate,
          hsnCode: line.hsn_code
        }))
      };

      const standardInvoice = await invoiceTemplateService.generateStandardInvoice(
        institutionId, 
        invoiceData, 
        'sales'
      );

      if (download === 'true') {
        try {
          logger.info('Generating PDF for download', { invoiceId: id });
          const pdfBuffer = await invoicePDFService.generatePDFBuffer(standardInvoice, institutionId);
          
          if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('Generated PDF buffer is empty');
          }
          
          const filename = invoicePDFService.generateFilename(invoice.invoice_number, 'sales');
          logger.info('PDF generated successfully', { filename, size: pdfBuffer.length });
          
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.setHeader('Content-Length', pdfBuffer.length);
          return res.send(pdfBuffer);
        } catch (pdfError) {
          logger.error('PDF generation error:', pdfError);
          return res.status(500).json({
            success: false,
            error: pdfError.message || 'PDF generation failed'
          });
        }
      } else {
        try {
          const fileInfo = await invoicePDFService.saveInvoicePDF(
            standardInvoice, 
            invoice.invoice_number, 
            'sales'
          );
          
          res.json({
            success: true,
            data: fileInfo
          });
        } catch (pdfError) {
          logger.error('PDF save error:', pdfError);
          res.json({
            success: true,
            message: 'Invoice data ready. PDF generation requires: npm install pdfkit',
            data: { invoiceId: id, standardFormat: standardInvoice }
          });
        }
      }

    } catch (error) {
      logger.error('Error generating invoice PDF:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate invoice PDF'
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

  // Email Invoice
  async emailInvoice(req, res) {
    try {
      const { institutionId } = req;
      const { id } = req.params;
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email address is required'
        });
      }

      const [invoice] = await db.query(`
        SELECT si.*
        FROM sales_invoices si
        WHERE si.id = ? AND si.institution_id = ?
      `, [id, institutionId]);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
      }

      const lines = await db.query(`
        SELECT sil.*, i.sku, i.unit, i.hsn_code
        FROM sales_invoice_lines sil
        LEFT JOIN items i ON CAST(sil.item_id AS CHAR) = CAST(i.id AS CHAR)
        WHERE sil.invoice_id = ?
      `, [id]);

      const invoiceData = {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        customerId: invoice.customer_id,
        customerName: invoice.customer_name,
        currency: invoice.currency,
        exchangeRate: invoice.exchange_rate,
        reference: invoice.reference,
        notes: invoice.notes,
        lines: lines.map(line => ({
          itemId: line.item_id,
          itemName: line.item_name,
          sku: line.sku,
          unit: line.unit,
          quantity: line.quantity,
          unitPrice: line.unit_price,
          taxRate: line.tax_rate,
          discountRate: line.discount_rate,
          hsnCode: line.hsn_code
        }))
      };

      const standardInvoice = await invoiceTemplateService.generateStandardInvoice(
        institutionId, 
        invoiceData, 
        'sales'
      );

      const pdfBuffer = await invoicePDFService.generatePDFBuffer(standardInvoice, institutionId);
      const result = await emailService.sendInvoiceEmail(email, invoice.invoice_number, pdfBuffer);

      if (result.success) {
        res.json({
          success: true,
          message: `Invoice sent to ${email}`
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send email'
        });
      }

    } catch (error) {
      logger.error('Error emailing invoice:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to email invoice'
      });
    }
  }
}

module.exports = new SalesInvoiceController();
