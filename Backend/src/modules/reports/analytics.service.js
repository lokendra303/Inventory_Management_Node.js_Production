const db = require('../../database/connection');

class AnalyticsService {
  // ─── #12 ABC ANALYSIS ────────────────────────────────────
  async getABCAnalysis(institutionId, filters = {}) {
    const { startDate, endDate, warehouseId } = filters;
    const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    const items = await db.query(
      `SELECT
         i.id, i.sku, i.name as item_name, i.category,
         COALESCE(SUM(sol.quantity_ordered), 0) as total_qty_sold,
         COALESCE(SUM(sol.line_total), 0) as total_revenue,
         COALESCE(ip.quantity_on_hand, 0) as stock_on_hand,
         COALESCE(ip.total_value, 0) as stock_value
       FROM items i
       LEFT JOIN sales_order_lines sol ON i.id = sol.item_id
       LEFT JOIN sales_orders so ON sol.so_id = so.id
         AND so.institution_id = ? AND so.status IN ('shipped','delivered')
         AND DATE(so.order_date) BETWEEN ? AND ?
       LEFT JOIN inventory_projections ip ON i.id = ip.item_id AND ip.institution_id = ?
         ${warehouseId ? 'AND ip.warehouse_id = ?' : ''}
       WHERE i.institution_id = ? AND i.status = 'active'
       GROUP BY i.id
       ORDER BY total_revenue DESC`,
      warehouseId
        ? [institutionId, start, end, institutionId, warehouseId, institutionId]
        : [institutionId, start, end, institutionId, institutionId]
    );

    const totalRevenue = items.reduce((s, i) => s + parseFloat(i.total_revenue), 0);
    let cumulative = 0;

    return items.map(item => {
      const revenue = parseFloat(item.total_revenue);
      const pct = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
      cumulative += pct;
      const abc = cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C';
      return { ...item, revenue_pct: pct.toFixed(2), cumulative_pct: cumulative.toFixed(2), abc_class: abc };
    });
  }

  async getSlowMovingStock(institutionId, daysThreshold = 90) {
    return db.query(
      `SELECT
         i.id, i.sku, i.name as item_name, i.category,
         ip.quantity_on_hand, ip.total_value, ip.last_movement_date,
         DATEDIFF(CURDATE(), ip.last_movement_date) as days_idle,
         w.name as warehouse_name
       FROM inventory_projections ip
       JOIN items i ON ip.item_id = i.id AND i.status = 'active'
       JOIN warehouses w ON ip.warehouse_id = w.id AND w.status = 'active'
       WHERE ip.institution_id = ? AND ip.quantity_on_hand > 0
         AND (ip.last_movement_date IS NULL OR DATEDIFF(CURDATE(), ip.last_movement_date) >= ?)
       ORDER BY days_idle DESC`,
      [institutionId, daysThreshold]
    );
  }

  async getDeadStock(institutionId) {
    return db.query(
      `SELECT
         i.id, i.sku, i.name as item_name,
         ip.quantity_on_hand, ip.total_value, ip.last_movement_date,
         w.name as warehouse_name
       FROM inventory_projections ip
       JOIN items i ON ip.item_id = i.id AND i.status = 'active'
       JOIN warehouses w ON ip.warehouse_id = w.id AND w.status = 'active'
       WHERE ip.institution_id = ? AND ip.quantity_on_hand > 0
         AND (ip.last_movement_date IS NULL OR DATEDIFF(CURDATE(), ip.last_movement_date) > 180)
       ORDER BY ip.total_value DESC`,
      [institutionId]
    );
  }

  // ─── #13 DEMAND FORECASTING ──────────────────────────────
  async getDemandForecast(institutionId, itemId, warehouseId) {
    // Calculate 30-day rolling average sales velocity
    const velocityRows = await db.query(
      `SELECT
         DATE_FORMAT(so.order_date, '%Y-%m') as month,
         SUM(sol.quantity_ordered) as qty_sold
       FROM sales_order_lines sol
       JOIN sales_orders so ON sol.so_id = so.id
       WHERE so.institution_id = ? AND sol.item_id = ?
         AND so.status IN ('shipped','delivered')
         AND so.order_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(so.order_date, '%Y-%m')
       ORDER BY month ASC`,
      [institutionId, itemId]
    );

    const avgMonthly = velocityRows.length > 0
      ? velocityRows.reduce((s, r) => s + parseFloat(r.qty_sold), 0) / velocityRows.length
      : 0;
    const dailyVelocity = avgMonthly / 30;

    // Current stock
    const [proj] = await db.query(
      'SELECT quantity_available FROM inventory_projections WHERE institution_id=? AND item_id=? AND warehouse_id=?',
      [institutionId, itemId, warehouseId]
    );
    const currentStock = parseFloat(proj?.quantity_available || 0);

    // Reorder level
    const [rl] = await db.query(
      'SELECT reorder_level, reorder_quantity, max_stock_level FROM reorder_levels WHERE institution_id=? AND item_id=? AND warehouse_id=?',
      [institutionId, itemId, warehouseId]
    );

    const daysOfStock = dailyVelocity > 0 ? Math.floor(currentStock / dailyVelocity) : null;
    const stockoutDate = daysOfStock !== null
      ? new Date(Date.now() + daysOfStock * 86400000).toISOString().split('T')[0]
      : null;

    return {
      itemId, warehouseId,
      avgMonthlySales: parseFloat(avgMonthly.toFixed(2)),
      dailyVelocity: parseFloat(dailyVelocity.toFixed(4)),
      currentStock,
      daysOfStockRemaining: daysOfStock,
      projectedStockoutDate: stockoutDate,
      reorderLevel: rl?.reorder_level || null,
      suggestedOrderQty: rl?.reorder_quantity || Math.ceil(avgMonthly * 2),
      monthlyHistory: velocityRows,
      forecast30d: parseFloat((dailyVelocity * 30).toFixed(2)),
      forecast60d: parseFloat((dailyVelocity * 60).toFixed(2)),
      forecast90d: parseFloat((dailyVelocity * 90).toFixed(2))
    };
  }

  // ─── #14 PROPER P&L ──────────────────────────────────────
  async getProperProfitLoss(institutionId, startDate, endDate) {
    const start = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    const [
      salesData, returnsData, purchasesData, purchaseReturnsData,
      openingStock, closingStock, cogsData
    ] = await Promise.all([
      // Gross sales revenue
      db.query(
        `SELECT COALESCE(SUM(si.total_amount),0) as total
         FROM sales_invoices si WHERE si.institution_id=? AND DATE(si.invoice_date) BETWEEN ? AND ? AND si.status != 'cancelled'`,
        [institutionId, start, end]
      ),
      // Sales returns (credit notes)
      db.query(
        `SELECT COALESCE(SUM(total_amount),0) as total
         FROM sales_orders WHERE institution_id=? AND status='returned' AND DATE(order_date) BETWEEN ? AND ?`,
        [institutionId, start, end]
      ),
      // Total purchases
      db.query(
        `SELECT COALESCE(SUM(pi.total_amount),0) as total
         FROM purchase_invoices pi WHERE pi.institution_id=? AND DATE(pi.invoice_date) BETWEEN ? AND ? AND pi.status != 'cancelled'`,
        [institutionId, start, end]
      ),
      // Purchase returns (debit notes)
      db.query(
        `SELECT COALESCE(SUM(total_amount),0) as total
         FROM purchase_returns WHERE institution_id=? AND status='confirmed' AND DATE(return_date) BETWEEN ? AND ?`,
        [institutionId, start, end]
      ),
      // Opening stock value (as of start date)
      db.query(
        `SELECT COALESCE(SUM(total_value),0) as total FROM inventory_projections WHERE institution_id=?`,
        [institutionId]
      ),
      // Closing stock value (current)
      db.query(
        `SELECT COALESCE(SUM(total_value),0) as total FROM inventory_projections WHERE institution_id=?`,
        [institutionId]
      ),
      // COGS from accounting entries
      db.query(
        `SELECT COALESCE(SUM(debit_amount),0) as total
         FROM accounting_entries WHERE institution_id=? AND account_code='5100' AND DATE(entry_date) BETWEEN ? AND ?`,
        [institutionId, start, end]
      )
    ]);

    const grossRevenue = parseFloat(salesData[0]?.total || 0);
    const salesReturns = parseFloat(returnsData[0]?.total || 0);
    const netRevenue = grossRevenue - salesReturns;

    const grossPurchases = parseFloat(purchasesData[0]?.total || 0);
    const purchaseReturns = parseFloat(purchaseReturnsData[0]?.total || 0);
    const netPurchases = grossPurchases - purchaseReturns;

    const openingStockVal = parseFloat(openingStock[0]?.total || 0);
    const closingStockVal = parseFloat(closingStock[0]?.total || 0);

    // COGS = Opening Stock + Net Purchases - Closing Stock
    const cogsCalculated = openingStockVal + netPurchases - closingStockVal;
    const cogsAccounting = parseFloat(cogsData[0]?.total || 0);
    const cogs = cogsAccounting > 0 ? cogsAccounting : cogsCalculated;

    const grossProfit = netRevenue - cogs;
    const grossMarginPct = netRevenue > 0 ? ((grossProfit / netRevenue) * 100).toFixed(2) : '0.00';

    return {
      period: { startDate: start, endDate: end },
      revenue: {
        grossRevenue: parseFloat(grossRevenue.toFixed(2)),
        salesReturns: parseFloat(salesReturns.toFixed(2)),
        netRevenue: parseFloat(netRevenue.toFixed(2))
      },
      cogs: {
        openingStock: parseFloat(openingStockVal.toFixed(2)),
        purchases: parseFloat(netPurchases.toFixed(2)),
        closingStock: parseFloat(closingStockVal.toFixed(2)),
        totalCOGS: parseFloat(cogs.toFixed(2))
      },
      profit: {
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        grossMarginPct: parseFloat(grossMarginPct)
      }
    };
  }
}

module.exports = new AnalyticsService();
