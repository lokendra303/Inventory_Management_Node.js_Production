const mysql = require('mysql2/promise');

async function createSalesTables() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Sales Orders table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        so_number VARCHAR(100) NOT NULL,
        customer_id VARCHAR(36),
        customer_name VARCHAR(255) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        channel VARCHAR(100) DEFAULT 'direct',
        currency VARCHAR(3) DEFAULT 'USD',
        status ENUM('draft', 'confirmed', 'reserved', 'partially_shipped', 'shipped', 'cancelled') DEFAULT 'draft',
        order_date DATE NOT NULL,
        expected_ship_date DATE,
        notes TEXT,
        subtotal DECIMAL(15,2) DEFAULT 0,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        UNIQUE KEY unique_so_number (tenant_id, so_number),
        INDEX idx_tenant_status (tenant_id, status),
        INDEX idx_customer (tenant_id, customer_id),
        INDEX idx_warehouse (tenant_id, warehouse_id)
      )
    `);

    // Sales Order Lines table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales_order_lines (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        so_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        line_number INT NOT NULL,
        quantity_ordered DECIMAL(15,3) NOT NULL,
        quantity_reserved DECIMAL(15,3) DEFAULT 0,
        quantity_shipped DECIMAL(15,3) DEFAULT 0,
        unit_price DECIMAL(15,4) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL,
        status ENUM('pending', 'reserved', 'partially_shipped', 'shipped', 'cancelled') DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (so_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
        INDEX idx_tenant_so (tenant_id, so_id),
        INDEX idx_item (tenant_id, item_id),
        INDEX idx_status (tenant_id, status)
      )
    `);

    // Customers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        customer_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        payment_terms VARCHAR(100),
        credit_limit DECIMAL(15,2) DEFAULT 0,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_customer_code (tenant_id, customer_code),
        INDEX idx_tenant_status (tenant_id, status)
      )
    `);

    console.log('Sales management tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error.message);
  } finally {
    await connection.end();
  }
}

createSalesTables();