const mysql = require('mysql2/promise');

async function createLocationTables() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Warehouse Zones
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS warehouse_zones (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        zone_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        capacity_limit INT DEFAULT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
        UNIQUE KEY unique_zone_code (institution_id, warehouse_id, zone_code),
        INDEX idx_institution_warehouse (institution_id, warehouse_id)
      )
    `);

    // Warehouse Racks
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS warehouse_racks (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        zone_id VARCHAR(36) NOT NULL,
        rack_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        capacity_limit INT DEFAULT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (zone_id) REFERENCES warehouse_zones(id) ON DELETE CASCADE,
        UNIQUE KEY unique_rack_code (institution_id, zone_id, rack_code),
        INDEX idx_institution_zone (institution_id, zone_id)
      )
    `);

    // Warehouse Bins
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS warehouse_bins (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        rack_id VARCHAR(36) NOT NULL,
        bin_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        capacity_limit INT DEFAULT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rack_id) REFERENCES warehouse_racks(id) ON DELETE CASCADE,
        UNIQUE KEY unique_bin_code (institution_id, rack_id, bin_code),
        INDEX idx_institution_rack (institution_id, rack_id)
      )
    `);

    // Update items table to support more item types and custom fields
    try {
      await connection.execute(`ALTER TABLE items ADD COLUMN custom_fields JSON`);
    } catch (e) { /* column exists */ }
    try {
      await connection.execute(`ALTER TABLE items ADD COLUMN barcode VARCHAR(255)`);
    } catch (e) { /* column exists */ }
    try {
      await connection.execute(`ALTER TABLE items ADD COLUMN hsn_code VARCHAR(50)`);
    } catch (e) { /* column exists */ }
    try {
      await connection.execute(`ALTER TABLE items ADD COLUMN valuation_method ENUM('fifo', 'weighted_average') DEFAULT 'fifo'`);
    } catch (e) { /* column exists */ }
    try {
      await connection.execute(`ALTER TABLE items ADD COLUMN allow_negative_stock BOOLEAN DEFAULT FALSE`);
    } catch (e) { /* column exists */ }

    // Composite item components table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS composite_components (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        composite_item_id VARCHAR(36) NOT NULL,
        component_item_id VARCHAR(36) NOT NULL,
        quantity_required DECIMAL(15,3) NOT NULL,
        consumption_timing ENUM('order_confirmation', 'shipment') DEFAULT 'shipment',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (composite_item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (component_item_id) REFERENCES items(id) ON DELETE CASCADE,
        INDEX idx_institution_composite (institution_id, composite_item_id),
        INDEX idx_institution_component (institution_id, component_item_id)
      )
    `);

    // Update sales orders to support channel and pre-orders
    try {
      await connection.execute(`ALTER TABLE sales_orders ADD COLUMN is_preorder BOOLEAN DEFAULT FALSE`);
    } catch (e) { /* column exists */ }
    try {
      await connection.execute(`ALTER TABLE sales_orders ADD COLUMN committed_demand DECIMAL(15,3) DEFAULT 0`);
    } catch (e) { /* column exists */ }

    console.log('Location hierarchy and enhanced features tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error.message);
  } finally {
    await connection.end();
  }
}

createLocationTables();