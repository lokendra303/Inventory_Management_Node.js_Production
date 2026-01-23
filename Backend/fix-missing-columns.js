const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '12345',
  database: 'ims_sepcune'
};

async function addMissingColumns() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Add order_date to purchase_orders if not exists
    try {
      await connection.execute('ALTER TABLE purchase_orders ADD COLUMN order_date DATE DEFAULT (CURRENT_DATE)');
      console.log('✅ Added order_date to purchase_orders');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('ℹ️  order_date already exists in purchase_orders');
      } else {
        console.error('❌ Error adding order_date:', error.message);
      }
    }
    
    // Add order_date to sales_orders if not exists
    try {
      await connection.execute('ALTER TABLE sales_orders ADD COLUMN order_date DATE DEFAULT (CURRENT_DATE)');
      console.log('✅ Added order_date to sales_orders');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('ℹ️  order_date already exists in sales_orders');
      } else {
        console.error('❌ Error adding order_date:', error.message);
      }
    }
    
    // Add line_number to purchase_order_lines if not exists
    try {
      await connection.execute('ALTER TABLE purchase_order_lines ADD COLUMN line_number INT DEFAULT 1');
      console.log('✅ Added line_number to purchase_order_lines');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('ℹ️  line_number already exists in purchase_order_lines');
      } else {
        console.error('❌ Error adding line_number:', error.message);
      }
    }
    
    // Add line_number to sales_order_lines if not exists
    try {
      await connection.execute('ALTER TABLE sales_order_lines ADD COLUMN line_number INT DEFAULT 1');
      console.log('✅ Added line_number to sales_order_lines');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('ℹ️  line_number already exists in sales_order_lines');
      } else {
        console.error('❌ Error adding line_number:', error.message);
      }
    }
    
    console.log('✅ Column updates completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addMissingColumns();