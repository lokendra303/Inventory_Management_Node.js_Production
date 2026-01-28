const mysql = require('mysql2/promise');

async function createDropdownOptionsTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Creating dropdown options table...');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS dropdown_options (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        tenant_id VARCHAR(36) NOT NULL,
        type VARCHAR(50) NOT NULL,
        options JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_tenant_type (tenant_id, type)
      )
    `);

    console.log('✅ Dropdown options table created successfully!');

  } catch (error) {
    console.error('❌ Error creating dropdown options table:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

createDropdownOptionsTable();