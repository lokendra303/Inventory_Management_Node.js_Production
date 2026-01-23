const db = require('../database/connection');

async function fixPurchaseOrderLines() {
  try {
    await db.connect();
    
    console.log('Fixing purchase order lines table...');
    
    // Add missing columns to purchase_order_lines table
    try {
      await db.query(`ALTER TABLE purchase_order_lines ADD COLUMN line_number INT DEFAULT 1`);
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) throw e;
    }
    
    try {
      await db.query(`ALTER TABLE purchase_order_lines ADD COLUMN expected_date DATE`);
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) throw e;
    }
    
    try {
      await db.query(`ALTER TABLE purchase_order_lines ADD COLUMN status ENUM('pending', 'partially_received', 'received') DEFAULT 'pending'`);
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) throw e;
    }
    
    try {
      await db.query(`ALTER TABLE purchase_order_lines ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) throw e;
    }
    
    // Add missing order_date column to purchase_orders
    try {
      await db.query(`ALTER TABLE purchase_orders ADD COLUMN order_date DATE`);
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) throw e;
    }
    
    console.log('Purchase order tables fixed successfully!');
  } catch (error) {
    console.error('Error fixing purchase order tables:', error);
  } finally {
    process.exit(0);
  }
}

fixPurchaseOrderLines();