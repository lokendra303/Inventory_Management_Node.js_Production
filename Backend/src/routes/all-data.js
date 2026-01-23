const express = require('express');
const router = express.Router();
const db = require('../database/connection');

// Get all data from all tables
router.get('/all-data', async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const data = {};

    // Core tables
    data.tenants = await db.query('SELECT * FROM tenants WHERE id = ?', [tenant_id]);
    data.users = await db.query('SELECT * FROM users WHERE tenant_id = ?', [tenant_id]);
    data.roles = await db.query('SELECT * FROM roles WHERE tenant_id = ?', [tenant_id]);

    // Inventory tables
    data.items = await db.query('SELECT * FROM items WHERE tenant_id = ?', [tenant_id]);
    data.categories = await db.query('SELECT * FROM categories WHERE tenant_id = ?', [tenant_id]);
    data.inventory_projections = await db.query('SELECT * FROM inventory_projections WHERE tenant_id = ?', [tenant_id]);

    // Warehouse tables
    data.warehouses = await db.query('SELECT * FROM warehouses WHERE tenant_id = ?', [tenant_id]);
    data.warehouse_types = await db.query('SELECT * FROM warehouse_types WHERE tenant_id = ?', [tenant_id]);
    data.warehouse_zones = await db.query('SELECT * FROM warehouse_zones WHERE tenant_id = ?', [tenant_id]);
    data.warehouse_racks = await db.query('SELECT * FROM warehouse_racks WHERE tenant_id = ?', [tenant_id]);
    data.warehouse_bins = await db.query('SELECT * FROM warehouse_bins WHERE tenant_id = ?', [tenant_id]);

    // Purchase tables
    data.vendors = await db.query('SELECT * FROM vendors WHERE tenant_id = ?', [tenant_id]);
    data.purchase_orders = await db.query('SELECT * FROM purchase_orders WHERE tenant_id = ?', [tenant_id]);
    data.purchase_order_lines = await db.query('SELECT * FROM purchase_order_lines WHERE tenant_id = ?', [tenant_id]);
    data.goods_receipt_notes = await db.query('SELECT * FROM goods_receipt_notes WHERE tenant_id = ?', [tenant_id]);
    data.grn_lines = await db.query('SELECT * FROM grn_lines WHERE tenant_id = ?', [tenant_id]);

    // Sales tables
    data.customers = await db.query('SELECT * FROM customers WHERE tenant_id = ?', [tenant_id]);
    data.sales_orders = await db.query('SELECT * FROM sales_orders WHERE tenant_id = ?', [tenant_id]);
    data.sales_order_lines = await db.query('SELECT * FROM sales_order_lines WHERE tenant_id = ?', [tenant_id]);

    // Tracking tables
    data.item_batches = await db.query('SELECT * FROM item_batches WHERE tenant_id = ?', [tenant_id]);
    data.item_serials = await db.query('SELECT * FROM item_serials WHERE tenant_id = ?', [tenant_id]);
    data.reorder_levels = await db.query('SELECT * FROM reorder_levels WHERE tenant_id = ?', [tenant_id]);
    data.low_stock_alerts = await db.query('SELECT * FROM low_stock_alerts WHERE tenant_id = ?', [tenant_id]);

    // System tables
    data.event_store = await db.query('SELECT * FROM event_store WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100', [tenant_id]);
    data.api_keys = await db.query('SELECT * FROM api_keys WHERE tenant_id = ?', [tenant_id]);
    data.bearer_tokens = await db.query('SELECT * FROM bearer_tokens WHERE tenant_id = ?', [tenant_id]);

    res.json({
      success: true,
      data,
      summary: {
        tenants: data.tenants.length,
        users: data.users.length,
        items: data.items.length,
        warehouses: data.warehouses.length,
        vendors: data.vendors.length,
        customers: data.customers.length,
        purchase_orders: data.purchase_orders.length,
        sales_orders: data.sales_orders.length,
        inventory_projections: data.inventory_projections.length,
        events: data.event_store.length
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    const dashboard = {};

    // Inventory summary
    const [inventorySummary] = await db.query(`
      SELECT 
        COUNT(DISTINCT i.id) as total_items,
        COUNT(DISTINCT ip.warehouse_id) as active_warehouses,
        SUM(ip.quantity_on_hand) as total_stock,
        SUM(ip.total_value) as total_value
      FROM items i
      LEFT JOIN inventory_projections ip ON i.id = ip.item_id
      WHERE i.tenant_id = ?
    `, [tenant_id]);

    dashboard.inventory = inventorySummary;

    // Purchase summary
    const [purchaseSummary] = await db.query(`
      SELECT 
        COUNT(*) as total_pos,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_pos,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_pos,
        SUM(total_amount) as total_po_value
      FROM purchase_orders 
      WHERE tenant_id = ?
    `, [tenant_id]);

    dashboard.purchases = purchaseSummary;

    // Sales summary
    const [salesSummary] = await db.query(`
      SELECT 
        COUNT(*) as total_sos,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_sos,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_sos,
        SUM(total_amount) as total_so_value
      FROM sales_orders 
      WHERE tenant_id = ?
    `, [tenant_id]);

    dashboard.sales = salesSummary;

    // Low stock alerts
    const lowStockAlerts = await db.query(`
      SELECT COUNT(*) as count 
      FROM low_stock_alerts 
      WHERE tenant_id = ? AND status = 'active'
    `, [tenant_id]);

    dashboard.alerts = { low_stock: lowStockAlerts[0].count };

    res.json({ success: true, dashboard });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enable all features endpoint
router.post('/enable-features', async (req, res) => {
  try {
    const { tenant_id } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id is required' });
    }

    // Create sample data for all features
    const features = [];

    // 1. Create sample warehouse if none exists
    const warehouses = await db.query('SELECT COUNT(*) as count FROM warehouses WHERE tenant_id = ?', [tenant_id]);
    if (warehouses[0].count === 0) {
      await db.query(`
        INSERT INTO warehouses (id, tenant_id, code, name, address, status) 
        VALUES (UUID(), ?, 'WH001', 'Main Warehouse', '123 Main St', 'active')
      `, [tenant_id]);
      features.push('Sample warehouse created');
    }

    // 2. Create sample vendor if none exists
    const vendors = await db.query('SELECT COUNT(*) as count FROM vendors WHERE tenant_id = ?', [tenant_id]);
    if (vendors[0].count === 0) {
      await db.query(`
        INSERT INTO vendors (id, tenant_id, vendor_code, name, email, phone, status) 
        VALUES (UUID(), ?, 'VEN001', 'Sample Vendor', 'vendor@example.com', '1234567890', 'active')
      `, [tenant_id]);
      features.push('Sample vendor created');
    }

    // 3. Create sample customer if none exists
    const customers = await db.query('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?', [tenant_id]);
    if (customers[0].count === 0) {
      await db.query(`
        INSERT INTO customers (id, tenant_id, customer_code, name, email, phone, status) 
        VALUES (UUID(), ?, 'CUS001', 'Sample Customer', 'customer@example.com', '0987654321', 'active')
      `, [tenant_id]);
      features.push('Sample customer created');
    }

    // 4. Create categories if none exist
    const categories = await db.query('SELECT COUNT(*) as count FROM categories WHERE tenant_id = ?', [tenant_id]);
    if (categories[0].count === 0) {
      await db.query(`
        INSERT INTO categories (id, tenant_id, name, description, is_active) 
        VALUES (UUID(), ?, 'Electronics', 'Electronic items and components', true)
      `, [tenant_id]);
      features.push('Sample category created');
    }

    // 5. Update existing items with inventory projections
    const items = await db.query('SELECT id FROM items WHERE tenant_id = ? LIMIT 5', [tenant_id]);
    const warehouseList = await db.query('SELECT id FROM warehouses WHERE tenant_id = ? LIMIT 1', [tenant_id]);
    
    if (items.length > 0 && warehouseList.length > 0) {
      const warehouseId = warehouseList[0].id;
      
      for (const item of items) {
        // Check if inventory projection exists
        const existing = await db.query(
          'SELECT COUNT(*) as count FROM inventory_projections WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?',
          [tenant_id, item.id, warehouseId]
        );
        
        if (existing[0].count === 0) {
          await db.query(`
            INSERT INTO inventory_projections (id, tenant_id, item_id, warehouse_id, quantity_on_hand, quantity_available, average_cost, total_value) 
            VALUES (UUID(), ?, ?, ?, 100, 100, 10.00, 1000.00)
          `, [tenant_id, item.id, warehouseId]);
        }
      }
      features.push('Inventory projections created');
    }

    // 6. Create reorder levels for items
    if (items.length > 0 && warehouseList.length > 0) {
      const warehouseId = warehouseList[0].id;
      
      for (const item of items) {
        const existing = await db.query(
          'SELECT COUNT(*) as count FROM reorder_levels WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?',
          [tenant_id, item.id, warehouseId]
        );
        
        if (existing[0].count === 0) {
          await db.query(`
            INSERT INTO reorder_levels (id, tenant_id, item_id, warehouse_id, reorder_level, reorder_quantity, is_active) 
            VALUES (UUID(), ?, ?, ?, 10, 50, true)
          `, [tenant_id, item.id, warehouseId]);
        }
      }
      features.push('Reorder levels configured');
    }

    res.json({
      success: true,
      message: 'All features enabled successfully',
      features_enabled: features
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;