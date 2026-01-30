const db = require('../database/connection');
const logger = require('../utils/logger');

class ReportsService {
  // Inventory Reports
  async getInventoryReport(institutionId, filters = {}) {
    let query = `
      SELECT ip.*, i.sku, i.name as item_name, i.unit, w.name as warehouse_name,
             c.name as category_name
      FROM inventory_projections ip
      JOIN items i ON ip.item_id = i.id
      JOIN warehouses w ON ip.warehouse_id = w.id
      LEFT JOIN categories c ON i.category = c.name
      WHERE ip.institution_id = ?
    `;
    const params = [institutionId];

    if (filters.warehouseId) {
      query += ' AND ip.warehouse_id = ?';
      params.push(filters.warehouseId);
    }
    if (filters.category) {
      query += ' AND i.category = ?';
      params.push(filters.category);
    }

    query += ' ORDER BY i.name, w.name LIMIT 1000';
    
    try {
      return await db.query(query, params);
    } catch (error) {
      console.error('Inventory report error:', error);
      return [];
    }
  }

  async getInventoryMovementReport(institutionId, filters = {}) {
    let query = `
      SELECT es.created_at, es.event_type, es.event_data, es.metadata,
             i.sku, i.name as item_name, w.name as warehouse_name
      FROM event_store es
      LEFT JOIN items i ON JSON_UNQUOTE(JSON_EXTRACT(es.event_data, '$.itemId')) = i.id
      LEFT JOIN warehouses w ON JSON_UNQUOTE(JSON_EXTRACT(es.event_data, '$.warehouseId')) = w.id
      WHERE es.institution_id = ? AND es.aggregate_type = 'inventory'
    `;
    const params = [institutionId];

    if (filters.startDate) {
      query += ' AND DATE(es.created_at) >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND DATE(es.created_at) <= ?';
      params.push(filters.endDate);
    }
    if (filters.itemId) {
      query += ' AND JSON_UNQUOTE(JSON_EXTRACT(es.event_data, "$.itemId")) = ?';
      params.push(filters.itemId);
    }

    query += ' ORDER BY es.created_at DESC LIMIT 1000';
    return await db.query(query, params);
  }

  // Purchase Reports
  async getPurchaseReport(institutionId, filters = {}) {
    let query = `
      SELECT po.*, COALESCE(v.display_name, po.vendor_name) as vendor_name, w.name as warehouse_name,
             COUNT(pol.id) as line_count,
             SUM(pol.quantity_ordered) as total_quantity,
             SUM(pol.quantity_received) as total_received
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN warehouses w ON po.warehouse_id = w.id
      LEFT JOIN purchase_order_lines pol ON po.id = pol.po_id
      WHERE po.institution_id = ?
    `;
    const params = [institutionId];

    if (filters.startDate) {
      query += ' AND DATE(po.order_date) >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND DATE(po.order_date) <= ?';
      params.push(filters.endDate);
    }
    if (filters.status) {
      query += ' AND po.status = ?';
      params.push(filters.status);
    }
    if (filters.vendorId) {
      query += ' AND po.vendor_id = ?';
      params.push(filters.vendorId);
    }

    query += ' GROUP BY po.id ORDER BY po.order_date DESC LIMIT 1000';
    
    try {
      return await db.query(query, params);
    } catch (error) {
      console.error('Purchase report error:', error);
      return [];
    }
  }

  async getGRNReport(institutionId, filters = {}) {
    let query = `
      SELECT grn.*, po.po_number, w.name as warehouse_name,
             COUNT(gl.id) as line_count,
             SUM(gl.quantity_received) as total_received,
             SUM(gl.line_total) as total_value
      FROM goods_receipt_notes grn
      JOIN purchase_orders po ON grn.po_id = po.id
      LEFT JOIN warehouses w ON grn.warehouse_id = w.id
      LEFT JOIN grn_lines gl ON grn.id = gl.grn_id
      WHERE grn.institution_id = ?
    `;
    const params = [institutionId];

    if (filters.startDate) {
      query += ' AND grn.receipt_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND grn.receipt_date <= ?';
      params.push(filters.endDate);
    }

    query += ' GROUP BY grn.id ORDER BY grn.receipt_date DESC';
    return await db.query(query, params);
  }

  // Sales Reports
  async getSalesReport(institutionId, filters = {}) {
    let query = `
      SELECT so.*, COALESCE(c.display_name, so.customer_name) as customer_name, w.name as warehouse_name,
             COUNT(sol.id) as line_count,
             SUM(sol.quantity_ordered) as total_quantity,
             SUM(sol.quantity_shipped) as total_shipped
      FROM sales_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN warehouses w ON so.warehouse_id = w.id
      LEFT JOIN sales_order_lines sol ON so.id = sol.so_id
      WHERE so.institution_id = ?
    `;
    const params = [institutionId];

    if (filters.startDate) {
      query += ' AND DATE(so.order_date) >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND DATE(so.order_date) <= ?';
      params.push(filters.endDate);
    }
    if (filters.status) {
      query += ' AND so.status = ?';
      params.push(filters.status);
    }

    query += ' GROUP BY so.id ORDER BY so.order_date DESC LIMIT 1000';
    
    try {
      return await db.query(query, params);
    } catch (error) {
      console.error('Sales report error:', error);
      return [];
    }
  }

  // Financial Reports
  async getProfitLossReport(institutionId, filters = {}) {
    const startDate = filters.startDate || new Date(new Date().getFullYear(), 0, 1);
    const endDate = filters.endDate || new Date();

    const [sales, purchases] = await Promise.all([
      db.query(`
        SELECT SUM(total_amount) as total_sales
        FROM sales_orders 
        WHERE institution_id = ? AND status IN ('shipped', 'delivered') 
        AND order_date BETWEEN ? AND ?
      `, [institutionId, startDate, endDate]),
      
      db.query(`
        SELECT SUM(total_amount) as total_purchases
        FROM purchase_orders 
        WHERE institution_id = ? AND status = 'received'
        AND order_date BETWEEN ? AND ?
      `, [institutionId, startDate, endDate])
    ]);

    return {
      totalSales: sales[0]?.total_sales || 0,
      totalPurchases: purchases[0]?.total_purchases || 0,
      grossProfit: (sales[0]?.total_sales || 0) - (purchases[0]?.total_purchases || 0),
      period: { startDate, endDate }
    };
  }

  async getInventoryValuationReport(institutionId, filters = {}) {
    let query = `
      SELECT ip.*, i.sku, i.name as item_name, w.name as warehouse_name,
             (ip.quantity_on_hand * ip.average_cost) as current_value
      FROM inventory_projections ip
      JOIN items i ON ip.item_id = i.id
      JOIN warehouses w ON ip.warehouse_id = w.id
      WHERE ip.institution_id = ?
    `;
    const params = [institutionId];

    if (filters.warehouseId) {
      query += ' AND ip.warehouse_id = ?';
      params.push(filters.warehouseId);
    }

    query += ' ORDER BY current_value DESC';
    const items = await db.query(query, params);
    
    const totalValue = items.reduce((sum, item) => sum + parseFloat(item.current_value), 0);
    
    return { items, totalValue };
  }

  // Analytics Reports
  async getTopSellingItems(institutionId, filters = {}) {
    let query = `
      SELECT i.id, i.sku, i.name, SUM(sol.quantity_ordered) as total_sold,
             SUM(sol.line_total) as total_revenue
      FROM sales_order_lines sol
      JOIN sales_orders so ON sol.so_id = so.id
      JOIN items i ON sol.item_id = i.id
      WHERE so.institution_id = ? AND so.status IN ('shipped', 'delivered')
    `;
    const params = [institutionId];

    if (filters.startDate) {
      query += ' AND so.order_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND so.order_date <= ?';
      params.push(filters.endDate);
    }

    query += ' GROUP BY i.id ORDER BY total_sold DESC LIMIT 20';
    return await db.query(query, params);
  }

  async getLowStockReport(institutionId, threshold = 10) {
    return await db.query(`
      SELECT ip.*, i.sku, i.name as item_name, w.name as warehouse_name
      FROM inventory_projections ip
      JOIN items i ON ip.item_id = i.id
      JOIN warehouses w ON ip.warehouse_id = w.id
      WHERE ip.institution_id = ? AND ip.quantity_available <= ?
      ORDER BY ip.quantity_available ASC
    `, [institutionId, threshold]);
  }

  async getVendorPerformanceReport(institutionId, filters = {}) {
    let query = `
      SELECT v.id, v.display_name as name, v.vendor_code,
             COUNT(po.id) as total_orders,
             SUM(po.total_amount) as total_value,
             AVG(DATEDIFF(grn.receipt_date, po.order_date)) as avg_delivery_days,
             COUNT(grn.id) as delivered_orders
      FROM vendors v
      LEFT JOIN purchase_orders po ON v.id = po.vendor_id
      LEFT JOIN goods_receipt_notes grn ON po.id = grn.po_id
      WHERE v.institution_id = ?
    `;
    const params = [institutionId];

    if (filters.startDate) {
      query += ' AND po.order_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND po.order_date <= ?';
      params.push(filters.endDate);
    }

    query += ' GROUP BY v.id ORDER BY total_value DESC';
    return await db.query(query, params);
  }

  // Dashboard Summary
  async getDashboardSummary(institutionId) {
    const [inventory, sales, purchases, lowStock] = await Promise.all([
      db.query('SELECT SUM(total_value) as total_value FROM inventory_projections WHERE institution_id = ?', [institutionId]),
      db.query('SELECT COUNT(*) as count, SUM(total_amount) as value FROM sales_orders WHERE institution_id = ? AND status IN ("shipped", "delivered")', [institutionId]),
      db.query('SELECT COUNT(*) as count, SUM(total_amount) as value FROM purchase_orders WHERE institution_id = ? AND status = "received"', [institutionId]),
      db.query('SELECT COUNT(*) as count FROM inventory_projections WHERE institution_id = ? AND quantity_available <= 10', [institutionId])
    ]);

    return {
      inventoryValue: inventory[0]?.total_value || 0,
      totalSales: { count: sales[0]?.count || 0, value: sales[0]?.value || 0 },
      totalPurchases: { count: purchases[0]?.count || 0, value: purchases[0]?.value || 0 },
      lowStockItems: lowStock[0]?.count || 0
    };
  }
}

module.exports = new ReportsService();