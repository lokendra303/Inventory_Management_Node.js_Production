const mysql = require('mysql2/promise');

async function createTestProjection() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Get a tenant, item, and warehouse for testing
    const [tenants] = await connection.execute('SELECT id FROM tenants LIMIT 1');
    const [items] = await connection.execute('SELECT id FROM items LIMIT 1');
    const [warehouses] = await connection.execute('SELECT id FROM warehouses LIMIT 1');
    
    if (tenants.length === 0 || items.length === 0 || warehouses.length === 0) {
      console.log('Missing required data (tenant, item, or warehouse)');
      return;
    }
    
    const tenantId = tenants[0].id;
    const itemId = items[0].id;
    const warehouseId = warehouses[0].id;
    
    // Create test projection
    await connection.execute(
      `INSERT INTO inventory_projections 
       (id, tenant_id, item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_movement_date, version)
       VALUES (UUID(), ?, ?, ?, 100, 100, 0, 10.50, 1050.00, NOW(), 1)
       ON DUPLICATE KEY UPDATE 
       quantity_on_hand = 100, quantity_available = 100, quantity_reserved = 0`,
      [tenantId, itemId, warehouseId]
    );
    
    console.log('Test projection created:', { tenantId, itemId, warehouseId });
    
    // Verify
    const [projections] = await connection.execute(
      'SELECT * FROM inventory_projections WHERE tenant_id = ?',
      [tenantId]
    );
    
    console.log('Total projections:', projections.length);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

createTestProjection();