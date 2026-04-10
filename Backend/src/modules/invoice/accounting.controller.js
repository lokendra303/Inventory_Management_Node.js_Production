const db = require('../../database/connection');
const logger = require('../../utils/logger');

// Chart of Accounts definition (single source of truth)
const CHART_OF_ACCOUNTS = [
  { code: '1100', name: 'Cash / Bank Account',              type: 'asset',     group: 'Current Assets' },
  { code: '1200', name: 'Accounts Receivable - Customers',  type: 'asset',     group: 'Current Assets' },
  { code: '1300', name: 'Inventory Asset',                  type: 'asset',     group: 'Current Assets' },
  { code: '1400', name: 'Input Tax / VAT Receivable',       type: 'asset',     group: 'Current Assets' },
  { code: '2100', name: 'Accounts Payable - Vendors',       type: 'liability', group: 'Current Liabilities' },
  { code: '2150', name: 'GRN Clearing Account',             type: 'liability', group: 'Current Liabilities' },
  { code: '2200', name: 'Output Tax / VAT Payable',         type: 'liability', group: 'Current Liabilities' },
  { code: '4000', name: 'Sales Revenue',                    type: 'revenue',   group: 'Revenue' },
  { code: '5000', name: 'Purchase Expense',                 type: 'expense',   group: 'Cost of Sales' },
  { code: '5100', name: 'Cost of Goods Sold',               type: 'expense',   group: 'Cost of Sales' },
  { code: 'VENDOR_PAYABLE',   name: 'Accounts Payable - Vendors',      type: 'liability', group: 'Current Liabilities' },
  { code: 'GRN_CLEARING',     name: 'GRN Clearing Account',            type: 'liability', group: 'Current Liabilities' },
  { code: 'PURCHASE_EXPENSE', name: 'Purchase Expense',                type: 'expense',   group: 'Cost of Sales' },
  { code: 'INPUT_TAX',        name: 'Input Tax / VAT Receivable',      type: 'asset',     group: 'Current Assets' },
  { code: 'OUTPUT_TAX',       name: 'Output Tax / VAT Payable',        type: 'liability', group: 'Current Liabilities' },
  { code: 'SALES_REVENUE',    name: 'Sales Revenue',                   type: 'revenue',   group: 'Revenue' },
  { code: 'COGS',             name: 'Cost of Goods Sold',              type: 'expense',   group: 'Cost of Sales' },
  { code: 'INVENTORY',        name: 'Inventory Asset',                 type: 'asset',     group: 'Current Assets' },
  { code: 'CUSTOMER_RECEIVABLE', name: 'Accounts Receivable - Customers', type: 'asset', group: 'Current Assets' },
];

// Normalise account code to its canonical name/type
const getAccountMeta = (code) =>
  CHART_OF_ACCOUNTS.find(a => a.code === code) || { code, name: code, type: 'other', group: 'Other' };

class AccountingController {

  // GET /api/accounting/journal-entries
  async getJournalEntries(req, res) {
    try {
      const { institutionId } = req;
      const { dateFrom, dateTo, entryType, accountCode, page = 1, limit = 50 } = req.query;

      let where = 'WHERE ae.institution_id = ?';
      const params = [institutionId];

      if (dateFrom)    { where += ' AND ae.entry_date >= ?';   params.push(dateFrom); }
      if (dateTo)      { where += ' AND ae.entry_date <= ?';   params.push(dateTo); }
      if (entryType)   { where += ' AND ae.entry_type = ?';    params.push(entryType); }
      if (accountCode) { where += ' AND ae.account_code = ?';  params.push(accountCode); }

      const pageInt  = Math.max(parseInt(page, 10)  || 1,  1);
      const limitInt = Math.min(parseInt(limit, 10) || 50, 500);
      const offset   = (pageInt - 1) * limitInt;

      const entries = await db.query(`
        SELECT ae.*
        FROM accounting_entries ae
        ${where}
        ORDER BY ae.entry_date DESC, ae.created_at DESC
        LIMIT ${limitInt} OFFSET ${offset}
      `, params);

      const [countRow] = await db.query(`
        SELECT COUNT(*) as total FROM accounting_entries ae ${where}
      `, params);

      res.json({
        success: true,
        data: {
          entries: entries.map(e => ({
            ...e,
            account_meta: getAccountMeta(e.account_code),
          })),
          pagination: {
            page: pageInt, limit: limitInt,
            total: countRow?.total || 0,
            pages: Math.ceil((countRow?.total || 0) / limitInt),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching journal entries:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch journal entries' });
    }
  }

  // GET /api/accounting/trial-balance
  async getTrialBalance(req, res) {
    try {
      const { institutionId } = req;
      const { dateFrom, dateTo } = req.query;

      let where = 'WHERE institution_id = ?';
      const params = [institutionId];
      if (dateFrom) { where += ' AND entry_date >= ?'; params.push(dateFrom); }
      if (dateTo)   { where += ' AND entry_date <= ?'; params.push(dateTo); }

      const rows = await db.query(`
        SELECT
          account_code,
          account_name,
          SUM(debit_amount)  AS total_debits,
          SUM(credit_amount) AS total_credits,
          SUM(debit_amount - credit_amount) AS balance
        FROM accounting_entries
        ${where}
        GROUP BY account_code, account_name
        ORDER BY account_code
      `, params);

      const accounts = rows.map(r => ({
        ...r,
        total_debits:  parseFloat(r.total_debits)  || 0,
        total_credits: parseFloat(r.total_credits) || 0,
        balance:       parseFloat(r.balance)       || 0,
        meta:          getAccountMeta(r.account_code),
      }));

      const totalDebits  = accounts.reduce((s, a) => s + a.total_debits,  0);
      const totalCredits = accounts.reduce((s, a) => s + a.total_credits, 0);

      res.json({
        success: true,
        data: {
          accounts,
          summary: {
            totalDebits,
            totalCredits,
            isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
            difference: Math.abs(totalDebits - totalCredits),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching trial balance:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch trial balance' });
    }
  }

  // GET /api/accounting/ledger/:accountCode
  async getAccountLedger(req, res) {
    try {
      const { institutionId } = req;
      const { accountCode } = req.params;
      const { dateFrom, dateTo } = req.query;

      let where = 'WHERE institution_id = ? AND account_code = ?';
      const params = [institutionId, accountCode];
      if (dateFrom) { where += ' AND entry_date >= ?'; params.push(dateFrom); }
      if (dateTo)   { where += ' AND entry_date <= ?'; params.push(dateTo); }

      const entries = await db.query(`
        SELECT * FROM accounting_entries
        ${where}
        ORDER BY entry_date ASC, created_at ASC
      `, params);

      let runningBalance = 0;
      const ledger = entries.map(e => {
        runningBalance += parseFloat(e.debit_amount || 0) - parseFloat(e.credit_amount || 0);
        return { ...e, running_balance: Math.round(runningBalance * 100) / 100 };
      });

      res.json({
        success: true,
        data: {
          accountCode,
          accountMeta: getAccountMeta(accountCode),
          entries: ledger,
          closingBalance: Math.round(runningBalance * 100) / 100,
        },
      });
    } catch (error) {
      logger.error('Error fetching account ledger:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch account ledger' });
    }
  }

  // GET /api/accounting/payables
  async getVendorPayables(req, res) {
    try {
      const { institutionId } = req;

      // Outstanding bills: posted or partially_paid
      const bills = await db.query(`
        SELECT
          pi.id,
          pi.invoice_number,
          pi.vendor_id,
          pi.vendor_name,
          pi.invoice_date,
          pi.due_date,
          pi.total_amount,
          pi.paid_amount,
          pi.balance_amount,
          pi.status,
          DATEDIFF(CURDATE(), pi.due_date) AS days_overdue
        FROM purchase_invoices pi
        WHERE pi.institution_id = ?
          AND pi.status IN ('posted', 'partially_paid')
        ORDER BY pi.due_date ASC
      `, [institutionId]);

      // Aggregate by vendor
      const vendorMap = {};
      for (const b of bills) {
        if (!vendorMap[b.vendor_id]) {
          vendorMap[b.vendor_id] = {
            vendor_id:      b.vendor_id,
            vendor_name:    b.vendor_name,
            total_payable:  0,
            total_paid:     0,
            balance_due:    0,
            bill_count:     0,
            overdue_count:  0,
            overdue_amount: 0,
          };
        }
        const v = vendorMap[b.vendor_id];
        v.total_payable  += parseFloat(b.total_amount   || 0);
        v.total_paid     += parseFloat(b.paid_amount    || 0);
        v.balance_due    += parseFloat(b.balance_amount || 0);
        v.bill_count     += 1;
        if (b.days_overdue > 0) {
          v.overdue_count  += 1;
          v.overdue_amount += parseFloat(b.balance_amount || 0);
        }
      }

      const totalPayable = bills.reduce((s, b) => s + parseFloat(b.balance_amount || 0), 0);
      const overdueTotal = bills
        .filter(b => b.days_overdue > 0)
        .reduce((s, b) => s + parseFloat(b.balance_amount || 0), 0);

      res.json({
        success: true,
        data: {
          bills,
          vendors:      Object.values(vendorMap),
          summary: {
            totalPayable:  Math.round(totalPayable * 100) / 100,
            overdueTotal:  Math.round(overdueTotal * 100) / 100,
            totalBills:    bills.length,
            overdueBills:  bills.filter(b => b.days_overdue > 0).length,
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching vendor payables:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch vendor payables' });
    }
  }

  // GET /api/accounting/receivables
  async getCustomerReceivables(req, res) {
    try {
      const { institutionId } = req;

      const invoices = await db.query(`
        SELECT
          si.id,
          si.invoice_number,
          si.customer_id,
          si.customer_name,
          si.invoice_date,
          si.due_date,
          si.total_amount,
          si.paid_amount,
          si.balance_amount,
          si.status,
          DATEDIFF(CURDATE(), si.due_date) AS days_overdue
        FROM sales_invoices si
        WHERE si.institution_id = ?
          AND si.status IN ('posted', 'partially_paid')
        ORDER BY si.due_date ASC
      `, [institutionId]);

      const totalReceivable = invoices.reduce((s, i) => s + parseFloat(i.balance_amount || 0), 0);
      const overdueTotal    = invoices
        .filter(i => i.days_overdue > 0)
        .reduce((s, i) => s + parseFloat(i.balance_amount || 0), 0);

      res.json({
        success: true,
        data: {
          invoices,
          summary: {
            totalReceivable: Math.round(totalReceivable * 100) / 100,
            overdueTotal:    Math.round(overdueTotal    * 100) / 100,
            totalInvoices:   invoices.length,
            overdueInvoices: invoices.filter(i => i.days_overdue > 0).length,
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching customer receivables:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch customer receivables' });
    }
  }

  // GET /api/accounting/chart-of-accounts
  async getChartOfAccounts(req, res) {
    try {
      const { institutionId } = req;

      // Get live balances from DB
      const balances = await db.query(`
        SELECT
          account_code,
          account_name,
          SUM(debit_amount)  AS total_debits,
          SUM(credit_amount) AS total_credits,
          SUM(debit_amount - credit_amount) AS balance
        FROM accounting_entries
        WHERE institution_id = ?
        GROUP BY account_code, account_name
      `, [institutionId]);

      const balanceMap = {};
      for (const b of balances) {
        balanceMap[b.account_code] = {
          total_debits:  parseFloat(b.total_debits)  || 0,
          total_credits: parseFloat(b.total_credits) || 0,
          balance:       parseFloat(b.balance)       || 0,
        };
      }

      // Merge with chart definition — deduplicate by code
      const seen = new Set();
      const allCodes = [
        ...CHART_OF_ACCOUNTS,
        ...balances
          .filter(b => !CHART_OF_ACCOUNTS.find(a => a.code === b.account_code))
          .map(b => ({ code: b.account_code, name: b.account_name, type: 'other', group: 'Other' })),
      ].filter(a => { if (seen.has(a.code)) return false; seen.add(a.code); return true; });

      const accounts = allCodes.map(a => ({
        ...a,
        ...(balanceMap[a.code] || { total_debits: 0, total_credits: 0, balance: 0 }),
      }));

      res.json({ success: true, data: { accounts } });
    } catch (error) {
      logger.error('Error fetching chart of accounts:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch chart of accounts' });
    }
  }

  // GET /api/accounting/payments
  async getPayments(req, res) {
    try {
      const { institutionId } = req;
      const { dateFrom, dateTo, paymentType, page = 1, limit = 50 } = req.query;

      let where = 'WHERE ip.institution_id = ?';
      const params = [institutionId];

      if (dateFrom) { where += ' AND ip.payment_date >= ?'; params.push(dateFrom); }
      if (dateTo)   { where += ' AND ip.payment_date <= ?'; params.push(dateTo); }
      if (paymentType) { where += ' AND ip.invoice_type = ?'; params.push(paymentType); }

      const pageInt = Math.max(parseInt(page, 10) || 1, 1);
      const limitInt = Math.min(parseInt(limit, 10) || 50, 500);
      const offset = (pageInt - 1) * limitInt;

      // Get payments with invoice details and user information
      const payments = await db.query(`
        SELECT 
          ip.*,
          CASE 
            WHEN ip.invoice_type = 'purchase' THEN pi.invoice_number
            WHEN ip.invoice_type = 'sales' THEN si.invoice_number
            ELSE NULL
          END as invoice_number,
          CASE 
            WHEN ip.invoice_type = 'purchase' THEN pi.vendor_name
            WHEN ip.invoice_type = 'sales' THEN si.customer_name
            ELSE NULL
          END as party_name,
          iu.first_name,
          iu.last_name,
          iu.email as user_email
        FROM invoice_payments ip
        LEFT JOIN purchase_invoices pi ON ip.invoice_type = 'purchase' AND ip.invoice_id = pi.id
        LEFT JOIN sales_invoices si ON ip.invoice_type = 'sales' AND ip.invoice_id = si.id
        LEFT JOIN institution_users iu ON ip.created_by = iu.id AND ip.institution_id = iu.institution_id
        ${where}
        ORDER BY ip.payment_date DESC, ip.created_at DESC
        LIMIT ${limitInt} OFFSET ${offset}
      `, params);

      const [countRow] = await db.query(`
        SELECT COUNT(*) as total FROM invoice_payments ip ${where}
      `, params);

      // Calculate summary
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const purchasePayments = payments.filter(p => p.invoice_type === 'purchase');
      const salesPayments = payments.filter(p => p.invoice_type === 'sales');
      const totalPurchasePayments = purchasePayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const totalSalesPayments = salesPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

      res.json({
        success: true,
        data: {
          payments,
          summary: {
            totalPaid: Math.round(totalPaid * 100) / 100,
            totalPurchasePayments: Math.round(totalPurchasePayments * 100) / 100,
            totalSalesPayments: Math.round(totalSalesPayments * 100) / 100,
            totalPayments: payments.length,
            purchasePaymentCount: purchasePayments.length,
            salesPaymentCount: salesPayments.length,
          },
          pagination: {
            page: pageInt,
            limit: limitInt,
            total: countRow?.total || 0,
            pages: Math.ceil((countRow?.total || 0) / limitInt),
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching payments:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payments' });
    }
  }

  // GET /api/accounting/summary
  async getAccountingSummary(req, res) {
    try {
      const { institutionId } = req;

      const [
        payableRow,
        receivableRow,
        revenueRow,
        expenseRow,
        journalCountRow,
      ] = await Promise.all([
        db.query(`SELECT COALESCE(SUM(balance_amount),0) AS val FROM purchase_invoices WHERE institution_id=? AND status IN ('posted','partially_paid')`, [institutionId]),
        db.query(`SELECT COALESCE(SUM(balance_amount),0) AS val FROM sales_invoices    WHERE institution_id=? AND status IN ('posted','partially_paid')`, [institutionId]),
        db.query(`SELECT COALESCE(SUM(credit_amount),0)  AS val FROM accounting_entries WHERE institution_id=? AND account_code IN ('4000','SALES_REVENUE')`, [institutionId]),
        db.query(`SELECT COALESCE(SUM(debit_amount),0)   AS val FROM accounting_entries WHERE institution_id=? AND account_code IN ('5000','5100','PURCHASE_EXPENSE','COGS')`, [institutionId]),
        db.query(`SELECT COUNT(*) AS val FROM accounting_entries WHERE institution_id=?`, [institutionId]),
      ]);

      res.json({
        success: true,
        data: {
          totalPayable:     parseFloat(payableRow[0]?.val)      || 0,
          totalReceivable:  parseFloat(receivableRow[0]?.val)   || 0,
          totalRevenue:     parseFloat(revenueRow[0]?.val)      || 0,
          totalExpense:     parseFloat(expenseRow[0]?.val)      || 0,
          journalEntries:   parseInt(journalCountRow[0]?.val)   || 0,
          netProfit:        (parseFloat(revenueRow[0]?.val) || 0) - (parseFloat(expenseRow[0]?.val) || 0),
        },
      });
    } catch (error) {
      logger.error('Error fetching accounting summary:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch accounting summary' });
    }
  }
}

module.exports = new AccountingController();
