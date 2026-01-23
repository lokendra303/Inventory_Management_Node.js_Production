const mysql = require('mysql2/promise');

async function checkInventory() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Check events
    const [events] = await connection.execute(
      "SELECT * FROM event_store WHERE aggregate_type = 'inventory' ORDER BY created_at DESC LIMIT 5"
    );
    
    console.log('Recent inventory events:', events.length);
    events.forEach(event => {
      console.log(`- ${event.event_type}: ${event.event_data}`);
    });
    
    // Check projections
    const [projections] = await connection.execute(
      "SELECT * FROM inventory_projections ORDER BY last_movement_date DESC LIMIT 5"
    );
    
    console.log('\nInventory projections:', projections.length);
    projections.forEach(proj => {
      console.log(`- Item: ${proj.item_id}, Warehouse: ${proj.warehouse_id}, On Hand: ${proj.quantity_on_hand}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkInventory();