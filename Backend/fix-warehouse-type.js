const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '12345',
  database: 'ims_sepcune'
};

async function fixWarehouseIssues() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Add type column to warehouses table
    try {
      await connection.execute('ALTER TABLE warehouses ADD COLUMN type VARCHAR(36) AFTER name');
      console.log('✅ Added type column to warehouses');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('ℹ️  type column already exists in warehouses');
      } else {
        console.error('❌ Error adding type column:', error.message);
      }
    }
    
    // Add foreign key constraint
    try {
      await connection.execute('ALTER TABLE warehouses ADD FOREIGN KEY (type) REFERENCES warehouse_types(id)');
      console.log('✅ Added foreign key constraint');
    } catch (error) {
      console.log('ℹ️  Foreign key constraint may already exist or warehouse_types table needs data');
    }
    
    console.log('✅ Warehouse table fixes completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixWarehouseIssues();