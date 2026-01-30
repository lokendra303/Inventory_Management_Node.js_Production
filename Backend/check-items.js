const mysql = require('mysql2/promise');

async function checkAndFixItems() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Check items table structure
    const [columns] = await connection.execute('DESCRIBE items');
    console.log('Items table columns:', columns.map(c => c.Field));
    
    // Check existing items
    const [items] = await connection.execute('SELECT * FROM items LIMIT 5');
    console.log('Existing items count:', items.length);
    
    if (items.length > 0) {
      console.log('Sample item:', items[0]);
    } else {
      // Create sample items if none exist
      const [institutions] = await connection.execute('SELECT id FROM institutions LIMIT 1');
      if (institutions.length > 0) {
        const institutionId = institutions[0].id;
        
        await connection.execute(
          `INSERT INTO items (id, institution_id, sku, name, type, unit, status) 
           VALUES (UUID(), ?, 'ITEM001', 'Sample Item 1', 'simple', 'pcs', 'active')`,
          [institutionId]
        );
        
        await connection.execute(
          `INSERT INTO items (id, institution_id, sku, name, type, unit, status) 
           VALUES (UUID(), ?, 'ITEM002', 'Sample Item 2', 'simple', 'pcs', 'active')`,
          [institutionId]
        );
        
        console.log('Created sample items');
      }
    }
    
    // Check final count
    const [finalItems] = await connection.execute('SELECT COUNT(*) as count FROM items');
    console.log('Total items:', finalItems[0].count);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkAndFixItems();