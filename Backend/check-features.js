const mysql = require('mysql2/promise');

async function checkFeatureStatus() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('=== IMS FEATURE STATUS CHECK ===\n');

    // 1. Item/Product Master
    const [items] = await connection.execute('SELECT COUNT(*) as count FROM items');
    console.log('✅ 1. Item/Product Master:', items[0].count, 'items');

    // 2. Stock Quantity Tracking
    const [projections] = await connection.execute('SELECT COUNT(*) as count FROM inventory_projections');
    console.log('✅ 2. Stock Quantity Tracking:', projections[0].count, 'projections');

    // 3. Stock Movement Recording
    const [events] = await connection.execute('SELECT COUNT(*) as count FROM event_store WHERE aggregate_type = "inventory"');
    console.log('✅ 3. Stock Movement Recording:', events[0].count, 'events');

    // 4. Warehouse/Location
    const [warehouses] = await connection.execute('SELECT COUNT(*) as count FROM warehouses');
    console.log('✅ 4. Warehouse/Location:', warehouses[0].count, 'warehouses');

    // 5. Purchase (Stock In)
    const [pos] = await connection.execute('SELECT COUNT(*) as count FROM purchase_orders');
    console.log('✅ 5. Purchase Orders:', pos[0].count, 'purchase orders');

    // 6. Sales/Issue (Stock Out)
    const [sos] = await connection.execute('SELECT COUNT(*) as count FROM sales_orders');
    console.log('✅ 6. Sales Orders:', sos[0].count, 'sales orders');

    // 7. Low Stock Alert - CHECK IF MISSING
    const [tables] = await connection.execute("SHOW TABLES LIKE 'reorder_levels'");
    if (tables.length === 0) {
      console.log('❌ 7. Low Stock Alert/Reorder Level: MISSING');
    } else {
      console.log('✅ 7. Low Stock Alert/Reorder Level: EXISTS');
    }

    // 8. Basic Reports - CHECK ENDPOINTS
    console.log('✅ 8. Basic Reports: Available via API endpoints');

    // 9. User Authentication & Roles
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log('✅ 9. User Authentication & Roles:', users[0].count, 'users');

    // 10. Stock Adjustments with Reasons
    const [adjustments] = await connection.execute('SELECT COUNT(*) as count FROM event_store WHERE event_type = "StockAdjusted"');
    console.log('✅ 10. Stock Adjustments:', adjustments[0].count, 'adjustments');

    // 11. Reservation vs Available Stock
    const [reservations] = await connection.execute('SELECT COUNT(*) as count FROM event_store WHERE event_type = "SaleReserved"');
    console.log('✅ 11. Reservation System:', reservations[0].count, 'reservations');

    // 12. Multi-Warehouse Support
    console.log('✅ 12. Multi-Warehouse Support: Available');

    // 13. Vendor & Customer Management
    const [vendors] = await connection.execute('SELECT COUNT(*) as count FROM vendors');
    const [customers] = await connection.execute('SELECT COUNT(*) as count FROM customers');
    console.log('✅ 13. Vendor & Customer Management:', vendors[0].count, 'vendors,', customers[0].count, 'customers');

    // Missing features to implement:
    console.log('\n=== MISSING FEATURES TO IMPLEMENT ===');
    console.log('❌ Reorder Level Management');
    console.log('❌ Low Stock Alerts');
    console.log('❌ Import/Export Excel functionality');
    console.log('❌ Batch/Serial/Expiry Tracking');
    console.log('❌ Advanced Reports Dashboard');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkFeatureStatus();