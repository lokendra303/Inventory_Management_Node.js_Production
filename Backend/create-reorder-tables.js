const mysql = require('mysql2/promise');

async function createReorderTables() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Reorder Levels table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reorder_levels (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        reorder_level DECIMAL(15,3) NOT NULL DEFAULT 0,
        reorder_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
        max_stock_level DECIMAL(15,3) DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
        UNIQUE KEY unique_item_warehouse (institution_id, item_id, warehouse_id),
        INDEX idx_institution_active (institution_id, is_active)
      )
    `);

    // Low Stock Alerts table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS low_stock_alerts (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        current_stock DECIMAL(15,3) NOT NULL,
        reorder_level DECIMAL(15,3) NOT NULL,
        alert_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('active', 'acknowledged', 'resolved') DEFAULT 'active',
        acknowledged_by VARCHAR(36) DEFAULT NULL,
        acknowledged_at TIMESTAMP NULL,
        resolved_at TIMESTAMP NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
        INDEX idx_institution_status (institution_id, status),
        INDEX idx_alert_date (alert_date)
      )
    `);

    // Add reorder level to items table
    try {
      await connection.execute(`ALTER TABLE items ADD COLUMN default_reorder_level DECIMAL(15,3) DEFAULT 0`);
    } catch (e) { /* column exists */ }

    // Batch/Serial tracking tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS item_batches (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        batch_number VARCHAR(100) NOT NULL,
        manufacture_date DATE DEFAULT NULL,
        expiry_date DATE DEFAULT NULL,
        quantity_received DECIMAL(15,3) NOT NULL,
        quantity_remaining DECIMAL(15,3) NOT NULL,
        unit_cost DECIMAL(15,4) NOT NULL,
        status ENUM('active', 'expired', 'damaged', 'recalled') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
        UNIQUE KEY unique_batch (institution_id, item_id, warehouse_id, batch_number),
        INDEX idx_expiry (institution_id, expiry_date, status)
      )
    `);

    // Serial numbers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS item_serials (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        serial_number VARCHAR(100) NOT NULL,
        batch_id VARCHAR(36) DEFAULT NULL,
        status ENUM('available', 'reserved', 'sold', 'damaged', 'returned') DEFAULT 'available',
        received_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sold_date TIMESTAMP NULL,
        customer_reference VARCHAR(255) DEFAULT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
        FOREIGN KEY (batch_id) REFERENCES item_batches(id) ON DELETE SET NULL,
        UNIQUE KEY unique_serial (institution_id, item_id, serial_number),
        INDEX idx_status (institution_id, status)
      )
    `);

    console.log('Reorder level and tracking tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error.message);
  } finally {
    await connection.end();
  }
}

createReorderTables();