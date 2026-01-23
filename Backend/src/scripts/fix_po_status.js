const db = require('../database/connection');

async function fixPOStatus() {
  try {
    await db.connect();
    
    console.log('Fixing purchase order status ENUM...');
    
    // Update the status ENUM to include 'confirmed'
    await db.query(`
      ALTER TABLE purchase_orders 
      MODIFY COLUMN status ENUM('draft', 'pending_approval', 'approved', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled') DEFAULT 'draft'
    `);
    
    console.log('Purchase order status ENUM fixed successfully!');
  } catch (error) {
    console.error('Error fixing PO status:', error);
  } finally {
    process.exit(0);
  }
}

fixPOStatus();