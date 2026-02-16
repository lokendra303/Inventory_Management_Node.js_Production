const db = require('../../database/connection');
const logger = require('../../utils/logger');

class AccountingService {
  // Chart of Accounts mapping
  static ACCOUNTS = {
    // Assets
    INVENTORY: { code: '1300', name: 'Inventory Asset', type: 'asset' },
    CUSTOMER_RECEIVABLE: { code: '1200', name: 'Accounts Receivable - Customers', type: 'asset' },
    INPUT_TAX: { code: '1400', name: 'Input Tax / VAT Receivable', type: 'asset' },
    
    // Liabilities
    VENDOR_PAYABLE: { code: '2100', name: 'Accounts Payable - Vendors', type: 'liability' },
    OUTPUT_TAX: { code: '2200', name: 'Output Tax / VAT Payable', type: 'liability' },
    GRN_CLEARING: { code: '2150', name: 'GRN Clearing Account', type: 'liability' },
    
    // Revenue
    SALES_REVENUE: { code: '4000', name: 'Sales Revenue', type: 'revenue' },
    
    // Expenses
    PURCHASE_EXPENSE: { code: '5000', name: 'Purchase Expense', type: 'expense' },
    COGS: { code: '5100', name: 'Cost of Goods Sold', type: 'expense' }
  };

  // Create Purchase Invoice Accounting Entries
  static async createPurchaseInvoiceEntries(connection, invoice, institutionId, userId) {
    try {
      const entries = [];

      // Dr GRN Clearing / Purchase Expense
      entries.push({
        account_code: invoice.grn_id ? this.ACCOUNTS.GRN_CLEARING.code : this.ACCOUNTS.PURCHASE_EXPENSE.code,
        account_name: invoice.grn_id ? this.ACCOUNTS.GRN_CLEARING.name : this.ACCOUNTS.PURCHASE_EXPENSE.name,
        debit_amount: invoice.subtotal + invoice.discount_amount,
        credit_amount: 0
      });

      // Dr Input Tax (if any)
      if (invoice.tax_amount > 0) {
        entries.push({
          account_code: this.ACCOUNTS.INPUT_TAX.code,
          account_name: this.ACCOUNTS.INPUT_TAX.name,
          debit_amount: invoice.tax_amount,
          credit_amount: 0
        });
      }

      // Cr Vendor Payable
      entries.push({
        account_code: this.ACCOUNTS.VENDOR_PAYABLE.code,
        account_name: this.ACCOUNTS.VENDOR_PAYABLE.name,
        debit_amount: 0,
        credit_amount: invoice.total_amount
      });

      // Insert entries
      for (const entry of entries) {
        await connection.execute(`
          INSERT INTO accounting_entries (
            institution_id, entry_type, reference_id, reference_number,
            entry_date, account_code, account_name, debit_amount, credit_amount,
            description, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          institutionId, 'purchase_invoice', invoice.id, invoice.invoice_number,
          invoice.invoice_date, entry.account_code, entry.account_name,
          entry.debit_amount, entry.credit_amount,
          `Purchase Invoice: ${invoice.invoice_number}`, userId
        ]);
      }

      return entries;
    } catch (error) {
      logger.error('Error creating purchase invoice entries:', error);
      throw error;
    }
  }

  // Create Sales Invoice Accounting Entries
  static async createSalesInvoiceEntries(connection, invoice, lines, institutionId, userId) {
    try {
      const entries = [];

      // Dr Customer Receivable
      entries.push({
        account_code: this.ACCOUNTS.CUSTOMER_RECEIVABLE.code,
        account_name: this.ACCOUNTS.CUSTOMER_RECEIVABLE.name,
        debit_amount: invoice.total_amount,
        credit_amount: 0
      });

      // Cr Sales Revenue
      entries.push({
        account_code: this.ACCOUNTS.SALES_REVENUE.code,
        account_name: this.ACCOUNTS.SALES_REVENUE.name,
        debit_amount: 0,
        credit_amount: invoice.subtotal - invoice.discount_amount
      });

      // Cr Output Tax (if any)
      if (invoice.tax_amount > 0) {
        entries.push({
          account_code: this.ACCOUNTS.OUTPUT_TAX.code,
          account_name: this.ACCOUNTS.OUTPUT_TAX.name,
          debit_amount: 0,
          credit_amount: invoice.tax_amount
        });
      }

      // COGS entries (if perpetual inventory)
      let totalCOGS = 0;
      for (const line of lines) {
        totalCOGS += (line.cost_price || 0) * line.quantity;
      }

      if (totalCOGS > 0) {
        entries.push({
          account_code: this.ACCOUNTS.COGS.code,
          account_name: this.ACCOUNTS.COGS.name,
          debit_amount: totalCOGS,
          credit_amount: 0
        });

        entries.push({
          account_code: this.ACCOUNTS.INVENTORY.code,
          account_name: this.ACCOUNTS.INVENTORY.name,
          debit_amount: 0,
          credit_amount: totalCOGS
        });
      }

      // Insert entries
      for (const entry of entries) {
        await connection.execute(`
          INSERT INTO accounting_entries (
            institution_id, entry_type, reference_id, reference_number,
            entry_date, account_code, account_name, debit_amount, credit_amount,
            description, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          institutionId, 'sales_invoice', invoice.id, invoice.invoice_number,
          invoice.invoice_date, entry.account_code, entry.account_name,
          entry.debit_amount, entry.credit_amount,
          `Sales Invoice: ${invoice.invoice_number}`, userId
        ]);
      }

      return entries;
    } catch (error) {
      logger.error('Error creating sales invoice entries:', error);
      throw error;
    }
  }

  // Create Payment Entries
  static async createPaymentEntries(connection, payment, invoice, institutionId, userId) {
    try {
      const entries = [];
      const isReceivable = payment.invoice_type === 'sales';

      if (isReceivable) {
        // Sales payment: Dr Cash, Cr Customer Receivable
        entries.push({
          account_code: '1100',
          account_name: 'Cash / Bank Account',
          debit_amount: payment.amount,
          credit_amount: 0
        });

        entries.push({
          account_code: this.ACCOUNTS.CUSTOMER_RECEIVABLE.code,
          account_name: this.ACCOUNTS.CUSTOMER_RECEIVABLE.name,
          debit_amount: 0,
          credit_amount: payment.amount
        });
      } else {
        // Purchase payment: Dr Vendor Payable, Cr Cash
        entries.push({
          account_code: this.ACCOUNTS.VENDOR_PAYABLE.code,
          account_name: this.ACCOUNTS.VENDOR_PAYABLE.name,
          debit_amount: payment.amount,
          credit_amount: 0
        });

        entries.push({
          account_code: '1100',
          account_name: 'Cash / Bank Account',
          debit_amount: 0,
          credit_amount: payment.amount
        });
      }

      // Insert entries
      for (const entry of entries) {
        await connection.execute(`
          INSERT INTO accounting_entries (
            institution_id, entry_type, reference_id, reference_number,
            entry_date, account_code, account_name, debit_amount, credit_amount,
            description, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          institutionId, 'payment', payment.id, payment.reference || `PAY-${payment.id}`,
          payment.payment_date, entry.account_code, entry.account_name,
          entry.debit_amount, entry.credit_amount,
          `Payment for Invoice: ${invoice.invoice_number}`, userId
        ]);
      }

      return entries;
    } catch (error) {
      logger.error('Error creating payment entries:', error);
      throw error;
    }
  }

  // Get Trial Balance
  static async getTrialBalance(institutionId, dateFrom, dateTo) {
    try {
      let whereClause = 'WHERE institution_id = ?';
      const params = [institutionId];

      if (dateFrom) {
        whereClause += ' AND entry_date >= ?';
        params.push(dateFrom);
      }

      if (dateTo) {
        whereClause += ' AND entry_date <= ?';
        params.push(dateTo);
      }

      const balances = await db.query(`
        SELECT 
          account_code,
          account_name,
          SUM(debit_amount) as total_debits,
          SUM(credit_amount) as total_credits,
          SUM(debit_amount - credit_amount) as balance
        FROM accounting_entries
        ${whereClause}
        GROUP BY account_code, account_name
        HAVING ABS(SUM(debit_amount - credit_amount)) > 0.01
        ORDER BY account_code
      `, params);

      const summary = {
        totalDebits: balances.reduce((sum, acc) => sum + parseFloat(acc.total_debits), 0),
        totalCredits: balances.reduce((sum, acc) => sum + parseFloat(acc.total_credits), 0),
        balanceCheck: 0
      };

      summary.balanceCheck = Math.abs(summary.totalDebits - summary.totalCredits);

      return {
        balances,
        summary,
        isBalanced: summary.balanceCheck < 0.01
      };
    } catch (error) {
      logger.error('Error getting trial balance:', error);
      throw error;
    }
  }

  // Get Account Ledger
  static async getAccountLedger(institutionId, accountCode, dateFrom, dateTo) {
    try {
      let whereClause = 'WHERE institution_id = ? AND account_code = ?';
      const params = [institutionId, accountCode];

      if (dateFrom) {
        whereClause += ' AND entry_date >= ?';
        params.push(dateFrom);
      }

      if (dateTo) {
        whereClause += ' AND entry_date <= ?';
        params.push(dateTo);
      }

      const entries = await db.query(`
        SELECT *
        FROM accounting_entries
        ${whereClause}
        ORDER BY entry_date, created_at
      `, params);

      // Calculate running balance
      let runningBalance = 0;
      const ledgerEntries = entries.map(entry => {
        runningBalance += parseFloat(entry.debit_amount) - parseFloat(entry.credit_amount);
        return {
          ...entry,
          running_balance: runningBalance
        };
      });

      return {
        accountCode,
        entries: ledgerEntries,
        openingBalance: 0, // Could be calculated from previous periods
        closingBalance: runningBalance
      };
    } catch (error) {
      logger.error('Error getting account ledger:', error);
      throw error;
    }
  }

  // Validate 3-Way Matching
  static validateThreeWayMatching(po, grn, invoice) {
    const validations = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check if quantities match
    if (po && grn && invoice) {
      for (const invLine of invoice.lines) {
        const poLine = po.lines.find(l => l.item_id === invLine.item_id);
        const grnLine = grn.lines.find(l => l.item_id === invLine.item_id);

        if (poLine && grnLine) {
          // Quantity validation
          if (invLine.quantity > grnLine.quantity_received) {
            validations.errors.push(`Invoice quantity (${invLine.quantity}) exceeds GRN quantity (${grnLine.quantity_received}) for item ${invLine.item_name}`);
            validations.isValid = false;
          }

          // Price variance check (5% tolerance)
          const priceVariance = Math.abs(invLine.unit_cost - poLine.unit_cost) / poLine.unit_cost;
          if (priceVariance > 0.05) {
            validations.warnings.push(`Price variance of ${(priceVariance * 100).toFixed(2)}% for item ${invLine.item_name}`);
          }
        }
      }
    }

    return validations;
  }
}

module.exports = AccountingService;