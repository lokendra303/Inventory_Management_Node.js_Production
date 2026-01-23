const db = require('../database/connection');

async function fixPOLines() {
  try {
    await db.connect();
    
    console.log('Adding missing columns to purchase_order_lines...');
    
    // Add missing columns one by one
    const columns = [
      { name: 'line_number', sql: 'ADD COLUMN line_number INT DEFAULT 1' },
      { name: 'expected_date', sql: 'ADD COLUMN expected_date DATE NULL' },
      { name: 'status', sql: "ADD COLUMN status ENUM('pending', 'partially_received', 'received') DEFAULT 'pending'" },
      { name: 'updated_at', sql: 'ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    ];
    
    for (const column of columns) {
      try {
        await db.query(`ALTER TABLE purchase_order_lines ${column.sql}`);
        console.log(`Added column: ${column.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`Column ${column.name} already exists`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('Purchase order lines table updated successfully!');
  } catch (error) {
    console.error('Error updating PO lines table:', error);
  } finally {
    process.exit(0);
  }
}

fixPOLines();