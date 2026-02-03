const mysql = require('mysql2/promise');

async function addItemFields() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Add essential item fields
    const fieldsToAdd = [
      'cost_price DECIMAL(15,4) DEFAULT 0',
      'selling_price DECIMAL(15,4) DEFAULT 0',
      'mrp DECIMAL(15,4) DEFAULT 0',
      'tax_rate DECIMAL(5,2) DEFAULT 0',
      'tax_type ENUM("inclusive", "exclusive") DEFAULT "exclusive"',
      'weight DECIMAL(10,3) DEFAULT 0',
      'weight_unit VARCHAR(10) DEFAULT "kg"',
      'dimensions VARCHAR(100) DEFAULT NULL',
      'brand VARCHAR(100) DEFAULT NULL',
      'manufacturer VARCHAR(100) DEFAULT NULL',
      'supplier_code VARCHAR(100) DEFAULT NULL',
      'min_stock_level DECIMAL(15,3) DEFAULT 0',
      'max_stock_level DECIMAL(15,3) DEFAULT 0',
      'is_serialized BOOLEAN DEFAULT FALSE',
      'is_batch_tracked BOOLEAN DEFAULT FALSE',
      'has_expiry BOOLEAN DEFAULT FALSE',
      'shelf_life_days INT DEFAULT NULL',
      'storage_conditions TEXT DEFAULT NULL',
      'item_group VARCHAR(100) DEFAULT NULL',
      'purchase_account VARCHAR(100) DEFAULT NULL',
      'sales_account VARCHAR(100) DEFAULT NULL',
      'opening_stock DECIMAL(15,3) DEFAULT 0',
      'opening_value DECIMAL(15,2) DEFAULT 0',
      'as_of_date DATE DEFAULT NULL'
    ];

    for (const field of fieldsToAdd) {
      try {
        await connection.execute(`ALTER TABLE items ADD COLUMN ${field}`);
        console.log(`Added field: ${field.split(' ')[0]}`);
      } catch (e) {
        if (!e.message.includes('Duplicate column name')) {
          console.error(`Error adding ${field}:`, e.message);
        }
      }
    }

    // Create item variants table for variant items
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS item_variants (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        parent_item_id VARCHAR(36) NOT NULL,
        variant_name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) NOT NULL,
        barcode VARCHAR(255) DEFAULT NULL,
        cost_price DECIMAL(15,4) DEFAULT 0,
        selling_price DECIMAL(15,4) DEFAULT 0,
        mrp DECIMAL(15,4) DEFAULT 0,
        weight DECIMAL(10,3) DEFAULT 0,
        dimensions VARCHAR(100) DEFAULT NULL,
        color VARCHAR(50) DEFAULT NULL,
        size VARCHAR(50) DEFAULT NULL,
        material VARCHAR(100) DEFAULT NULL,
        variant_attributes JSON DEFAULT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_item_id) REFERENCES items(id) ON DELETE CASCADE,
        UNIQUE KEY unique_variant_sku (institution_id, sku),
        INDEX idx_institution_parent (institution_id, parent_item_id)
      )
    `);

    // Create item suppliers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS item_suppliers (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        vendor_id VARCHAR(36) NOT NULL,
        supplier_item_code VARCHAR(100) DEFAULT NULL,
        cost_price DECIMAL(15,4) NOT NULL,
        minimum_order_qty DECIMAL(15,3) DEFAULT 1,
        lead_time_days INT DEFAULT 7,
        is_preferred BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
        UNIQUE KEY unique_item_vendor (institution_id, item_id, vendor_id),
        INDEX idx_institution_item (institution_id, item_id)
      )
    `);

    // Create item price history table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS item_price_history (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        price_type ENUM('cost', 'selling', 'mrp') NOT NULL,
        old_price DECIMAL(15,4) NOT NULL,
        new_price DECIMAL(15,4) NOT NULL,
        effective_date DATE NOT NULL,
        reason VARCHAR(255) DEFAULT NULL,
        changed_by VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        INDEX idx_institution_item_date (institution_id, item_id, effective_date)
      )
    `);

    console.log('Essential item fields and related tables created successfully');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

addItemFields();