const db = require('../database/connection');
const logger = require('../utils/logger');

class InvoiceDashboardController {
  // Get Invoice Dashboard Summary
  async getDashboardSummary(req, res) {
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

      // Purchase Invoice Summary
      const [purchaseSummary] = await db.query(`
        SELECT 
          COUNT(*) as total_invoices,
          SUM(total_amount) as total_amount,
          SUM(paid_amount) as paid_amount,
          SUM(balance_amount) as outstanding_amount,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
          COUNT(CASE WHEN status = 'posted' THEN 1 END) as posted_count,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
        FROM purchase_invoices
        ${whereClause}
      `, params);

      // Sales Invoice Summary
      const [salesSummary] = await db.query(`
        SELECT 
          COUNT(*) as total_invoices,
          SUM(total_amount) as total_amount,
          SUM(paid_amount) as paid_amount,
          SUM(balance_amount) as outstanding_amount,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
          COUNT(CASE WHEN status = 'posted' THEN 1 END) as posted_count,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
        FROM sales_invoices
        ${whereClause}
      `, params);

      // Overdue Invoices
      const overdueInvoices = await db.query(`
        SELECT 
          'purchase' as type,
          invoice_number,
          vendor_name as party_name,
          total_amount,
          balance_amount,
          due_date,
          DATEDIFF(CURDATE(), due_date) as days_overdue
        FROM purchase_invoices
        WHERE institution_id = ? 
        AND status IN ('posted', 'partially_paid')
        AND balance_amount > 0
        AND due_date < CURDATE()
        
        UNION ALL
        
        SELECT 
          'sales' as type,
          invoice_number,
          customer_name as party_name,
          total_amount,
          balance_amount,
          due_date,
          DATEDIFF(CURDATE(), due_date) as days_overdue
        FROM sales_invoices
        WHERE institution_id = ? 
        AND status IN ('posted', 'partially_paid')
        AND balance_amount > 0
        AND due_date < CURDATE()
        
        ORDER BY days_overdue DESC
        LIMIT 10
      `, [institutionId, institutionId]);

      // Recent Invoices
      const recentInvoices = await db.query(`
        SELECT 
          'purchase' as type,
          id,
          invoice_number,
          vendor_name as party_name,
          total_amount,
          status,
          created_at
        FROM purchase_invoices
        WHERE institution_id = ?
        
        UNION ALL
        
        SELECT 
          'sales' as type,
          id,
          invoice_number,
          customer_name as party_name,
          total_amount,
          status,
          created_at
        FROM sales_invoices
        WHERE institution_id = ?
        
        ORDER BY created_at DESC
        LIMIT 10
      `, [institutionId, institutionId]);

      res.json({
        success: true,
        data: {
          purchase: {
            total_invoices: parseInt(purchaseSummary.total_invoices) || 0,
            total_amount: parseFloat(purchaseSummary.total_amount) || 0,
            paid_amount: parseFloat(purchaseSummary.paid_amount) || 0,
            outstanding_amount: parseFloat(purchaseSummary.outstanding_amount) || 0,
            draft_count: parseInt(purchaseSummary.draft_count) || 0,
            posted_count: parseInt(purchaseSummary.posted_count) || 0,
            paid_count: parseInt(purchaseSummary.paid_count) || 0
          },
          sales: {
            total_invoices: parseInt(salesSummary.total_invoices) || 0,
            total_amount: parseFloat(salesSummary.total_amount) || 0,
            paid_amount: parseFloat(salesSummary.paid_amount) || 0,
            outstanding_amount: parseFloat(salesSummary.outstanding_amount) || 0,
            draft_count: parseInt(salesSummary.draft_count) || 0,
            posted_count: parseInt(salesSummary.posted_count) || 0,
            paid_count: parseInt(salesSummary.paid_count) || 0
          },
          overdue_invoices: overdueInvoices,
          recent_invoices: recentInvoices
        }
      });

    } catch (error) {
      logger.error('Error fetching invoice dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch invoice dashboard'
      });
    }
  }

  // Get Outstanding Invoices Summary
  async getOutstandingSummary(req, res) {
    try {
      const { institutionId } = req;

      const outstanding = await db.query(`
        SELECT 
          'purchase' as type,
          invoice_number,
          vendor_name as party_name,
          total_amount,
          balance_amount,
          due_date,
          CASE 
            WHEN due_date >= CURDATE() THEN 'current'
            WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN 'overdue_1_30'
            WHEN DATEDIFF(CURDATE(), due_date) <= 60 THEN 'overdue_31_60'
            WHEN DATEDIFF(CURDATE(), due_date) <= 90 THEN 'overdue_61_90'
            ELSE 'overdue_90_plus'
          END as aging_bucket
        FROM purchase_invoices
        WHERE institution_id = ? 
        AND status IN ('posted', 'partially_paid')
        AND balance_amount > 0
        
        UNION ALL
        
        SELECT 
          'sales' as type,
          invoice_number,
          customer_name as party_name,
          total_amount,
          balance_amount,
          due_date,
          CASE 
            WHEN due_date >= CURDATE() THEN 'current'
            WHEN DATEDIFF(CURDATE(), due_date) <= 30 THEN 'overdue_1_30'
            WHEN DATEDIFF(CURDATE(), due_date) <= 60 THEN 'overdue_31_60'
            WHEN DATEDIFF(CURDATE(), due_date) <= 90 THEN 'overdue_61_90'
            ELSE 'overdue_90_plus'
          END as aging_bucket
        FROM sales_invoices
        WHERE institution_id = ? 
        AND status IN ('posted', 'partially_paid')
        AND balance_amount > 0
        
        ORDER BY due_date
      `, [institutionId, institutionId]);

      // Group by aging buckets
      const aging = {
        current: [],
        overdue_1_30: [],
        overdue_31_60: [],
        overdue_61_90: [],
        overdue_90_plus: []
      };

      outstanding.forEach(invoice => {
        aging[invoice.aging_bucket].push(invoice);
      });

      // Calculate totals for each bucket
      const agingSummary = Object.keys(aging).map(bucket => ({
        bucket,
        count: aging[bucket].length,
        total_amount: aging[bucket].reduce((sum, inv) => sum + parseFloat(inv.balance_amount), 0)
      }));

      res.json({
        success: true,
        data: {
          aging_detail: aging,
          aging_summary: agingSummary,
          total_outstanding: outstanding.reduce((sum, inv) => sum + parseFloat(inv.balance_amount), 0),
          total_count: outstanding.length
        }
      });

    } catch (error) {
      logger.error('Error fetching outstanding summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch outstanding summary'
      });
    }
  }
}

module.exports = new InvoiceDashboardController();