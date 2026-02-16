const db = require('../database/connection');
const AccountingService = require('./accountingService');
const logger = require('../utils/logger');

class InvoiceService {
  // Generate Invoice Number
  static async generateInvoiceNumber(institutionId, type = 'purchase') {
    try {
      const prefix = type === 'purchase' ? 'PI' : 'SI';
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      
      const table = type === 'purchase' ? 'purchase_invoices' : 'sales_invoices';
      
      const [result] = await db.query(`
        SELECT COUNT(*) + 1 as next_number
        FROM ${table}
        WHERE institution_id = ? 
        AND YEAR(created_at) = ?
        AND MONTH(created_at) = ?
      `, [institutionId, year, month]);

      const sequence = String(result.next_number).padStart(4, '0');
      return `${prefix}${year}${month}${sequence}`;
    } catch (error) {
      logger.error('Error generating invoice number:', error);
      throw error;
    }
  }

  // Calculate Invoice Totals
  static calculateInvoiceTotals(lines) {
    let subtotal = 0;
    let totalTaxAmount = 0;
    let totalDiscountAmount = 0;

    const calculatedLines = lines.map(line => {
      const unitAmount = line.unitCost || line.unitPrice || 0;
      const lineTotal = Math.round(line.quantity * unitAmount * 100) / 100;
      const discountAmount = Math.round((lineTotal * (line.discountRate || 0)) / 100 * 100) / 100;
      const taxableAmount = Math.round((lineTotal - discountAmount) * 100) / 100;
      const taxAmount = Math.round((taxableAmount * (line.taxRate || 0)) / 100 * 100) / 100;

      subtotal += lineTotal;
      totalDiscountAmount += discountAmount;
      totalTaxAmount += taxAmount;

      return {
        ...line,
        lineTotal,
        discountAmount,
        taxAmount,
        netAmount: Math.round((taxableAmount + taxAmount) * 100) / 100
      };
    });

    const totalAmount = Math.round((subtotal - totalDiscountAmount + totalTaxAmount) * 100) / 100;

    return {
      lines: calculatedLines,
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
      totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
      totalAmount
    };
  }

  // Validate Invoice Against PO/GRN
  static async validateInvoiceAgainstDocuments(invoiceData, institutionId) {
    const validations = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // If linked to PO, validate against PO
      if (invoiceData.poId) {
        const [po] = await db.query(`
          SELECT * FROM purchase_orders 
          WHERE id = ? AND institution_id = ?
        `, [invoiceData.poId, institutionId]);

        if (!po) {
          validations.errors.push('Referenced Purchase Order not found');
          validations.isValid = false;
          return validations;
        }

        const poLines = await db.query(`
          SELECT * FROM purchase_order_lines WHERE po_id = ?
        `, [invoiceData.poId]);

        // Validate each invoice line against PO
        for (const invLine of invoiceData.lines) {
          const poLine = poLines.find(l => l.item_id === invLine.itemId);
          if (!poLine) {
            validations.errors.push(`Item ${invLine.itemName} not found in Purchase Order`);
            validations.isValid = false;
          } else {
            // Check quantity doesn't exceed PO quantity
            if (invLine.quantity > poLine.quantity) {
              validations.errors.push(`Invoice quantity (${invLine.quantity}) exceeds PO quantity (${poLine.quantity}) for ${invLine.itemName}`);
              validations.isValid = false;
            }

            // Check price variance (warn if > 5%)
            const priceVariance = Math.abs(invLine.unitCost - poLine.unit_cost) / poLine.unit_cost;
            if (priceVariance > 0.05) {
              validations.warnings.push(`Price variance of ${(priceVariance * 100).toFixed(2)}% for ${invLine.itemName}`);
            }
          }
        }
      }

      // If linked to GRN, validate against GRN
      if (invoiceData.grnId) {
        const [grn] = await db.query(`
          SELECT * FROM grn WHERE id = ? AND institution_id = ?
        `, [invoiceData.grnId, institutionId]);

        if (!grn) {
          validations.errors.push('Referenced GRN not found');
          validations.isValid = false;
          return validations;
        }

        const grnLines = await db.query(`
          SELECT * FROM grn_lines WHERE grn_id = ?
        `, [invoiceData.grnId]);

        // Validate each invoice line against GRN
        for (const invLine of invoiceData.lines) {
          const grnLine = grnLines.find(l => l.item_id === invLine.itemId);
          if (!grnLine) {
            validations.errors.push(`Item ${invLine.itemName} not found in GRN`);
            validations.isValid = false;
          } else {
            // Check quantity doesn't exceed received quantity
            if (invLine.quantity > grnLine.quantity_received) {
              validations.errors.push(`Invoice quantity (${invLine.quantity}) exceeds received quantity (${grnLine.quantity_received}) for ${invLine.itemName}`);
              validations.isValid = false;
            }
          }
        }
      }

      return validations;
    } catch (error) {
      logger.error('Error validating invoice:', error);
      validations.errors.push('Validation error occurred');
      validations.isValid = false;
      return validations;
    }
  }

  // Get Outstanding Invoices
  static async getOutstandingInvoices(institutionId, type = 'both') {
    try {
      const queries = [];
      
      if (type === 'purchase' || type === 'both') {
        queries.push(`
          SELECT 
            'purchase' as type,
            id,
            invoice_number,
            vendor_name as party_name,
            invoice_date,
            due_date,
            total_amount,
            paid_amount,
            balance_amount,
            DATEDIFF(CURDATE(), due_date) as days_overdue
          FROM purchase_invoices
          WHERE institution_id = ? 
          AND status IN ('posted', 'partially_paid')
          AND balance_amount > 0.01
        `);
      }

      if (type === 'sales' || type === 'both') {
        queries.push(`
          SELECT 
            'sales' as type,
            id,
            invoice_number,
            customer_name as party_name,
            invoice_date,
            due_date,
            total_amount,
            paid_amount,
            balance_amount,
            DATEDIFF(CURDATE(), due_date) as days_overdue
          FROM sales_invoices
          WHERE institution_id = ? 
          AND status IN ('posted', 'partially_paid')
          AND balance_amount > 0.01
        `);
      }

      const query = queries.join(' UNION ALL ') + ' ORDER BY due_date';
      const params = type === 'both' ? [institutionId, institutionId] : [institutionId];
      
      const invoices = await db.query(query, params);

      // Categorize by aging
      const aging = {
        current: [],
        overdue_1_30: [],
        overdue_31_60: [],
        overdue_61_90: [],
        overdue_90_plus: []
      };

      invoices.forEach(invoice => {
        const days = invoice.days_overdue;
        if (days <= 0) {
          aging.current.push(invoice);
        } else if (days <= 30) {
          aging.overdue_1_30.push(invoice);
        } else if (days <= 60) {
          aging.overdue_31_60.push(invoice);
        } else if (days <= 90) {
          aging.overdue_61_90.push(invoice);
        } else {
          aging.overdue_90_plus.push(invoice);
        }
      });

      return {
        invoices,
        aging,
        summary: {
          total_outstanding: invoices.reduce((sum, inv) => sum + parseFloat(inv.balance_amount), 0),
          count: invoices.length
        }
      };
    } catch (error) {
      logger.error('Error getting outstanding invoices:', error);
      throw error;
    }
  }

  // Get Invoice Analytics
  static async getInvoiceAnalytics(institutionId, dateFrom, dateTo, type = 'both') {
    try {
      const analytics = {};

      // Purchase Invoice Analytics
      if (type === 'purchase' || type === 'both') {
        analytics.purchase = await db.query(`
          SELECT 
            status,
            COUNT(*) as count,
            SUM(total_amount) as total_amount,
            SUM(paid_amount) as paid_amount,
            SUM(balance_amount) as balance_amount,
            AVG(total_amount) as avg_amount
          FROM purchase_invoices
          WHERE institution_id = ?
          ${dateFrom ? 'AND invoice_date >= ?' : ''}
          ${dateTo ? 'AND invoice_date <= ?' : ''}
          GROUP BY status
        `, [institutionId, dateFrom, dateTo].filter(Boolean));
      }

      // Sales Invoice Analytics
      if (type === 'sales' || type === 'both') {
        analytics.sales = await db.query(`
          SELECT 
            status,
            COUNT(*) as count,
            SUM(total_amount) as total_amount,
            SUM(paid_amount) as paid_amount,
            SUM(balance_amount) as balance_amount,
            AVG(total_amount) as avg_amount
          FROM sales_invoices
          WHERE institution_id = ?
          ${dateFrom ? 'AND invoice_date >= ?' : ''}
          ${dateTo ? 'AND invoice_date <= ?' : ''}
          GROUP BY status
        `, [institutionId, dateFrom, dateTo].filter(Boolean));
      }

      // Monthly trends
      if (type === 'sales' || type === 'both') {
        analytics.monthly_sales = await db.query(`
          SELECT 
            DATE_FORMAT(invoice_date, '%Y-%m') as month,
            COUNT(*) as invoice_count,
            SUM(total_amount) as total_revenue,
            SUM(paid_amount) as collected_amount
          FROM sales_invoices
          WHERE institution_id = ?
          ${dateFrom ? 'AND invoice_date >= ?' : ''}
          ${dateTo ? 'AND invoice_date <= ?' : ''}
          GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
          ORDER BY month DESC
          LIMIT 12
        `, [institutionId, dateFrom, dateTo].filter(Boolean));
      }

      return analytics;
    } catch (error) {
      logger.error('Error getting invoice analytics:', error);
      throw error;
    }
  }

  // Auto-match invoices with PO/GRN
  static async autoMatchInvoice(invoiceData, institutionId) {
    try {
      const suggestions = {
        po_matches: [],
        grn_matches: []
      };

      // Find matching POs by vendor
      if (invoiceData.vendorId || invoiceData.vendorName) {
        const pos = await db.query(`
          SELECT po.*, COUNT(pol.id) as line_count
          FROM purchase_orders po
          LEFT JOIN purchase_order_lines pol ON po.id = pol.po_id
          WHERE po.institution_id = ?
          AND (po.vendor_id = ? OR po.vendor_name LIKE ?)
          AND po.status IN ('confirmed', 'partially_received')
          GROUP BY po.id
          ORDER BY po.order_date DESC
          LIMIT 10
        `, [
          institutionId,
          invoiceData.vendorId || null,
          `%${invoiceData.vendorName || ''}%`
        ]);

        suggestions.po_matches = pos;
      }

      // Find matching GRNs
      const grns = await db.query(`
        SELECT g.*, po.vendor_name, COUNT(gl.id) as line_count
        FROM grn g
        LEFT JOIN purchase_orders po ON g.po_id = po.id
        LEFT JOIN grn_lines gl ON g.id = gl.grn_id
        WHERE g.institution_id = ?
        AND po.vendor_name LIKE ?
        AND g.status = 'completed'
        GROUP BY g.id
        ORDER BY g.receipt_date DESC
        LIMIT 10
      `, [institutionId, `%${invoiceData.vendorName || ''}%`]);

      suggestions.grn_matches = grns;

      return suggestions;
    } catch (error) {
      logger.error('Error auto-matching invoice:', error);
      throw error;
    }
  }
}

module.exports = InvoiceService;