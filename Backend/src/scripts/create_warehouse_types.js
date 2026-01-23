const db = require('../database/connection');

async function createWarehouseTypesTable() {
  try {
    await db.connect();
    
    console.log('Creating warehouse_types table...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS warehouse_types (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        UNIQUE KEY unique_tenant_type (tenant_id, name),
        INDEX idx_tenant (tenant_id)
      )
    `);
    
    console.log('Warehouse types table created successfully!');
  } catch (error) {
    console.error('Error creating warehouse types table:', error);
  } finally {
    process.exit(0);
  }
}

createWarehouseTypesTable();