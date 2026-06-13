const db = require('../../database/connection');
const logger = require('../../utils/logger');
const { normalizeDateInput } = require('../../utils/dateHelpers');
const {
  getInstitutionBaseCurrency,
  resolveExchangeRateForSave,
  getExchangeRateValidationError,
} = require('../../utils/exchangeRateHelpers');
const invoiceTemplateService = require('./invoiceTemplate.service');
const invoicePDFService = require('./invoicePDF.service');
const { v4: uuidv4 } = require('uuid');
const { serializeDocumentMeta, parseDocumentMeta } = require('../../utils/documentMeta');
const {
  parsePartyAddresses,
  serializePartyAddresses,
  partyAddressesToLegacyText,
  buildInvoicePartyPayload,
} = require('../../utils/partyAddresses');
const InvoiceService = require('./invoice.service');

function nextInvoiceNumber(lastNumber) {
  if (lastNumber) {
    const match = String(lastNumber).match(/\d+$/);
    const nextNum = match ? parseInt(match[0], 10) + 1 : 1;
    return `TPI${String(nextNum).padStart(6, '0')}`;
  }
  return 'TPI000001';
}

function lineCalculations(line) {
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPrice) || 0;
  const discountRate = Number(line.discountRate) || 0;
  const taxRate = Number(line.taxRate) || 0;
  const lineTotal = quantity * unitPrice;
  const discountAmount = (lineTotal * discountRate) / 100;
  const taxableAmount = lineTotal - discountAmount;
  const taxAmount = (taxableAmount * taxRate) / 100;
  return { quantity, unitPrice, discountRate, taxRate, lineTotal, discountAmount, taxAmount };
}

class ThirdPartyInvoiceController {
  async getCustomersList(req, res) {
    try {
      const { institutionId } = req;
      const rows = await db.query(
        `SELECT id, display_name, company_name, gstin, email,
                COALESCE(work_phone, mobile_phone) AS phone
         FROM customers
         WHERE institution_id = ? AND status = 'active'
         ORDER BY display_name ASC
         LIMIT 500`,
        [institutionId]
      );
      res.json({ success: true, data: rows || [] });
    } catch (error) {
      logger.error('Error fetching customers for third-party invoice:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch customers' });
    }
  }

  async getCustomerDetailsForInvoice(req, res) {
    try {
      const { institutionId } = req;
      const { customerId } = req.params;
      const customerDetails = await invoiceTemplateService.getCustomerDetails(institutionId, customerId);
      res.json({ success: true, data: customerDetails });
    } catch (error) {
      logger.error('Error fetching customer details for third-party invoice:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch customer details' });
    }
  }

  async createThirdPartyInvoice(req, res) {
    try {
      const { institutionId, user } = req;
      const invoiceData = req.body;

      if (!invoiceData.lines?.length) {
        return res.status(400).json({ success: false, error: 'Invoice must have at least one line item' });
      }
      if (!invoiceData.partyName?.trim()) {
        return res.status(400).json({ success: false, error: 'Party name is required' });
      }

      const baseCcy = await getInstitutionBaseCurrency(db, institutionId);
      const docCcy = invoiceData.currency || baseCcy;
      const resolvedRate = await resolveExchangeRateForSave(
        db, institutionId, docCcy, baseCcy, invoiceData.exchangeRate
      );
      const rateErr = getExchangeRateValidationError(docCcy, baseCcy, resolvedRate);
      if (rateErr) {
        return res.status(400).json({ success: false, error: rateErr });
      }

      const rawTotals = invoiceData.totals || InvoiceService.calculateInvoiceTotals(invoiceData.lines);
      const totals = {
        subtotal: rawTotals.subtotal,
        totalDiscount: rawTotals.totalDiscount ?? rawTotals.totalDiscountAmount ?? 0,
        totalTax: rawTotals.totalTax ?? rawTotals.totalTaxAmount ?? 0,
        grandTotal: rawTotals.grandTotal ?? rawTotals.totalAmount ?? 0,
      };

      const result = await db.transaction(async (connection) => {
        const invoiceId = uuidv4();
        const [lastRows] = await connection.execute(
          'SELECT invoice_number FROM third_party_invoices WHERE institution_id = ? ORDER BY created_at DESC LIMIT 1',
          [institutionId]
        );
        const lastRow = Array.isArray(lastRows) ? lastRows[0] : lastRows;
        const invoiceNumber = (invoiceData.invoiceNumber && String(invoiceData.invoiceNumber).trim())
          || nextInvoiceNumber(lastRow?.invoice_number);

        const today = new Date().toISOString().split('T')[0];
        const invoiceDate = normalizeDateInput(invoiceData.invoiceDate, today);
        const dueDate = normalizeDateInput(invoiceData.dueDate, null);
        const documentMetaJson = serializeDocumentMeta(
          invoiceData.documentMeta ?? invoiceData.document_meta,
          'salesInvoice'
        );
        const partyAddressesJson = serializePartyAddresses(
          invoiceData.partyAddresses ?? invoiceData.party_addresses
        );
        const legacyPartyAddress = partyAddressesToLegacyText(
          invoiceData.partyAddresses ?? invoiceData.party_addresses
        ) || invoiceData.partyAddress || null;

        await connection.execute(`
          INSERT INTO third_party_invoices (
            id, institution_id, invoice_number, party_type, party_id, party_name,
            party_gstin, party_address, party_addresses, invoice_date, due_date, currency, exchange_rate,
            subtotal, tax_amount, discount_amount, total_amount, status,
            reference, notes, document_meta, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoiceId, institutionId, invoiceNumber,
          invoiceData.partyType || 'other',
          invoiceData.partyId || null,
          invoiceData.partyName.trim(),
          invoiceData.partyGstin || null,
          legacyPartyAddress,
          partyAddressesJson,
          invoiceDate, dueDate,
          docCcy, resolvedRate,
          totals.subtotal, totals.totalTax, totals.totalDiscount, totals.grandTotal,
          invoiceData.status === 'posted' ? 'posted' : 'draft',
          invoiceData.reference || null,
          invoiceData.notes || null,
          documentMetaJson,
          user?.userId || null,
        ]);

        for (let i = 0; i < invoiceData.lines.length; i += 1) {
          const line = invoiceData.lines[i];
          const calc = lineCalculations(line);
          await connection.execute(`
            INSERT INTO third_party_invoice_lines (
              id, invoice_id, line_number, description, hsn_code, unit, quantity,
              unit_price, line_total, tax_rate, tax_amount, discount_rate, discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            uuidv4(), invoiceId, i + 1,
            line.description?.trim() || line.itemName?.trim() || 'Item',
            line.hsnCode || line.hsn_code || null,
            line.unit || null,
            calc.quantity, calc.unitPrice, calc.lineTotal,
            calc.taxRate, calc.taxAmount, calc.discountRate, calc.discountAmount,
          ]);
        }

        return { invoiceId, invoiceNumber, totalAmount: totals.grandTotal };
      });

      res.status(201).json({
        success: true,
        message: 'Third-party invoice created successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error creating third-party invoice:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to create third-party invoice' });
    }
  }

  async getThirdPartyInvoices(req, res) {
    try {
      const { institutionId } = req;
      const { status, dateFrom, dateTo, page = 1, limit = 50 } = req.query;

      let whereClause = 'WHERE tpi.institution_id = ?';
      const params = [institutionId];

      if (status) { whereClause += ' AND tpi.status = ?'; params.push(status); }
      if (dateFrom) { whereClause += ' AND tpi.invoice_date >= ?'; params.push(dateFrom); }
      if (dateTo) { whereClause += ' AND tpi.invoice_date <= ?'; params.push(dateTo); }

      const pageInt = Math.max(parseInt(page, 10) || 1, 1);
      const limitInt = Math.max(Math.min(parseInt(limit, 10) || 50, 1000), 1);
      const offset = (pageInt - 1) * limitInt;

      const invoices = await db.query(`
        SELECT tpi.id, tpi.invoice_number, tpi.party_type, tpi.party_id, tpi.party_name,
               tpi.party_gstin, tpi.invoice_date, tpi.due_date, tpi.currency,
               tpi.subtotal, tpi.tax_amount, tpi.discount_amount, tpi.total_amount,
               COALESCE(tpi.status, 'draft') AS status, tpi.created_at
        FROM third_party_invoices tpi
        ${whereClause}
        ORDER BY tpi.created_at DESC
        LIMIT ${limitInt} OFFSET ${offset}
      `, params);

      const [countResult] = await db.query(
        `SELECT COUNT(tpi.id) AS total FROM third_party_invoices tpi ${whereClause}`,
        params
      );

      res.json({
        success: true,
        data: {
          invoices: invoices || [],
          pagination: {
            page: pageInt,
            limit: limitInt,
            total: countResult?.total || 0,
            pages: Math.ceil((countResult?.total || 0) / limitInt),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching third-party invoices:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch third-party invoices' });
    }
  }

  async getThirdPartyInvoice(req, res) {
    try {
      const { institutionId } = req;
      const { id } = req.params;

      const [invoice] = await db.query(
        'SELECT * FROM third_party_invoices WHERE id = ? AND institution_id = ?',
        [id, institutionId]
      );

      if (!invoice) {
        return res.status(404).json({ success: false, error: 'Third-party invoice not found' });
      }

      const lines = await db.query(
        'SELECT * FROM third_party_invoice_lines WHERE invoice_id = ? ORDER BY line_number',
        [id]
      );

      res.json({
        success: true,
        data: {
          invoice: {
            ...invoice,
            documentMeta: parseDocumentMeta(invoice.document_meta),
            partyAddresses: parsePartyAddresses(invoice.party_addresses),
          },
          lines,
        },
      });
    } catch (error) {
      logger.error('Error fetching third-party invoice:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch third-party invoice' });
    }
  }

  async updateThirdPartyInvoice(req, res) {
    try {
      const { institutionId, user } = req;
      const { id } = req.params;
      const invoiceData = req.body;

      const [existing] = await db.query(
        "SELECT id, status FROM third_party_invoices WHERE id = ? AND institution_id = ? AND status = 'draft'",
        [id, institutionId]
      );
      if (!existing) {
        return res.status(400).json({ success: false, error: 'Invoice not found or cannot be edited' });
      }

      const baseCcy = await getInstitutionBaseCurrency(db, institutionId);
      const docCcy = invoiceData.currency || baseCcy;
      const resolvedRate = await resolveExchangeRateForSave(
        db, institutionId, docCcy, baseCcy, invoiceData.exchangeRate
      );
      const rateErr = getExchangeRateValidationError(docCcy, baseCcy, resolvedRate);
      if (rateErr) {
        return res.status(400).json({ success: false, error: rateErr });
      }

      const rawTotals = invoiceData.totals || InvoiceService.calculateInvoiceTotals(invoiceData.lines);
      const totals = {
        subtotal: rawTotals.subtotal,
        totalDiscount: rawTotals.totalDiscount ?? rawTotals.totalDiscountAmount ?? 0,
        totalTax: rawTotals.totalTax ?? rawTotals.totalTaxAmount ?? 0,
        grandTotal: rawTotals.grandTotal ?? rawTotals.totalAmount ?? 0,
      };

      await db.transaction(async (connection) => {
        const today = new Date().toISOString().split('T')[0];
        const invoiceDate = normalizeDateInput(invoiceData.invoiceDate, today);
        const dueDate = normalizeDateInput(invoiceData.dueDate, null);
        const documentMetaJson = serializeDocumentMeta(
          invoiceData.documentMeta ?? invoiceData.document_meta,
          'salesInvoice'
        );
        const partyAddressesJson = serializePartyAddresses(
          invoiceData.partyAddresses ?? invoiceData.party_addresses
        );
        const legacyPartyAddress = partyAddressesToLegacyText(
          invoiceData.partyAddresses ?? invoiceData.party_addresses
        ) || invoiceData.partyAddress || null;

        await connection.execute(`
          UPDATE third_party_invoices SET
            party_type = ?, party_id = ?, party_name = ?, party_gstin = ?, party_address = ?, party_addresses = ?,
            invoice_date = ?, due_date = ?, currency = ?, exchange_rate = ?,
            subtotal = ?, tax_amount = ?, discount_amount = ?, total_amount = ?,
            reference = ?, notes = ?, document_meta = ?, updated_by = ?, updated_at = NOW()
          WHERE id = ? AND institution_id = ?
        `, [
          invoiceData.partyType || 'other',
          invoiceData.partyId || null,
          invoiceData.partyName?.trim(),
          invoiceData.partyGstin || null,
          legacyPartyAddress,
          partyAddressesJson,
          invoiceDate, dueDate, docCcy, resolvedRate,
          totals.subtotal, totals.totalTax, totals.totalDiscount, totals.grandTotal,
          invoiceData.reference || null,
          invoiceData.notes || null,
          documentMetaJson,
          user?.userId || null,
          id, institutionId,
        ]);

        await connection.execute('DELETE FROM third_party_invoice_lines WHERE invoice_id = ?', [id]);

        for (let i = 0; i < invoiceData.lines.length; i += 1) {
          const line = invoiceData.lines[i];
          const calc = lineCalculations(line);
          await connection.execute(`
            INSERT INTO third_party_invoice_lines (
              id, invoice_id, line_number, description, hsn_code, unit, quantity,
              unit_price, line_total, tax_rate, tax_amount, discount_rate, discount_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            uuidv4(), id, i + 1,
            line.description?.trim() || line.itemName?.trim() || 'Item',
            line.hsnCode || line.hsn_code || null,
            line.unit || null,
            calc.quantity, calc.unitPrice, calc.lineTotal,
            calc.taxRate, calc.taxAmount, calc.discountRate, calc.discountAmount,
          ]);
        }
      });

      res.json({ success: true, message: 'Third-party invoice updated successfully' });
    } catch (error) {
      logger.error('Error updating third-party invoice:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to update third-party invoice' });
    }
  }

  async updateInvoiceStatus(req, res) {
    try {
      const { institutionId, user } = req;
      const { id } = req.params;
      const { status } = req.body;

      await db.query(
        'UPDATE third_party_invoices SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ? AND institution_id = ?',
        [status, user?.userId || null, id, institutionId]
      );

      res.json({ success: true, message: 'Invoice status updated successfully' });
    } catch (error) {
      logger.error('Error updating third-party invoice status:', error);
      res.status(500).json({ success: false, error: 'Failed to update invoice status' });
    }
  }

  async generateInvoicePDF(req, res) {
    try {
      const { institutionId } = req;
      const { id } = req.params;
      const { download = false } = req.query;

      const [invoice] = await db.query(
        'SELECT * FROM third_party_invoices WHERE id = ? AND institution_id = ?',
        [id, institutionId]
      );
      if (!invoice) {
        return res.status(404).json({ success: false, error: 'Third-party invoice not found' });
      }

      const lines = await db.query(
        'SELECT * FROM third_party_invoice_lines WHERE invoice_id = ? ORDER BY line_number',
        [id]
      );

      const partyAddressesParsed = parsePartyAddresses(invoice.party_addresses);
      const documentMeta = parseDocumentMeta(invoice.document_meta);
      if (partyAddressesParsed?.partyAddressSelection) {
        documentMeta.partyAddressSelection = partyAddressesParsed.partyAddressSelection;
      }
      const invoiceData = {
        ...buildInvoicePartyPayload(invoice, partyAddressesParsed),
        documentMeta,
        lines: lines.map((line) => ({
          itemName: line.description,
          description: line.description,
          unit: line.unit,
          quantity: line.quantity,
          unitPrice: line.unit_price,
          taxRate: line.tax_rate,
          discountRate: line.discount_rate,
          hsnCode: line.hsn_code,
        })),
      };

      const standardInvoice = await invoiceTemplateService.generateStandardInvoice(
        institutionId, invoiceData, 'sales'
      );

      const { queryFlag, sendInvoicePdfBuffer } = require('./invoicePdfResponse.helper');
      const wantsPdf = queryFlag(download) || queryFlag(req.query.inline);

      if (wantsPdf) {
        return await sendInvoicePdfBuffer(res, {
          standardInvoice,
          institutionId,
          invoiceNumber: invoice.invoice_number,
          type: 'sales',
          attachment: queryFlag(download),
        });
      }

      const fileInfo = await invoicePDFService.saveInvoicePDF(
        standardInvoice,
        invoice.invoice_number,
        'sales',
        institutionId
      );
      res.json({ success: true, data: fileInfo });
    } catch (error) {
      logger.error('Error generating third-party invoice PDF:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to generate PDF' });
    }
  }
}

module.exports = new ThirdPartyInvoiceController();
