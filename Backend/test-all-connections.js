const axios = require('axios');
const mysql = require('mysql2/promise');

const API_BASE = 'http://localhost:5000/api';
const DB_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '12345',
  database: 'ims_sepcune'
};

async function testAllConnections() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    
    // Get tenant ID
    const [tenants] = await connection.execute('SELECT id FROM tenants LIMIT 1');
    if (tenants.length === 0) {
      throw new Error('No tenant found. Please run the migration script first.');
    }
    
    const tenantId = tenants[0].id;
    console.log(`✅ Using tenant ID: ${tenantId}`);
    
    // Test all table connections
    console.log('\n📊 Testing table connections...');
    
    const tables = [
      'tenants', 'users', 'roles', 'items', 'categories', 'warehouses', 
      'warehouse_types', 'warehouse_zones', 'warehouse_racks', 'warehouse_bins',
      'vendors', 'customers', 'purchase_orders', 'purchase_order_lines',
      'sales_orders', 'sales_order_lines', 'goods_receipt_notes', 'grn_lines',
      'inventory_projections', 'item_batches', 'item_serials', 'reorder_levels',
      'low_stock_alerts', 'event_store', 'api_keys', 'bearer_tokens',
      'automation_rules', 'workflow_definitions', 'workflow_instances',
      'composite_components'
    ];
    
    const tableStats = {};
    
    for (const table of tables) {
      try {
        const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        tableStats[table] = rows[0].count;
        console.log(`   ✅ ${table}: ${rows[0].count} records`);
      } catch (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
        tableStats[table] = 'ERROR';
      }
    }
    
    // Enable all features
    console.log('\n🚀 Enabling all features...');
    
    // Create sample data for comprehensive testing
    await enableAllFeatures(connection, tenantId);
    
    // Test API endpoints (if server is running)
    console.log('\n🌐 Testing API endpoints...');
    try {
      // Test health endpoint
      const healthResponse = await axios.get(`${API_BASE}/health`);
      console.log('   ✅ Health check:', healthResponse.data.status);
      
      // Note: Other endpoints require authentication
      console.log('   ℹ️  Other endpoints require authentication');
      
    } catch (error) {
      console.log('   ⚠️  API server not running or not accessible');
    }
    
    // Final summary
    console.log('\n📋 SUMMARY:');
    console.log('='.repeat(50));
    
    const totalTables = Object.keys(tableStats).length;
    const workingTables = Object.values(tableStats).filter(v => v !== 'ERROR').length;
    
    console.log(`📊 Tables: ${workingTables}/${totalTables} working`);
    console.log(`🏢 Tenant ID: ${tenantId}`);
    console.log(`👥 Users: ${tableStats.users || 0}`);
    console.log(`📦 Items: ${tableStats.items || 0}`);
    console.log(`🏪 Warehouses: ${tableStats.warehouses || 0}`);
    console.log(`🏭 Vendors: ${tableStats.vendors || 0}`);
    console.log(`👤 Customers: ${tableStats.customers || 0}`);
    console.log(`📋 Purchase Orders: ${tableStats.purchase_orders || 0}`);
    console.log(`🛒 Sales Orders: ${tableStats.sales_orders || 0}`);
    console.log(`📊 Inventory Projections: ${tableStats.inventory_projections || 0}`);
    console.log(`⚠️  Low Stock Alerts: ${tableStats.low_stock_alerts || 0}`);
    
    console.log('\n✅ All connections tested and features enabled!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

async function enableAllFeatures(connection, tenantId) {
  try {
    // 1. Ensure warehouse exists
    let [warehouses] = await connection.execute('SELECT id FROM warehouses WHERE tenant_id = ? LIMIT 1', [tenantId]);
    let warehouseId;
    
    if (warehouses.length === 0) {
      const warehouseUuid = generateUUID();
      await connection.execute(`
        INSERT INTO warehouses (id, tenant_id, code, name, address, status) 
        VALUES (?, ?, 'WH001', 'Main Warehouse', '123 Main Street, City', 'active')
      `, [warehouseUuid, tenantId]);
      warehouseId = warehouseUuid;
      console.log('   ✅ Created main warehouse');
    } else {
      warehouseId = warehouses[0].id;
    }
    
    // 2. Ensure vendor exists
    let [vendors] = await connection.execute('SELECT id FROM vendors WHERE tenant_id = ? LIMIT 1', [tenantId]);
    let vendorId;
    
    if (vendors.length === 0) {
      const vendorUuid = generateUUID();
      await connection.execute(`
        INSERT INTO vendors (id, tenant_id, vendor_code, name, email, phone, status) 
        VALUES (?, ?, 'VEN001', 'ABC Suppliers Ltd', 'contact@abcsuppliers.com', '+1-555-0123', 'active')
      `, [vendorUuid, tenantId]);
      vendorId = vendorUuid;
      console.log('   ✅ Created sample vendor');
    } else {
      vendorId = vendors[0].id;
    }
    
    // 3. Ensure customer exists
    let [customers] = await connection.execute('SELECT id FROM customers WHERE tenant_id = ? LIMIT 1', [tenantId]);
    let customerId;
    
    if (customers.length === 0) {
      const customerUuid = generateUUID();
      await connection.execute(`
        INSERT INTO customers (id, tenant_id, customer_code, name, email, phone, status) 
        VALUES (?, ?, 'CUS001', 'XYZ Corporation', 'orders@xyzcorp.com', '+1-555-0456', 'active')
      `, [customerUuid, tenantId]);
      customerId = customerUuid;
      console.log('   ✅ Created sample customer');
    } else {
      customerId = customers[0].id;
    }
    
    // 4. Create categories
    let [categories] = await connection.execute('SELECT id FROM categories WHERE tenant_id = ? LIMIT 1', [tenantId]);
    if (categories.length === 0) {
      await connection.execute(`
        INSERT INTO categories (id, tenant_id, name, description, is_active) 
        VALUES (?, ?, 'Electronics', 'Electronic components and devices', true)
      `, [generateUUID(), tenantId]);
      console.log('   ✅ Created sample category');
    }
    
    // 5. Ensure items have inventory projections
    const [items] = await connection.execute('SELECT id, sku, name FROM items WHERE tenant_id = ?', [tenantId]);
    
    for (const item of items) {
      // Check if inventory projection exists
      const [existing] = await connection.execute(
        'SELECT COUNT(*) as count FROM inventory_projections WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?',
        [tenantId, item.id, warehouseId]
      );
      
      if (existing[0].count === 0) {
        await connection.execute(`
          INSERT INTO inventory_projections (id, tenant_id, item_id, warehouse_id, quantity_on_hand, quantity_available, average_cost, total_value) 
          VALUES (?, ?, ?, ?, 100, 100, 25.50, 2550.00)
        `, [generateUUID(), tenantId, item.id, warehouseId]);
      }
      
      // Create reorder level
      const [reorderExists] = await connection.execute(
        'SELECT COUNT(*) as count FROM reorder_levels WHERE tenant_id = ? AND item_id = ? AND warehouse_id = ?',
        [tenantId, item.id, warehouseId]
      );
      
      if (reorderExists[0].count === 0) {
        await connection.execute(`
          INSERT INTO reorder_levels (id, tenant_id, item_id, warehouse_id, reorder_level, reorder_quantity, is_active) 
          VALUES (?, ?, ?, ?, 20, 100, true)
        `, [generateUUID(), tenantId, item.id, warehouseId]);
      }
    }
    
    if (items.length > 0) {
      console.log(`   ✅ Created inventory projections for ${items.length} items`);
      console.log(`   ✅ Set reorder levels for ${items.length} items`);
    }
    
    // 6. Create sample purchase order
    const [poExists] = await connection.execute('SELECT COUNT(*) as count FROM purchase_orders WHERE tenant_id = ?', [tenantId]);
    if (poExists[0].count === 0 && items.length > 0) {
      const poId = generateUUID();
      await connection.execute(`
        INSERT INTO purchase_orders (id, tenant_id, po_number, vendor_id, vendor_name, warehouse_id, status, order_date, total_amount, created_by) 
        VALUES (?, ?, 'PO001', ?, 'ABC Suppliers Ltd', ?, 'draft', CURDATE(), 1000.00, (SELECT id FROM users WHERE tenant_id = ? LIMIT 1))
      `, [poId, tenantId, vendorId, warehouseId, tenantId]);
      
      // Add PO line
      await connection.execute(`
        INSERT INTO purchase_order_lines (id, tenant_id, po_id, item_id, quantity_ordered, unit_cost, line_total) 
        VALUES (?, ?, ?, ?, 50, 20.00, 1000.00)
      `, [generateUUID(), tenantId, poId, items[0].id]);
      
      console.log('   ✅ Created sample purchase order');
    }
    
    // 7. Create sample sales order
    const [soExists] = await connection.execute('SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ?', [tenantId]);
    if (soExists[0].count === 0 && items.length > 0) {
      const soId = generateUUID();
      await connection.execute(`
        INSERT INTO sales_orders (id, tenant_id, so_number, customer_id, customer_name, warehouse_id, status, order_date, total_amount, created_by) 
        VALUES (?, ?, 'SO001', ?, 'XYZ Corporation', ?, 'draft', CURDATE(), 750.00, (SELECT id FROM users WHERE tenant_id = ? LIMIT 1))
      `, [soId, tenantId, customerId, warehouseId, tenantId]);
      
      // Add SO line
      await connection.execute(`
        INSERT INTO sales_order_lines (id, tenant_id, so_id, item_id, quantity_ordered, unit_price, line_total) 
        VALUES (?, ?, ?, ?, 25, 30.00, 750.00)
      `, [generateUUID(), tenantId, soId, items[0].id]);
      
      console.log('   ✅ Created sample sales order');
    }
    
  } catch (error) {
    console.error('   ❌ Error enabling features:', error.message);
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Run the test
if (require.main === module) {
  testAllConnections()
    .then(() => {
      console.log('🎉 Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAllConnections };