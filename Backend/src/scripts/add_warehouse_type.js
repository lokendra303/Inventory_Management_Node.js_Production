const db = require('../database/connection');

async function addWarehouseType() {
  try {
    await db.connect();
    
    console.log('Adding type column to warehouses table...');
    
    try {
      await db.query(`ALTER TABLE warehouses ADD COLUMN type VARCHAR(50) DEFAULT 'standard'`);
      console.log('Warehouse type column added successfully!');
    } catch (e) {
      if (e.message.includes('Duplicate column name')) {
        console.log('Type column already exists');
      } else {
        throw e;
      }
    }
  } catch (error) {
    if (!error.message.includes('Duplicate column name')) {
      console.error('Error adding warehouse type:', error);
    } else {
      console.log('Type column already exists');
    }
  } finally {
    process.exit(0);
  }
}

addWarehouseType();