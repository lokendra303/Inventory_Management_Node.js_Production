const mysql = require('mysql2/promise');

async function createPurchaseTables() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Purchase Orders table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        po_number VARCHAR(100) NOT NULL,
        vendor_id VARCHAR(36),
        vendor_name VARCHAR(255) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
        status ENUM('draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled') DEFAULT 'draft',
        order_date DATE NOT NULL,
        expected_date DATE,
        notes TEXT,
        subtotal DECIMAL(15,2) DEFAULT 0,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        UNIQUE KEY unique_po_number (tenant_id, po_number),
        INDEX idx_tenant_status (tenant_id, status),
        INDEX idx_vendor (tenant_id, vendor_id),
        INDEX idx_warehouse (tenant_id, warehouse_id)
      )
    `);

    // Purchase Order Lines table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS purchase_order_lines (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        po_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        line_number INT NOT NULL,
        quantity_ordered DECIMAL(15,3) NOT NULL,
        quantity_received DECIMAL(15,3) DEFAULT 0,
        unit_cost DECIMAL(15,4) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL,
        status ENUM('pending', 'partially_received', 'received', 'cancelled') DEFAULT 'pending',
        expected_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        INDEX idx_tenant_po (tenant_id, po_id),
        INDEX idx_item (tenant_id, item_id),
        INDEX idx_status (tenant_id, status)
      )
    `);

    // Goods Receipt Notes (GRN) table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS goods_receipt_notes (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        grn_number VARCHAR(100) NOT NULL,
        po_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        receipt_date DATE NOT NULL,
        received_by VARCHAR(36) NOT NULL,
        status ENUM('draft', 'confirmed', 'cancelled') DEFAULT 'draft',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_grn_number (tenant_id, grn_number),
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        INDEX idx_tenant_po (tenant_id, po_id),
        INDEX idx_receipt_date (tenant_id, receipt_date)
      )
    `);

    // GRN Lines table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS grn_lines (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        grn_id VARCHAR(36) NOT NULL,
        po_line_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        quantity_received DECIMAL(15,3) NOT NULL,
        unit_cost DECIMAL(15,4) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL,
        quality_status ENUM('accepted', 'rejected', 'pending') DEFAULT 'accepted',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
        FOREIGN KEY (po_line_id) REFERENCES purchase_order_lines(id) ON DELETE CASCADE,
        INDEX idx_tenant_grn (tenant_id, grn_id),
        INDEX idx_po_line (tenant_id, po_line_id),
        INDEX idx_item (tenant_id, item_id)
      )
    `);

    // Vendors table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vendors (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        vendor_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        payment_terms VARCHAR(100),
        lead_time_days INT DEFAULT 7,
        currency VARCHAR(3) DEFAULT 'USD',
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_vendor_code (tenant_id, vendor_code),
        INDEX idx_tenant_status (tenant_id, status)
      )
    `);

    console.log('Purchase management tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error.message);
  } finally {
    await connection.end();
  }
}

createPurchaseTables();