const mysql = require('mysql2/promise');

async function addImageColumn() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Adding image column to items table...');
    
    // Check if image column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ims_sepcune' AND TABLE_NAME = 'items' AND COLUMN_NAME = 'image'
    `);
    
    if (columns.length === 0) {
      // Add image column
      await connection.execute(`
        ALTER TABLE items ADD COLUMN image LONGTEXT AFTER description
      `);
      console.log('✅ Image column added to items table');
    } else {
      console.log('ℹ️  Image column already exists');
    }

  } catch (error) {
    console.error('❌ Error adding image column:', error.message);
  } finally {
    await connection.end();
  }
}

addImageColumn();