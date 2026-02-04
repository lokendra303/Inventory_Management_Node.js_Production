const db = require('../database/connection');
const logger = require('../utils/logger');

class ProfitLossController {
  async getProfitLoss(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const institutionId = req.institutionId;

      // Revenue from sales
      const revenue = await db.query(`
        SELECT COALESCE(SUM(sol.quantity_shipped * sol.unit_price), 0) as total_revenue
        FROM sales_order_lines sol
        JOIN sales_orders so ON sol.so_id = so.id
        WHERE so.institution_id = ? AND so.status = 'shipped'
        ${startDate ? 'AND so.order_date >= ?' : ''}
        ${endDate ? 'AND so.order_date <= ?' : ''}
      `, [institutionId, startDate, endDate].filter(Boolean));

      // Cost of Goods Sold
      const cogs = await db.query(`
        SELECT COALESCE(SUM(sol.quantity_shipped * i.cost_price), 0) as total_cogs
        FROM sales_order_lines sol
        JOIN sales_orders so ON sol.so_id = so.id
        JOIN items i ON sol.item_id = i.id
        WHERE so.institution_id = ? AND so.status = 'shipped'
        ${startDate ? 'AND so.order_date >= ?' : ''}
        ${endDate ? 'AND so.order_date <= ?' : ''}
      `, [institutionId, startDate, endDate].filter(Boolean));

      // Purchase expenses
      const purchases = await db.query(`
        SELECT COALESCE(SUM(pol.quantity_received * pol.unit_cost), 0) as total_purchases
        FROM purchase_order_lines pol
        JOIN purchase_orders po ON pol.po_id = po.id
        WHERE po.institution_id = ? AND po.status IN ('received', 'partially_received')
        ${startDate ? 'AND po.order_date >= ?' : ''}
        ${endDate ? 'AND po.order_date <= ?' : ''}
      `, [institutionId, startDate, endDate].filter(Boolean));

      // Inventory losses (adjustments, transfers, damaged, expired)
      const inventoryLosses = await db.query(`
        SELECT COALESCE(SUM(
          CASE 
            WHEN es.event_data->>'$.adjustmentType' = 'decrease' THEN 
              ABS(CAST(es.event_data->>'$.quantityChange' AS DECIMAL(10,2))) * i.cost_price
            WHEN es.event_type = 'TRANSFER_OUT' THEN 
              CAST(es.event_data->>'$.quantity' AS DECIMAL(10,2)) * i.cost_price
            ELSE 0
          END
        ), 0) as total_losses
        FROM event_store es
        JOIN items i ON es.event_data->>'$.itemId' = i.id
        WHERE es.institution_id = ? 
          AND es.aggregate_type = 'inventory'
          AND (es.event_type IN ('STOCK_ADJUSTED', 'TRANSFER_OUT') 
               OR (es.event_type = 'STOCK_ADJUSTED' AND es.event_data->>'$.adjustmentType' = 'decrease'))
        ${startDate ? 'AND DATE(es.created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(es.created_at) <= ?' : ''}
      `, [institutionId, startDate, endDate].filter(Boolean));

      const totalRevenue = revenue[0]?.total_revenue || 0;
      const totalCogs = cogs[0]?.total_cogs || 0;
      const totalPurchases = purchases[0]?.total_purchases || 0;
      const totalLosses = inventoryLosses[0]?.total_losses || 0;
      const grossProfit = totalRevenue - totalCogs;
      const netProfit = grossProfit - totalLosses; // Subtract inventory losses

      res.json({
        success: true,
        data: {
          revenue: totalRevenue,
          cogs: totalCogs,
          grossProfit,
          netProfit,
          purchases: totalPurchases,
          inventoryLosses: totalLosses,
          period: { startDate, endDate }
        }
      });
    } catch (error) {
      logger.error('Failed to get P&L', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getProfitLossDetails(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const institutionId = req.institutionId;

      // Sales details
      const sales = await db.query(`
        SELECT so.so_number, so.customer_name, so.order_date,
               sol.item_id, i.name as item_name, i.sku,
               sol.quantity_shipped, sol.unit_price, i.cost_price,
               (sol.quantity_shipped * sol.unit_price) as revenue,
               (sol.quantity_shipped * i.cost_price) as cost,
               (sol.quantity_shipped * (sol.unit_price - i.cost_price)) as profit
        FROM sales_order_lines sol
        JOIN sales_orders so ON sol.so_id = so.id
        JOIN items i ON sol.item_id = i.id
        WHERE so.institution_id = ? AND so.status = 'shipped'
        ${startDate ? 'AND so.order_date >= ?' : ''}
        ${endDate ? 'AND so.order_date <= ?' : ''}
        ORDER BY so.order_date DESC
      `, [institutionId, startDate, endDate].filter(Boolean));

      res.json({
        success: true,
        data: { sales }
      });
    } catch (error) {
      logger.error('Failed to get P&L details', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getInventoryMovements(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const institutionId = req.institutionId;

      // Get inventory adjustments and transfers
      const movements = await db.query(`
        SELECT es.event_type, es.event_data, es.created_at, i.name as item_name, i.sku,
               CASE 
                 WHEN es.event_type = 'STOCK_ADJUSTED' AND es.event_data->>'$.adjustmentType' = 'decrease' THEN 
                   ABS(CAST(es.event_data->>'$.quantityChange' AS DECIMAL(10,2))) * i.cost_price
                 WHEN es.event_type = 'TRANSFER_OUT' THEN 
                   CAST(es.event_data->>'$.quantity' AS DECIMAL(10,2)) * i.cost_price
                 ELSE 0
               END as cost_impact
        FROM event_store es
        JOIN items i ON es.event_data->>'$.itemId' = i.id
        WHERE es.institution_id = ? 
          AND es.aggregate_type = 'inventory'
          AND (es.event_type IN ('STOCK_ADJUSTED', 'TRANSFER_OUT', 'TRANSFER_IN'))
        ${startDate ? 'AND DATE(es.created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(es.created_at) <= ?' : ''}
        ORDER BY es.created_at DESC
      `, [institutionId, startDate, endDate].filter(Boolean));

      res.json({
        success: true,
        data: { movements }
      });
    } catch (error) {
      logger.error('Failed to get P&L details', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

module.exports = new ProfitLossController();